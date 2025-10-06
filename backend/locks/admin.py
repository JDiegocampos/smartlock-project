from django.contrib import admin
from .models import Device

@admin.action(description='Regenerate api_key for selected devices')
def regenerate_api_key(modeladmin, request, queryset):
    import secrets
    for device in queryset:
        device.api_key = secrets.token_hex(32)
        device.save(update_fields=['api_key'])

@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ('id','name','uid','device_type','lock','user','is_active','api_key')
    actions = [regenerate_api_key]
