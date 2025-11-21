# backend/accounts/views.py
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import Profile, User, TwoFactorConfig, TwoFactorChallenge
from .serializers import UserSerializer, UserRegisterSerializer, UserRoleUpdateSerializer, TwoFactorSetupSerializer, TwoFactorVerifySerializer, TwoFactorEnableSerializer, TwoFactorDisableSerializer
import pyotp
import base64
from rest_framework.views import APIView
from django.contrib.auth import authenticate, get_user_model
from django.shortcuts import get_object_or_404
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

def generate_base32_secret():
    # pyotp random_base32
    return pyotp.random_base32()

class TwoFactorSetupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """
        Genera un secret TOTP y devuelve otpauth URL que el frontend puede renderizar como QR.
        No activa 2FA hasta que el usuario confirme con un código válido.
        """
        user = request.user
        cfg, created = TwoFactorConfig.objects.get_or_create(user=user)
        if not cfg.secret:
            cfg.secret = generate_base32_secret()
            cfg.save()
        # otpauth URL compatible con apps TOTP
        # label: "SmartLock:<username>"
        issuer = "SmartLock"
        label = f"{issuer}:{user.username}"
        totp = pyotp.TOTP(cfg.secret)
        otpauth_url = totp.provisioning_uri(name=label, issuer_name=issuer)
        return Response({"otpauth_url": otpauth_url})

class TwoFactorConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """
        Verifica el código TOTP y activa 2FA (is_enabled=True) si es correcto.
        Body: { "code": "123456" }
        """
        serializer = TwoFactorEnableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data["code"]
        cfg = get_object_or_404(TwoFactorConfig, user=request.user)
        if not cfg.secret:
            return Response({"detail": "No hay secret generado"}, status=status.HTTP_400_BAD_REQUEST)
        totp = pyotp.TOTP(cfg.secret)
        if totp.verify(code, valid_window=1):
            cfg.is_enabled = True
            cfg.save()
            return Response({"detail": "2FA activado"})
        return Response({"detail": "Código inválido"}, status=status.HTTP_400_BAD_REQUEST)

class TwoFactorDisableView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = TwoFactorDisableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data["code"]
        cfg = get_object_or_404(TwoFactorConfig, user=request.user)
        if not cfg.is_enabled:
            return Response({"detail": "2FA no activado"}, status=status.HTTP_400_BAD_REQUEST)
        totp = pyotp.TOTP(cfg.secret)
        if totp.verify(code, valid_window=1):
            cfg.is_enabled = False
            # opcional: borrar secret
            # cfg.secret = None
            cfg.save()
            return Response({"detail": "2FA desactivado"})
        return Response({"detail": "Código inválido"}, status=status.HTTP_400_BAD_REQUEST)

def _ensure_2fa_config(user):
    """
    Asegura que exista TwoFactorConfig para el usuario.
    Si no existe, lo crea (con secret) pero NO lo marca como enabled,
    para permitir que el usuario haga setup en su primer intento.
    """
    cfg, created = TwoFactorConfig.objects.get_or_create(user=user)
    if not cfg.secret:
        cfg.secret = pyotp.random_base32()  # genera secret base32
        cfg.save()
    return cfg

class TokenChallengeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        """
        Forzamos siempre el flujo 2FA:
        - Si las credenciales son válidas, creamos un TwoFactorChallenge y devolvemos 202 con challenge.
        - Si el usuario no tiene secret/config, la creamos y devolvemos otpauth_url + must_setup=True.
        - Nunca devolvemos tokens en esta vista.
        """
        username = request.data.get("username")
        password = request.data.get("password")
        if not username or not password:
            return Response({"detail": "username and password required"}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response({"detail": "Credenciales inválidas"}, status=status.HTTP_401_UNAUTHORIZED)

        # Si el usuario está inactivo, no continuar
        if not user.is_active:
            return Response({"detail": "Usuario inactivo"}, status=status.HTTP_401_UNAUTHORIZED)

        # Asegurar que haya TwoFactorConfig (crea secret si no hay)
        cfg = _ensure_2fa_config(user)

        # Crear challenge (caduca por modelo)
        challenge = TwoFactorChallenge.objects.create(user=user)

        # Construir otpauth_url si el usuario aún no tiene 2FA habilitado
        otpauth_url = None
        must_setup = False
        if not cfg.is_enabled:
            # generar otpauth URL para que el usuario haga setup TOTP en su app
            issuer = "SmartLock"
            label = f"{issuer}:{user.username}"
            totp = pyotp.TOTP(cfg.secret)
            otpauth_url = totp.provisioning_uri(name=label, issuer_name=issuer)
            must_setup = True

        payload = {
            "2fa_required": True,
            "challenge": str(challenge.token),
            "must_setup": must_setup,
        }
        if otpauth_url:
            payload["otpauth_url"] = otpauth_url

        # Devolver 202 Accepted y datos para el frontend
        return Response(payload, status=status.HTTP_202_ACCEPTED)

class Token2FAVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        """
        Body: { challenge: "<uuid>", code: "123456" }
        Verifica challenge válido y código TOTP; si OK devuelve access+refresh.
        Además: si el usuario tiene TwoFactorConfig pero is_enabled == False,
        validaremos el código y activaremos 2FA (confirmación) antes de emitir tokens.
        """
        serializer = TwoFactorVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["challenge"]
        code = serializer.validated_data["code"]

        try:
            chal = TwoFactorChallenge.objects.get(token=token, used=False)
        except TwoFactorChallenge.DoesNotExist:
            return Response({"detail": "Challenge inválido o ya usado/expirado."}, status=status.HTTP_400_BAD_REQUEST)

        if chal.expired:
            return Response({"detail": "Challenge expirado."}, status=status.HTTP_400_BAD_REQUEST)

        user = chal.user

        # Obtener o crear TwoFactorConfig (no crear secret aquí)
        cfg = getattr(user, "twofactor", None)
        if not cfg or not cfg.secret:
            return Response({"detail": "2FA no configurado para este usuario."}, status=status.HTTP_400_BAD_REQUEST)

        totp = pyotp.TOTP(cfg.secret)
        if not totp.verify(code, valid_window=1):
            return Response({"detail": "Código TOTP inválido."}, status=status.HTTP_400_BAD_REQUEST)

        # Si llegamos aquí: código válido
        # Si no está activado aún, activarlo (confirmación de setup)
        if not cfg.is_enabled:
            cfg.is_enabled = True
            cfg.save(update_fields=["is_enabled"])

        # marcar challenge como usado
        chal.used = True
        chal.save(update_fields=["used"])

        # emitir tokens JWT
        refresh = RefreshToken.for_user(user)
        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token)
        }, status=status.HTTP_200_OK)

# Permiso personalizado
class IsOwnerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # usar getattr para evitar exception si no existe profile
        profile = getattr(request.user, 'profile', None)
        if profile is None:
            # si no hay profile aún, decidir política: negar (más seguro) o tratar como guest
            return False
        return profile.role in ['owner', 'admin']

# Crear usuario
class UserRegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegisterSerializer
    permission_classes = [permissions.AllowAny]


# Listar usuarios
class UserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.profile.role in ['owner', 'admin']:
            return User.objects.all()
        return User.objects.filter(id=user.id)

# Actualizar rol
class UserRoleUpdateView(generics.UpdateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRoleUpdateSerializer
    permission_classes = [IsOwnerOrAdmin]

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_role = serializer.validated_data['role']

        profile, created = Profile.objects.get_or_create(user=user)
        profile.role = new_role
        profile.save()

        return Response({'message': f'Rol de {user.username} actualizado a {new_role}'}, status=status.HTTP_200_OK)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        """Devuelve la información del usuario autenticado"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return User.objects.all()
        # si es owner/admin de alguna cerradura, devolver usuarios relacionados (opcional)
        # sino devolver solo el usuario mismo
        return User.objects.filter(pk=user.pk)