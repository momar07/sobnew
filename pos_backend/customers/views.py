from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from .models import Customer
from .serializers import CustomerSerializer, CustomerListSerializer


class CustomerViewSet(viewsets.ModelViewSet):
    """ViewSet لإدارة العملاء"""
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]

    def _require_perm(self, request, perm_codename):
        if request.user.is_superuser or request.user.has_perm(f'users.{perm_codename}'):
            return
        raise PermissionDenied('Not authorized')

    def get_queryset(self):
        # RBAC: allow viewing only if has view/manage
        user = self.request.user
        if not (user.is_superuser or user.has_perm('users.customers_view') or user.has_perm('users.customers_manage') or user.has_perm('users.sales_create') or user.has_perm('users.sales_manage')):
            return Customer.objects.none()
        return super().get_queryset()

    def perform_create(self, serializer):
        self._require_perm(self.request, 'customers_manage')
        return super().perform_create(serializer)

    def perform_update(self, serializer):
        self._require_perm(self.request, 'customers_manage')
        return super().perform_update(serializer)

    def perform_destroy(self, instance):
        self._require_perm(self.request, 'customers_manage')
        return super().perform_destroy(instance)
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'phone', 'email']
    ordering_fields = ['name', 'total_purchases', 'created_at']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return CustomerListSerializer
        return CustomerSerializer
    
    @action(detail=False, methods=['get'])
    def top_customers(self, request):
        """أفضل العملاء حسب المشتريات"""
        limit = int(request.query_params.get('limit', 10))
        customers = self.queryset.order_by('-total_purchases')[:limit]
        serializer = self.get_serializer(customers, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_phone(self, request):
        """البحث برقم الهاتف"""
        phone = request.query_params.get('phone', '')
        if not phone:
            return Response(
                {'error': 'رقم الهاتف مطلوب'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            customer = Customer.objects.get(phone=phone)
            serializer = CustomerSerializer(customer)
            return Response(serializer.data)
        except Customer.DoesNotExist:
            return Response(
                {'error': 'العميل غير موجود'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'])
    def add_points(self, request, pk=None):
        """إضافة نقاط للعميل"""
        customer = self.get_object()
        points = request.data.get('points', 0)
        
        try:
            points = int(points)
            customer.points += points
            customer.save()
            serializer = self.get_serializer(customer)
            return Response(serializer.data)
        except ValueError:
            return Response(
                {'error': 'قيمة النقاط غير صحيحة'},
                status=status.HTTP_400_BAD_REQUEST
            )
