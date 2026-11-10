"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
"""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),

    # API v1 - Módulos de dominio GCDC (Pre-registro para aislamiento entre ramas)
    path('api/v1/users/', include('apps.users.urls')),
    path('api/v1/conferences/', include('apps.conferences.urls')),
    path('api/v1/articles/', include('apps.articles.urls')),
    path('api/v1/reviews/', include('apps.reviews.urls')),
]
