from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Lock, UserRole, Role

@receiver(post_save, sender=Lock)
def create_owner_userrole(sender, instance, created, **kwargs):
    """
    Cuando se crea una cerradura, asegurar que exista un UserRole con rol 'Propietario'
    para el owner de la cerradura.
    """
    if not created:
        return

    # Buscar o crear Role 'Propietario'
    role_obj, _ = Role.objects.get_or_create(name='Propietario')
    # Crear UserRole solo si no existe
    UserRole.objects.get_or_create(user=instance.owner, lock=instance, role=role_obj)
