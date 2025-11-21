# backend/accounts/urls.py
from django.urls import path
from .views import UserRegisterView, UserListView, UserRoleUpdateView, TwoFactorSetupView, TwoFactorConfirmView, TwoFactorDisableView, TokenChallengeView, Token2FAVerifyView

urlpatterns = [
    path('register/', UserRegisterView.as_view(), name='user-register'),
    path('', UserListView.as_view(), name='user-list'),
    path('<int:pk>/role/', UserRoleUpdateView.as_view(), name='user-role-update'),
    path('2fa/setup/', TwoFactorSetupView.as_view(), name='2fa-setup'),
    path('2fa/confirm/', TwoFactorConfirmView.as_view(), name='2fa-confirm'),
    path('2fa/disable/', TwoFactorDisableView.as_view(), name='2fa-disable'),
    path('token/2fa-challenge/', TokenChallengeView.as_view(), name='token-challenge'),
    path('token/2fa-verify/', Token2FAVerifyView.as_view(), name='token-2fa-verify'),
]
