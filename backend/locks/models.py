# backend/locks/models.py
from django.db import models
from django.contrib.auth.models import User
import secrets
import uuid
from django.conf import settings

# ROLES Y PERMISOS
class Role(models.Model):
    """
    Define los diferentes roles del sistema (ej: administrador, propietario, invitado, técnico).
    """
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name


class UserRole(models.Model):
    """
    Asigna uno o varios roles a los usuarios.
    Un usuario puede tener diferentes roles en diferentes cerraduras.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    lock = models.ForeignKey("Lock", on_delete=models.CASCADE, related_name="user_roles")

    class Meta:
        unique_together = ('user', 'role', 'lock')
        verbose_name = "User Role"
        verbose_name_plural = "User Roles"

    def __str__(self):
        return f"{self.user.username} - {self.role.name} ({self.lock.name})"


# CERRADURA (LOCK)
class Lock(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    name = models.CharField(max_length=100, blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True, related_name='owned_locks'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name or 'Cerradura sin nombre'} ({self.uuid})"


# CONFIGURACIÓN DE RED
class NetworkConfig(models.Model):
    """
    Configuración WiFi o Bluetooth asociada a la cerradura.
    """
    lock = models.OneToOneField(Lock, on_delete=models.CASCADE, related_name='network_config')
    ssid = models.CharField(max_length=100)
    password = models.CharField(max_length=100)
    bluetooth_name = models.CharField(max_length=100, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"NetworkConfig for {self.lock.name}"


# PINES DE ACCESO
class Pin(models.Model):
    """
    Códigos de acceso. Pueden ser permanentes o temporales.
    """
    lock = models.ForeignKey(Lock, on_delete=models.CASCADE, related_name='pins')
    code = models.CharField(max_length=10)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    is_temporary = models.BooleanField(default=False)
    start_time = models.DateTimeField(blank=True, null=True)
    end_time = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('lock', 'code')

    def __str__(self):
        return f"PIN {self.code} ({'Temp' if self.is_temporary else 'Perm'}) - {self.lock.name}"


# DISPOSITIVOS AUTORIZADOS
class Device(models.Model):
    """
    Dispositivos móviles, NFC o RFID autorizados para abrir la cerradura.
    """
    DEVICE_TYPES = [
        ('MOBILE', 'Mobile'),
        ('NFC', 'NFC Card'),
        ('RFID', 'RFID Tag'),
    ]

    lock = models.ForeignKey(Lock, on_delete=models.CASCADE, related_name='devices')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='devices')
    device_type = models.CharField(max_length=10, choices=DEVICE_TYPES)
    uid = models.CharField(max_length=100, unique=True)  # Identificador físico o token del dispositivo
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    date_added = models.DateTimeField(auto_now_add=True)
    last_used = models.DateTimeField(blank=True, null=True)
    api_key = models.CharField(max_length=64, unique=True, blank=True, null=True)

    def save(self, *args, **kwargs):
        # Si no tiene api_key, se genera automáticamente
        if not self.api_key:
            self.api_key = secrets.token_hex(32)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.device_type}) - {self.lock.name}"


# REGISTRO DE ACCESOS
class AccessLog(models.Model):
    """
    Registra cada intento o acceso a la cerradura.
    """
    ACCESS_TYPES = [
        ('PIN', 'PIN Code'),
        ('NFC', 'NFC Card'),
        ('RFID', 'RFID Tag'),
        ('MOBILE', 'Mobile App'),
    ]

    RESULT_CHOICES = [
        ('SUCCESS', 'Access Granted'),
        ('FAIL', 'Access Denied'),
    ]

    lock = models.ForeignKey(Lock, on_delete=models.CASCADE, related_name='access_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    device = models.ForeignKey(Device, on_delete=models.SET_NULL, null=True, blank=True)
    access_type = models.CharField(max_length=10, choices=ACCESS_TYPES)
    result = models.CharField(max_length=10, choices=RESULT_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"[{self.lock.name}] {self.access_type} - {self.result} ({self.timestamp})"
