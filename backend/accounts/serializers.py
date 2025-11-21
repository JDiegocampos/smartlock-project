# backend/accounts/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import TwoFactorConfig

User = get_user_model()

class TwoFactorSetupSerializer(serializers.Serializer):
    # devuelve otpauth_url para generar QR en frontend
    otpauth_url = serializers.CharField(read_only=True)

class TwoFactorVerifySerializer(serializers.Serializer):
    challenge = serializers.CharField()
    code = serializers.CharField()

class TwoFactorEnableSerializer(serializers.Serializer):
    code = serializers.CharField()  # used to confirm enabling

class TwoFactorDisableSerializer(serializers.Serializer):
    code = serializers.CharField()

class UserSerializer(serializers.ModelSerializer):
    """
    Serializador para mostrar información básica del usuario.
    Incluye el rol proveniente del modelo Profile.
    """
    role = serializers.CharField(source='profile.role', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role']


class UserRegisterSerializer(serializers.ModelSerializer):
    """
    Serializador para registrar nuevos usuarios.
    Crea el usuario y actualiza el rol en el Profile (creado automáticamente por el signal).
    """
    class Meta:
        model = User
        fields = ['username', 'email', 'password']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        user.profile.role = 'guest'
        user.profile.save()
        return user

    def get_assigned_role(self, obj):
        # Devuelve el rol del perfil para mostrarlo en la respuesta
        return obj.profile.role


class UserRoleUpdateSerializer(serializers.Serializer):
    """
    Serializador para actualizar el rol de un usuario existente.
    """
    role = serializers.ChoiceField(choices=Profile.ROLE_CHOICES)