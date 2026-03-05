from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from .models import Category, Product
from .serializers import (
    CategorySerializer, 
    ProductSerializer, 
    ProductListSerializer
)


class CategoryViewSet(viewsets.ModelViewSet):
    """ViewSet لإدارة الفئات"""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']


class ProductViewSet(viewsets.ModelViewSet):
    """ViewSet لإدارة المنتجات"""
    queryset = Product.objects.select_related('category').all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]

    def _require_perm(self, request, perm_codename):
        if request.user.is_superuser or request.user.has_perm(f'users.{perm_codename}'):
            return
        raise PermissionDenied('Not authorized')

    def get_queryset(self):
        user = self.request.user
        if not (user.is_superuser or user.has_perm('users.products_view') or user.has_perm('users.products_manage')):
            return Product.objects.none()
        return super().get_queryset()

    def perform_create(self, serializer):
        self._require_perm(self.request, 'products_manage')
        return super().perform_create(serializer)

    def perform_update(self, serializer):
        self._require_perm(self.request, 'products_manage')
        return super().perform_update(serializer)

    def perform_destroy(self, instance):
        self._require_perm(self.request, 'products_manage')
        return super().perform_destroy(instance)
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_active']
    search_fields = ['name', 'barcode']
    ordering_fields = ['name', 'price', 'stock', 'created_at']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ProductListSerializer
        return ProductSerializer
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """المنتجات ذات المخزون المنخفض"""
        products = self.queryset.filter(stock__lt=10, is_active=True)
        serializer = self.get_serializer(products, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def adjust_stock(self, request, pk=None):
        """تعديل المخزون"""
        product = self.get_object()
        adjustment = request.data.get('adjustment', 0)
        
        try:
            adjustment = int(adjustment)
            product.stock += adjustment
            product.save()
            serializer = self.get_serializer(product)
            return Response(serializer.data)
        except ValueError:
            return Response(
                {'error': 'قيمة التعديل غير صحيحة'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def by_barcode(self, request):
        """البحث بالباركود"""
        barcode = request.query_params.get('barcode', '')
        if not barcode:
            return Response(
                {'error': 'الباركود مطلوب'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            product = Product.objects.get(barcode=barcode, is_active=True)
            serializer = self.get_serializer(product)
            return Response(serializer.data)
        except Product.DoesNotExist:
            return Response(
                {'error': 'المنتج غير موجود'},
                status=status.HTTP_404_NOT_FOUND
            )
