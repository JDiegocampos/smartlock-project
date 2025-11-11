from rest_framework import permissions
from .models import UserRole, Device
from django.contrib.auth import get_user_model

class HasLockRolePermission(permissions.BasePermission):
    """
    Permisos basados únicamente en UserRole (rol por cerradura) y Lock.owner.
    """
    def has_object_permission(self, request, view, obj):
        user = request.user

        # Solo usuarios autenticados (salvo endpoints especiales)
        if not user or not user.is_authenticated:
            return False

        # Obtener la cerradura asociada
        lock = getattr(obj, 'lock', None)
        if lock is None and obj.__class__.__name__ == 'Lock':
            lock = obj
        if lock is None:
            return False

        # Owner de la cerradura tiene control total
        if lock.owner == user:
            return True

        # Buscar rol local
        try:
            user_role = UserRole.objects.get(user=user, lock=lock)
        except UserRole.DoesNotExist:
            return False

        role_name = user_role.role.name.lower()

        # Invitado -> solo lectura
        if role_name == 'invitado':
            return request.method in permissions.SAFE_METHODS

        # Administrador -> puede gestionar dispositivos, pines y usuarios; no puede eliminar la cerradura
        if role_name == 'administrador':
            if lock.__class__.__name__ == 'Lock':
                return request.method in permissions.SAFE_METHODS
            return True

        # Propietario -> control total
        if role_name == 'propietario':
            return True

        return False


class IsLockOwnerOrHasRole(permissions.BasePermission):
    """
    Permite acceso si el usuario es propietario o tiene cualquier rol en la cerradura.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user
        lock = getattr(obj, 'lock', None)
        if lock is None and obj.__class__.__name__ == 'Lock':
            lock = obj
        if lock is None:
            return False
        if lock.owner == user:
            return True
        return UserRole.objects.filter(user=user, lock=lock).exists()

UserModel = get_user_model()

class DeviceAPIKeyPermission(permissions.BasePermission):
    """
    Valida la cabecera X-API-KEY y asocia request.device para uso posterior.
    No requiere JWT; usado únicamente en endpoints firmware como validate_pin.
    """
    def has_permission(self, request, view):
        api_key = request.headers.get('X-API-KEY') or request.META.get('HTTP_X_API_KEY')
        if not api_key:
            return False

        device = Device.objects.filter(api_key=api_key, is_active=True).first()
        if not device:
            return False

        # Attach device to request for view usage
        request.device = device

        # Optionally set request.user to the device owner only if it's a real User instance
        device_user = getattr(device, 'user', None)
        if device_user and isinstance(device_user, UserModel):
            # <-- only set if it's a real User model instance
            request.user = device_user

        return True

def user_has_allowed_role(lock, user, allowed_names=("propietario", "administrador", "owner", "admin")):
    """
    Retorna True si user es owner OR tiene un UserRole en la lock
    con role__name en allowed_names (case-insensitive).
    """
    if not user or not lock:
        return False
    # owner check
    if lock.owner and lock.owner == user:
        return True
    # role name check (case-insensitive)
    return lock.user_roles.filter(user=user, role__name__in=allowed_names).exists()