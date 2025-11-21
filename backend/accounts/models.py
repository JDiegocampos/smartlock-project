from django.db import models
from django.contrib.auth.models import User
from django.contrib.auth import get_user_model
import uuid
from django.utils import timezone
from datetime import timedelta

class Profile(models.Model):
    ROLE_CHOICES = [
        ('owner', 'Propietario'),
        ('admin', 'Administrador'),
        ('guest', 'Invitado'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='guest')

    def __str__(self):
        return f"{self.user.username} - {self.get_role_display()}"

User = get_user_model()

class TwoFactorConfig(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="twofactor")
    secret = models.CharField(max_length=64, blank=True, null=True)  # base32 secret
    is_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"2FA config for {self.user.username}"

class TwoFactorChallenge(models.Model):
    """
    Challenge temporario generado durante el login si el usuario tiene 2FA activo.
    El frontend enviará este challenge junto con el código TOTP para obtener tokens.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="twofactor_challenges")
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    used = models.BooleanField(default=False)

    @property
    def expired(self):
        # expira en 5 minutos
        return timezone.now() > self.created_at + timedelta(minutes=5)
