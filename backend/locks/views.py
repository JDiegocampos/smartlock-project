# locks/views.py
from rest_framework import viewsets, permissions, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from .throttles import ValidatePinThrottle
from django.utils import timezone
from django.db.models import Q
from .models import Role, UserRole, Lock, NetworkConfig, Pin, Device, AccessLog
from .serializers import (
    RoleSerializer, UserRoleSerializer, LockSerializer,
    NetworkConfigSerializer, PinSerializer, DeviceSerializer, AccessLogSerializer, LockClaimSerializer
)
from .permissions import HasLockRolePermission, DeviceAPIKeyPermission, user_has_allowed_role
from django.contrib.auth import get_user_model
import logging

logger = logging.getLogger(__name__)
UserModel = get_user_model()

class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated]


class LockViewSet(viewsets.ModelViewSet):
    queryset = Lock.objects.all()
    serializer_class = LockSerializer
    permission_classes = [permissions.IsAuthenticated, HasLockRolePermission]
    lookup_field = 'uuid'   # usa uuid en la URL

    def get_queryset(self):
        user = self.request.user
        # Mostrar cerraduras propias y aquellas donde tenga algún rol asignado
        return Lock.objects.filter(
            Q(owner=user) | Q(user_roles__user=user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[DeviceAPIKeyPermission], throttle_classes=[ValidatePinThrottle])
    def validate_pin(self, request, uuid=None):
        lock = self.get_object()
        device = getattr(request, 'device', None)

        logger.debug("validate_pin called. request.user=%r (%s), request.device=%r", request.user, type(request.user), device)

        if not device or device.lock != lock:
            return Response({"detail": "Device not authorized for this lock."}, status=status.HTTP_403_FORBIDDEN)

        code = request.data.get('code')
        if not code:
            return Response({"detail":"code is required"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        pin_obj = Pin.objects.filter(lock=lock, code=code, is_active=True).first()
        granted = False

        if pin_obj:
            if pin_obj.is_temporary:
                if pin_obj.start_time and pin_obj.end_time and pin_obj.start_time <= now <= pin_obj.end_time:
                    granted = True
            else:
                granted = True

        # --- Selección segura del usuario para el AccessLog ---
        user_for_log = None

        # 1) preferir el creador del pin si es un User válido
        if pin_obj:
            candidate = getattr(pin_obj, 'created_by', None)
            if candidate and isinstance(candidate, UserModel):
                user_for_log = candidate

        # 2) si no hay creador válido, usar el usuario propietario del device (si existe)
        if user_for_log is None:
            device_user = getattr(device, 'user', None)
            if device_user and isinstance(device_user, UserModel):
                user_for_log = device_user

        # 3) si sigue siendo None, dejar user_for_log == None (campo FK debe permitir null)
        logger.debug("user_for_log chosen: %r (type=%s)", user_for_log, type(user_for_log) if user_for_log else None)

        AccessLog.objects.create(
            lock=lock,
            user=user_for_log,
            device=device,
            access_type='PIN',
            result='SUCCESS' if granted else 'FAIL',
            details=f"Checked by device {getattr(device, 'uid', 'unknown')}"
        )

        if granted:
            device.last_used = now
            device.save(update_fields=['last_used'])
            return Response({"success": True, "detail": "Access granted"}, status=status.HTTP_200_OK)

        return Response({"success": False, "detail": "Access denied"}, status=status.HTTP_403_FORBIDDEN)
    
    @action(detail=False, methods=['post'], url_path='claim')
    def claim_lock(self, request):
        serializer = LockClaimSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            lock = serializer.save()
            return Response(LockSerializer(lock).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get', 'post', 'patch'], url_path='network', permission_classes=[permissions.IsAuthenticated, HasLockRolePermission])
    def network(self, request, uuid=None):
        """
        GET:  Obtener NetworkConfig (si existe) para la lock {uuid}.
        POST: Crear NetworkConfig (si no existe).
        PATCH: Actualizar campos (ssid, password, bluetooth_name).
        Nota: Permisos controlados por HasLockRolePermission (owner/admin).
        """
        lock = self.get_object()  # get_object comprobará permisos por HasLockRolePermission
        try:
            net = lock.network_config
        except NetworkConfig.DoesNotExist:
            net = None

        if request.method == 'GET':
            if not net:
                return Response({}, status=status.HTTP_200_OK)
            return Response(NetworkConfigSerializer(net).data, status=status.HTTP_200_OK)

        # POST o PATCH
        if request.method == 'POST':
            if net:
                return Response({"detail": "NetworkConfig ya existe. Usa PATCH."}, status=status.HTTP_400_BAD_REQUEST)
            serializer = NetworkConfigSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(lock=lock)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        if request.method == 'PATCH':
            if not net:
                return Response({"detail": "No existe NetworkConfig, usa POST."}, status=status.HTTP_400_BAD_REQUEST)
            serializer = NetworkConfigSerializer(net, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class NetworkConfigViewSet(viewsets.ModelViewSet):
    queryset = NetworkConfig.objects.all()
    serializer_class = NetworkConfigSerializer
    permission_classes = [permissions.IsAuthenticated]


class PinViewSet(viewsets.ModelViewSet):
    queryset = Pin.objects.all()
    serializer_class = PinSerializer
    permission_classes = [permissions.IsAuthenticated, HasLockRolePermission]

    def get_queryset(self):
        user = self.request.user
        # marcar expirados (si son temporales y end_time < now)
        now = timezone.now()
        Pin.objects.filter(is_temporary=True, is_active=True, end_time__lt=now).update(is_active=False)

        qs = (Pin.objects.filter(lock__owner=user) | Pin.objects.filter(lock__user_roles__user=user)).distinct()
        # Opcional: solo devolver is_active True
        return qs.filter(is_active=True)

    def perform_create(self, serializer):
        lock = serializer.validated_data['lock']
        user = self.request.user
        # owner/admin only
        if not user_has_allowed_role(lock, user, allowed_names=("propietario", "administrador")) and not user.is_superuser:
            raise PermissionDenied("No tienes permiso para agregar un PIN a esta cerradura.")
        serializer.save(created_by=user)


class DeviceViewSet(viewsets.ModelViewSet):
    queryset = Device.objects.all()
    serializer_class = DeviceSerializer
    permission_classes = [permissions.IsAuthenticated, HasLockRolePermission]

    def get_queryset(self):
        return (
            Device.objects.filter(lock__owner=self.request.user) |
            Device.objects.filter(lock__user_roles__user=self.request.user)
        ).distinct()

    def perform_create(self, serializer):
        lock = serializer.validated_data['lock']
        user = self.request.user
        if not user_has_allowed_role(lock, user, allowed_names=("propietario", "administrador")) and not user.is_superuser:
            raise PermissionDenied("No tienes permiso para agregar un dispositivo a esta cerradura.")
        serializer.save(user=user)


    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def regenerate_api_key(self, request, pk=None):
        device = self.get_object()
        # Solo owner de la lock o admin local puede regenerar
        if not HasLockRolePermission().has_object_permission(request, self, device):
            raise PermissionDenied("No tienes permiso para regenerar esta api_key.")
        import secrets
        device.api_key = secrets.token_hex(32)
        device.save(update_fields=['api_key'])
        return Response({"api_key": device.api_key})


class AccessLogViewSet(viewsets.ModelViewSet):
    queryset = AccessLog.objects.all()
    serializer_class = AccessLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return AccessLog.objects.all()
        
        # Cerraduras del usuario
        owned_locks = Lock.objects.filter(owner=user)
        managed_locks = Lock.objects.filter(user_roles__user=user)

        return AccessLog.objects.filter(lock__in=(owned_locks | managed_locks)).distinct()


class UserRoleViewSet(viewsets.ModelViewSet):
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer
    permission_classes = [permissions.IsAuthenticated, HasLockRolePermission]

    def destroy(self, request, *args, **kwargs):
        """
        Permitir eliminar (desvincular) una asignación.
        """
        return super().destroy(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        # si el role que se quiere asignar es 'propietario' => prohibir
        role_id = request.data.get('role')
        lock_id = request.data.get('lock')
        if role_id and lock_id:
            role = get_object_or_404(Role, pk=role_id)
            lock = get_object_or_404(Lock, pk=lock_id)
            if role.name.lower() in ("propietario", "owner"):
                return Response({"detail": "No se puede asignar el rol propietario desde aquí."}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        # Si se intenta cambiar el rol del usuario propietario (instance.user == lock.owner), prohibir salvo superuser
        if instance.lock.owner and instance.user == instance.lock.owner and not request.user.is_superuser:
            return Response({"detail": "No puedes cambiar el rol del propietario."}, status=status.HTTP_403_FORBIDDEN)

        # Si se intenta asignar role 'propietario' a otro usuario, prohibir
        new_role_id = request.data.get("role")
        if new_role_id:
            new_role = get_object_or_404(Role, pk=new_role_id)
            if new_role.name.lower() in ("propietario", "owner"):
                return Response({"detail": "No se puede asignar el rol propietario desde aquí."}, status=status.HTTP_403_FORBIDDEN)

        return super().update(request, *args, **kwargs)