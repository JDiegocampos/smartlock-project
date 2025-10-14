from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import Profile

User = get_user_model()

@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance, created, **kwargs):
    """
    Cada vez que se crea (o guarda) un User, aseguramos que exista su Profile.
    Esto evita RelatedObjectDoesNotExist when accessing user.profile.
    """
    if created:
        # Crear profile con rol por defecto 'guest'
        Profile.objects.create(user=instance)
    else:
        # En caso de usuarios existentes sin profile, crearlo si no existe
        try:
            _ = instance.profile
        except Profile.DoesNotExist:
            Profile.objects.create(user=instance)
