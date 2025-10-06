from rest_framework import permissions
from .models import UserRole


class HasLockRolePermission(permissions.BasePermission):
    """
    Verifica los permisos de un usuario según su rol asignado a una cerradura.
    """

    def has_object_permission(self, request, view, obj):
        """
        Evalúa si el usuario tiene permiso sobre un objeto asociado a una cerradura.
        - obj puede ser Lock, Pin, Device o AccessLog
        """
        user = request.user

        # Obtener la cerradura asociada
        lock = None
        if hasattr(obj, 'lock'):
            lock = obj.lock
        elif obj.__class__.__name__ == 'Lock':
            lock = obj
        else:
            return False

        # El propietario siempre tiene control total
        if lock.owner == user:
            return True

        # Buscar si el usuario tiene un rol asociado a la cerradura
        try:
            user_role = UserRole.objects.get(user=user, lock=lock)
        except UserRole.DoesNotExist:
            return False

        role_name = user_role.role.name.lower()

        # --- REGLAS DE PERMISOS POR ROL ---
        # Invitado → Solo lectura
        if role_name == 'invitado':
            return request.method in permissions.SAFE_METHODS

        # Administrador → No puede eliminar ni editar la cerradura
        if role_name == 'administrador':
            if lock.__class__.__name__ == 'Lock':
                return request.method in permissions.SAFE_METHODS
            else:
                return True  # Puede modificar pines, dispositivos, etc.

        # Propietario → control total
        if role_name == 'propietario':
            return True

        # Si el rol no es reconocido, negar
        return False


class IsLockOwnerOrHasRole(permissions.BasePermission):
    """
    Verifica si el usuario es propietario o tiene un rol asignado para acceder a objetos relacionados con una cerradura.
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user

        lock = None
        if hasattr(obj, 'lock'):
            lock = obj.lock
        elif obj.__class__.__name__ == 'Lock':
            lock = obj
        else:
            return False

        if lock.owner == user:
            return True

        # Buscar un rol asociado
        return UserRole.objects.filter(user=user, lock=lock).exists()
