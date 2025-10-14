from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile


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
    role = serializers.ChoiceField(choices=Profile.ROLE_CHOICES, write_only=True)
    assigned_role = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'role', 'assigned_role']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        role = validated_data.pop('role')
        user = User.objects.create_user(**validated_data)

        # Actualizar el rol en el perfil existente
        user.profile.role = role
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