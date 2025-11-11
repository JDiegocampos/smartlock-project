# locks/urls.py
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import LockViewSet, PinViewSet, DeviceViewSet, AccessLogViewSet, RoleViewSet, UserRoleViewSet
from accounts.views import UserViewSet

router = DefaultRouter()
router.register('locks', LockViewSet, basename='lock')
router.register('pins', PinViewSet)
router.register('devices', DeviceViewSet)
router.register(r'accesslogs', AccessLogViewSet, basename='accesslog')
router.register('roles', RoleViewSet)
router.register('user-roles', UserRoleViewSet)
router.register(r'lock-users', UserViewSet, basename='user')

urlpatterns = [
    path('', include(router.urls)),
]
