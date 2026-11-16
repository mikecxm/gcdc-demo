from django.urls import path
from .views import AdminUserCreateView, UserRegisterView

urlpatterns = [
    path("register/", UserRegisterView.as_view(), name="user-register"),
    path("create/", AdminUserCreateView.as_view(), name="admin-user-create"),
]
