"""
URL configuration for pos_backend project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from users.views import MeWithUiView, GroupsListCreateView, GroupsDetailView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # JWT Authentication
    path('api/auth/me/', MeWithUiView.as_view(), name='auth_me'),
    path('api/auth/groups/', GroupsListCreateView.as_view(), name='auth_groups'),
    path('api/auth/groups/<int:pk>/', GroupsDetailView.as_view(), name='auth_groups_detail'),
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # API endpoints
    path('api/', include('users.urls')),
    path('api/', include('products.urls')),
    path('api/', include('customers.urls')),
    path('api/', include('sales.urls')),
]

# Media files (development only)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
