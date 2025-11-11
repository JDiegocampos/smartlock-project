# backend/locks/serializers.py
from rest_framework import serializers
from django.utils import timezone
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth import get_user_model
from .models import Role, UserRole, Lock, NetworkConfig, Pin, Device, AccessLog

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = '__all__'


class LockSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)

    class Meta:
        model = Lock
        fields = ['id','name','uuid','owner','location','is_active','created_at']
        read_only_fields = ['created_at','owner']


class NetworkConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = NetworkConfig
        fields = '__all__'

class PinSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)

    class Meta:
        model = Pin
        fields = '__all__'
        read_only_fields = ['created_at', 'created_by']

    def validate(self, data):
        # Si vienen start_time/end_time y USE_TZ True, convertir naive -> aware
        if settings.USE_TZ:
            for k in ("start_time", "end_time"):
                dt = data.get(k)
                if dt and timezone.is_naive(dt):
                    # suponemos que la fecha recibida corresponde a la zona local del servidor
                    data[k] = timezone.make_aware(dt, timezone.get_default_timezone())
        # Validación de consistencia temporal
        if data.get('is_temporary'):
            st = data.get('start_time')
            en = data.get('end_time')
            if not st or not en:
                raise serializers.ValidationError("Los pines temporales requieren start_time y end_time.")
            if st >= en:
                raise serializers.ValidationError("start_time debe ser anterior a end_time.")
        return data


class DeviceSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    api_key = serializers.CharField(read_only=True)

    class Meta:
        model = Device
        fields = ['id','lock','user','device_type','uid','name','is_active','date_added','last_used','api_key']
        read_only_fields = ['date_added','last_used','api_key','user']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['user'] = request.user
        # api_key se genera en el modelo save() si no existe
        return super().create(validated_data)


class AccessLogSerializer(serializers.ModelSerializer):
    lock_uuid = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = AccessLog
        fields = ['id', 'lock', 'lock_uuid', 'user', 'device', 'access_type', 'result', 'timestamp', 'details']
        read_only_fields = ['id', 'timestamp', 'lock', 'user']

    def create(self, validated_data):
        # Extrae el UUID enviado
        uuid = validated_data.pop('lock_uuid', None)
        try:
            lock = Lock.objects.get(uuid=uuid)
        except Lock.DoesNotExist:
            raise serializers.ValidationError("Lock UUID inválido.")

        validated_data['lock'] = lock
        return super().create(validated_data)


class UserRoleSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    role = serializers.PrimaryKeyRelatedField(queryset=Role.objects.all())
    lock = serializers.PrimaryKeyRelatedField(queryset=Lock.objects.all())

    user_detail = UserSerializer(source='user', read_only=True)
    role_detail = RoleSerializer(source='role', read_only=True)
    lock_detail = serializers.StringRelatedField(source='lock', read_only=True)

    class Meta:
        model = UserRole
        fields = ['id', 'user', 'role', 'lock', 'user_detail', 'role_detail', 'lock_detail']

    def validate(self, data):
        """
        Validación de unicidad en create/update.
        Soporta partial updates: si faltan claves (p.e. patch solo role), usa instance + validated or actual fields.
        """
        # Obtener valores candidatos (tolerante a partial)
        user = data.get('user') if 'user' in data else getattr(self.instance, 'user', None)
        role = data.get('role') if 'role' in data else getattr(self.instance, 'role', None)
        lock = data.get('lock') if 'lock' in data else getattr(self.instance, 'lock', None)

        # Si no tenemos todos los datos no validamos (deferir), pero normalmente user+lock deben existir.
        if not (user and role and lock):
            return data

        qs = UserRole.objects.filter(user=user, role=role, lock=lock)
        # Si estamos actualizando, excluir la propia instancia del chequeo
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError("Este usuario ya tiene ese rol en esta cerradura.")
        return data


class LockClaimSerializer(serializers.Serializer):
    uuid = serializers.UUIDField()
    name = serializers.CharField(required=True)
    location = serializers.CharField(required=True)

    def validate_uuid(self, value):
        try:
            lock = Lock.objects.get(uuid=value)
        except Lock.DoesNotExist:
            raise serializers.ValidationError("No existe una cerradura con este UUID.")
        if lock.owner:
            raise serializers.ValidationError("Esta cerradura ya está asignada a otro usuario.")
        return value

    def save(self, **kwargs):
        user = self.context['request'].user
        data = self.validated_data

        lock = Lock.objects.get(uuid=data['uuid'])
        lock.name = data['name']
        lock.location = data['location']
        lock.owner = user
        lock.save()
        return lock
