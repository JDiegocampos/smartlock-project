# locks/views.py
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone
from django.db.models import Q
from .models import Role, UserRole, Lock, NetworkConfig, Pin, Device, AccessLog
from .serializers import (
    RoleSerializer, UserRoleSerializer, LockSerializer,
    NetworkConfigSerializer, PinSerializer, DeviceSerializer, AccessLogSerializer
)
from .permissions import HasLockRolePermission, IsLockOwnerOrHasRole

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

    @action(detail=True, methods=['post'], permission_classes=[permissions.AllowAny])
    def validate_pin(self, request, uuid=None):
        lock = self.get_object()

        # Validar API Key desde header X-API-KEY
        api_key = request.headers.get('X-API-KEY') or request.META.get('HTTP_X_API_KEY')
        if not api_key:
            return Response({"detail": "X-API-KEY required"}, status=status.HTTP_403_FORBIDDEN)

        device = Device.objects.filter(api_key=api_key, lock=lock, is_active=True).first()
        if not device:
            return Response({"detail":"Invalid API key or device not allowed for this lock"}, status=status.HTTP_403_FORBIDDEN)

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

        # Crear AccessLog
        AccessLog.objects.create(
            lock=lock,
            user=pin_obj.created_by if pin_obj else None,
            device=device,
            access_type='PIN',
            result='SUCCESS' if granted else 'FAIL',
            details=f"Checked by device {device.uid}"
        )

        if granted:
            # Actualizar last_used del device (opcional)
            device.last_used = now
            device.save(update_fields=['last_used'])
            return Response({"success": True, "detail": "Access granted"}, status=status.HTTP_200_OK)
        return Response({"success": False, "detail": "Access denied"}, status=status.HTTP_403_FORBIDDEN)


class NetworkConfigViewSet(viewsets.ModelViewSet):
    queryset = NetworkConfig.objects.all()
    serializer_class = NetworkConfigSerializer
    permission_classes = [permissions.IsAuthenticated]


class PinViewSet(viewsets.ModelViewSet):
    queryset = Pin.objects.all()
    serializer_class = PinSerializer
    permission_classes = [permissions.IsAuthenticated, HasLockRolePermission]

    def get_queryset(self):
        return Pin.objects.filter(lock__owner=self.request.user) | Pin.objects.filter(lock__user_roles__user=self.request.user)

    def perform_create(self, serializer):
        lock = serializer.validated_data['lock']
        user = self.request.user

        # Verificar si tiene permiso para crear
        if not HasLockRolePermission().has_object_permission(self.request, self, lock):
            raise PermissionDenied("No tienes permiso para agregar un PIN a esta cerradura.")
        serializer.save(created_by=user)


class DeviceViewSet(viewsets.ModelViewSet):
    queryset = Device.objects.all()
    serializer_class = DeviceSerializer
    permission_classes = [permissions.IsAuthenticated, HasLockRolePermission]

    def get_queryset(self):
        return Device.objects.filter(lock__owner=self.request.user) | Device.objects.filter(lock__user_roles__user=self.request.user)

    def perform_create(self, serializer):
        lock = serializer.validated_data['lock']
        user = self.request.user
        if not HasLockRolePermission().has_object_permission(self.request, self, lock):
            raise PermissionDenied("No tienes permiso para agregar un dispositivo a esta cerradura.")
        serializer.save(user=user)


class AccessLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Solo lectura: los registros no deben crearse manualmente.
    """
    queryset = AccessLog.objects.all().order_by('-timestamp')
    serializer_class = AccessLogSerializer
    permission_classes = [permissions.IsAuthenticated, HasLockRolePermission]

    def get_queryset(self):
        user = self.request.user
        return AccessLog.objects.filter(
            Q(lock__owner=user) | Q(lock__user_roles__user=user)
        ).distinct()


class UserRoleViewSet(viewsets.ModelViewSet):
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer
    permission_classes = [permissions.IsAuthenticated]
