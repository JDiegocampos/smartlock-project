# locks/urls.py
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import LockViewSet, PinViewSet, DeviceViewSet, AccessLogViewSet, RoleViewSet, UserRoleViewSet

router = DefaultRouter()
router.register('locks', LockViewSet, basename='lock')
router.register('pins', PinViewSet)
router.register('devices', DeviceViewSet)
router.register('access-logs', AccessLogViewSet)
router.register('roles', RoleViewSet)
router.register('user-roles', UserRoleViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
