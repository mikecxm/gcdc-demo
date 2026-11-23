from django.urls import path
from .views import AdminUserCreateView, UserDetailView, UserListView, UserRegisterView

urlpatterns = [
    path("", UserListView.as_view(), name="user-list"),
    path("<int:pk>/", UserDetailView.as_view(), name="user-detail"),
    path("register/", UserRegisterView.as_view(), name="user-register"),
    path("create/", AdminUserCreateView.as_view(), name="admin-user-create"),
]
