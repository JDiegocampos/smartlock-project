from rest_framework import serializers
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
        fields = ['id','name','uuid','owner','location','is_active','last_sync','created_at']
        read_only_fields = ['created_at','owner','last_sync']


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
    user = UserSerializer(read_only=True)
    role = RoleSerializer(read_only=True)
    lock = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = UserRole
        fields = '__all__'
