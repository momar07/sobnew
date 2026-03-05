from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

# ✅ إصلاح Import المكرر — شيلنا Q المكررة
from django.db.models import Q, Sum, Count, F, Avg, ExpressionWrapper, DecimalField

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
    queryset = Sale.objects.select_related(
        'customer', 'user'
    ).prefetch_related('items').all()
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

        # ✅ إصلاح superuser — يشوف كل المبيعات بدون فلترة
        if user.is_superuser:
            return queryset

        # Manager (team) يشوف مبيعاته + مبيعات فريقه
        if user.has_perm('users.sales_view_team'):
            return queryset.filter(
                Q(user=user) | Q(user__profile__manager=user)
            )

        # Cashier يشوف مبيعاته بس
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

        # ✅ إصلاح N+1 Query — حساب total_profit على مستوى الـ Database
        # بدل ما نجيب كل sale وكل items في Python
        # بنحسبه في query واحدة على الـ DB مباشرة
        total_profit = SaleItem.objects.filter(
            sale__in=base_queryset.filter(status='completed'),
            product__isnull=False
        ).annotate(
            item_profit=ExpressionWrapper(
                (F('price') - F('product__cost')) * F('quantity'),
                output_field=DecimalField(max_digits=10, decimal_places=2)
            )
        ).aggregate(
            total=Sum('item_profit')
        )['total'] or 0

        # أكثر المنتجات مبيعاً
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

        # ✅ إصلاح Division by Zero — استخدام Avg بدل Sum/Count
        # Avg بيرجع None تلقائياً لو مفيش rows بدل ما يعمل ZeroDivisionError
        stats = sales.aggregate(
            total_sales=Sum('total'),
            total_count=Count('id'),
            avg_sale=Avg('total')        # ✅ آمن تماماً حتى لو sales فاضية
        )

        return Response({
            'sales': serializer.data,
            'stats': {
                'total_sales': stats['total_sales'] or 0,
                'total_count': stats['total_count'] or 0,
                'avg_sale':    stats['avg_sale'] or 0,
            }
        })

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """إلغاء عملية بيع"""
        # RBAC
        user = request.user
        if not (user.is_superuser or user.has_perm('users.sales_cancel')):
            return Response(
                {'detail': 'Not authorized'},
                status=status.HTTP_403_FORBIDDEN
            )

        sale = self.get_object()

        if sale.status == 'cancelled':
            return Response(
                {'error': 'عملية البيع ملغاة مسبقاً'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ✅ إصلاح Race Condition — إرجاع المخزون في عملية atomic
        # بنستخدم F() expression بدل القراءة والكتابة في خطوتين
        for item in sale.items.select_related('product').all():
            if item.product:
                from products.models import Product
                Product.objects.filter(
                    id=item.product.id
                ).update(
                    stock=F('stock') + item.quantity
                )

        # تحديث بيانات العميل
        if sale.customer:
            sale.customer.total_purchases -= sale.total
            # ✅ منع الـ points من الوقوع تحت الصفر
            sale.customer.points = max(
                0,
                sale.customer.points - int(sale.total)
            )
            sale.customer.save()

        sale.status = 'cancelled'
        sale.save()

        serializer = self.get_serializer(sale)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def returns(self, request, pk=None):
        """الحصول على المرتجعات الخاصة بفاتورة معينة"""
        # RBAC
        user = request.user
        if not (user.is_superuser or user.has_perm('users.returns_create')):
            return Response(
                {'detail': 'Not authorized'},
                status=status.HTTP_403_FORBIDDEN
            )

        sale = self.get_object()
        returns = Return.objects.filter(
            sale=sale
        ).prefetch_related('items')
        serializer = ReturnListSerializer(returns, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def returnable_items(self, request, pk=None):
        """الحصول على الأصناف القابلة للإرجاع مع الكميات المتبقية"""
        # RBAC
        user = request.user
        if not (user.is_superuser or user.has_perm('users.returns_create')):
            return Response(
                {'detail': 'Not authorized'},
                status=status.HTTP_403_FORBIDDEN
            )

        from django.db.models import Sum
        from .models import ReturnItem

        sale = self.get_object()
        items_data = []

        for sale_item in sale.items.all():
            previous_returns = ReturnItem.objects.filter(
                sale_item=sale_item,
                return_obj__status='completed'
            ).aggregate(total_returned=Sum('quantity'))

            total_returned = previous_returns['total_returned'] or 0
            remaining_quantity = sale_item.quantity - total_returned

            items_data.append({
                'sale_item_id':      str(sale_item.id),
                'product_name':      sale_item.product_name,
                'original_quantity': sale_item.quantity,
                'returned_quantity': total_returned,
                'remaining_quantity': remaining_quantity,
                'price':             str(sale_item.price),
            })

        return Response(items_data)
