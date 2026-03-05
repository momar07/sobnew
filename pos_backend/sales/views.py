from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q,  Sum, Count, F, Q
from django.utils import timezone
from datetime import timedelta
from .models import Sale, SaleItem, Return
from .serializers import (
    SaleSerializer, 
    SaleListSerializer,
    SalesStatsSerializer
)
from .serializers_returns import ReturnListSerializer


class SaleViewSet(viewsets.ModelViewSet):
    """ViewSet لإدارة المبيعات"""
    queryset = Sale.objects.select_related('customer', 'user').prefetch_related('items').all()
    serializer_class = SaleSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'payment_method', 'customer']
    search_fields = ['customer__name', 'id']
    ordering_fields = ['created_at', 'total']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """فلترة العمليات حسب صلاحية المستخدم"""
        queryset = super().get_queryset()
        user = self.request.user
        
        # RBAC permissions
        # Manager (team) sees own + team
        if user.is_superuser or user.has_perm('users.sales_view_team'):
            return queryset.filter(Q(user=user) | Q(user__profile__manager=user))
        
        # Cashier (own) sees only own
        if user.has_perm('users.sales_view_own'):
            return queryset.filter(user=user)

        # Default deny
        return queryset.none()
    
    def get_serializer_class(self):
        if self.action == 'list':
            return SaleListSerializer
        return SaleSerializer
    
    def perform_create(self, serializer):
        """حفظ المستخدم والشيفت الحالي مع عملية البيع"""
        from .models_cashregister import CashRegister
        
        # البحث عن الشيفت المفتوح للمستخدم
        cash_register = None
        if self.request.user.is_authenticated:
            cash_register = CashRegister.objects.filter(
                user=self.request.user,
                status='open'
            ).first()
        
        serializer.save(
            user=self.request.user if self.request.user.is_authenticated else None,
            cash_register=cash_register
        )
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """إحصائيات المبيعات"""
        now = timezone.now()
        today = now.date()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        
        # استخدام get_queryset للفلترة حسب المستخدم
        base_queryset = self.get_queryset()
        
        # مبيعات اليوم
        today_sales = base_queryset.filter(
            created_at__date=today,
            status='completed'
        ).aggregate(
            total=Sum('total'),
            count=Count('id')
        )
        
        # مبيعات الأسبوع
        week_sales = base_queryset.filter(
            created_at__date__gte=week_ago,
            status='completed'
        ).aggregate(total=Sum('total'))
        
        # مبيعات الشهر
        month_sales = base_queryset.filter(
            created_at__date__gte=month_ago,
            status='completed'
        ).aggregate(total=Sum('total'))
        
        # إجمالي الأرباح
        completed_sales = base_queryset.filter(status='completed')
        total_profit = sum([sale.total_profit for sale in completed_sales])
        
        # أكثر المنتجات مبيعاً (للمستخدم الحالي أو للكل)
        top_products = SaleItem.objects.filter(
            sale__in=base_queryset,
            sale__status='completed',
            sale__created_at__date__gte=month_ago
        ).values(
            'product__name'
        ).annotate(
            total_quantity=Sum('quantity'),
            total_sales=Sum('subtotal')
        ).order_by('-total_quantity')[:5]
        
        # أحدث المبيعات
        recent_sales = base_queryset.filter(
            status='completed'
        ).order_by('-created_at')[:10]
        
        data = {
            'today_sales': today_sales['total'] or 0,
            'today_count': today_sales['count'] or 0,
            'week_sales': week_sales['total'] or 0,
            'month_sales': month_sales['total'] or 0,
            'total_profit': total_profit,
            'top_products': list(top_products),
            'recent_sales': recent_sales
        }
        
        serializer = SalesStatsSerializer(data)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_date_range(self, request):
        """المبيعات حسب فترة زمنية"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not start_date or not end_date:
            return Response(
                {'error': 'تاريخ البداية والنهاية مطلوبان'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        sales = self.get_queryset().filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
            status='completed'
        )
        
        serializer = self.get_serializer(sales, many=True)
        
        # إحصائيات الفترة
        stats = sales.aggregate(
            total_sales=Sum('total'),
            total_count=Count('id'),
            avg_sale=Sum('total') / Count('id') if sales.count() > 0 else 0
        )
        
        return Response({
            'sales': serializer.data,
            'stats': stats
        })
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        # RBAC
        user = request.user
        if not (user.is_superuser or user.has_perm('users.sales_cancel')):
            return Response({'detail': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        """إلغاء عملية بيع"""
        sale = self.get_object()
        
        if sale.status == 'cancelled':
            return Response(
                {'error': 'عملية البيع ملغاة مسبقاً'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # إرجاع المخزون
        for item in sale.items.all():
            if item.product:
                item.product.stock += item.quantity
                item.product.save()
        
        # تحديث بيانات العميل
        if sale.customer:
            sale.customer.total_purchases -= sale.total
            sale.customer.points -= int(sale.total)
            sale.customer.save()
        
        sale.status = 'cancelled'
        sale.save()
        
        serializer = self.get_serializer(sale)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def returns(self, request, pk=None):
        # RBAC
        user = request.user
        if not (user.is_superuser or user.has_perm('users.returns_create')):
            return Response({'detail': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        """الحصول على المرتجعات الخاصة بفاتورة معينة"""
        sale = self.get_object()
        returns = Return.objects.filter(sale=sale).prefetch_related('items')
        serializer = ReturnListSerializer(returns, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def returnable_items(self, request, pk=None):
        # RBAC
        user = request.user
        if not (user.is_superuser or user.has_perm('users.returns_create')):
            return Response({'detail': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        """الحصول على الأصناف القابلة للإرجاع مع الكميات المتبقية"""
        from django.db.models import Q,  Sum
        from .models import ReturnItem
        
        sale = self.get_object()
        items_data = []
        
        for sale_item in sale.items.all():
            # حساب الكمية المرتجعة مسبقاً
            previous_returns = ReturnItem.objects.filter(
                sale_item=sale_item,
                return_obj__status='completed'
            ).aggregate(total_returned=Sum('quantity'))
            
            total_returned = previous_returns['total_returned'] or 0
            remaining_quantity = sale_item.quantity - total_returned
            
            items_data.append({
                'sale_item_id': str(sale_item.id),
                'product_name': sale_item.product_name,
                'original_quantity': sale_item.quantity,
                'returned_quantity': total_returned,
                'remaining_quantity': remaining_quantity,
                'price': str(sale_item.price),
            })
        
        return Response(items_data)
