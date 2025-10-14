from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import Profile
from .serializers import UserSerializer, UserRegisterSerializer, UserRoleUpdateSerializer

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
    permission_classes = [IsOwnerOrAdmin]


# Listar usuarios
class UserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsOwnerOrAdmin]


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
