from django.urls import path
from .views import AdminUserCreateView, UserListView, UserRegisterView

urlpatterns = [
    path("", UserListView.as_view(), name="user-list"),
    path("register/", UserRegisterView.as_view(), name="user-register"),
    path("create/", AdminUserCreateView.as_view(), name="admin-user-create"),
]
