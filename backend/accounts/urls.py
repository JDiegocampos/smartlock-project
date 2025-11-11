# backend/accounts/urls.py
from django.urls import path
from .views import UserRegisterView, UserListView, UserRoleUpdateView

urlpatterns = [
    path('register/', UserRegisterView.as_view(), name='user-register'),
    path('', UserListView.as_view(), name='user-list'),
    path('<int:pk>/role/', UserRoleUpdateView.as_view(), name='user-role-update'),
]
