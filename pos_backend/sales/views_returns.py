from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.db.models import Sum, Count, Q
from .models import Return, ReturnItem
from .serializers_returns import ReturnSerializer, ReturnListSerializer


class ReturnViewSet(viewsets.ModelViewSet):
    """ViewSet للمرتجعات"""
    queryset = Return.objects.all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ReturnListSerializer
        return ReturnSerializer
    
    def get_queryset(self):
        queryset = Return.objects.select_related('sale', 'user').prefetch_related('items')
        
        # فلترة حسب الحالة
        status_param = self.request.query_params.get('status', None)
        if status_param:
            queryset = queryset.filter(status=status_param)
        
        # فلترة حسب التاريخ
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)

        # RBAC scope: manager sees own + team, cashier sees own
        user = self.request.user
        if user.is_superuser or user.has_perm('users.sales_view_team'):
            queryset = queryset.filter(Q(user=user) | Q(user__profile__manager=user))
        else:
            queryset = queryset.filter(user=user)

        return queryset.order_by('-created_at')
    
    def perform_create(self, serializer):
        # RBAC
        user = self.request.user
        if not (user.is_superuser or user.has_perm('users.returns_create')):
            raise PermissionDenied('Not authorized')

        """حفظ الشيفت الحالي مع المرتجع"""
        print(f"[DEBUG] ========== perform_create started ==========")
        print(f"[DEBUG] User: {self.request.user.username}")
        print(f"[DEBUG] User authenticated: {self.request.user.is_authenticated}")
        
        from .models_cashregister import CashRegister
        
        # البحث عن الشيفت المفتوح للمستخدم
        cash_register = None
        if self.request.user.is_authenticated:
            open_shifts = CashRegister.objects.filter(
                user=self.request.user,
                status='open'
            )
            print(f"[DEBUG] Open shifts for {self.request.user.username}: {open_shifts.count()}")
            
            cash_register = open_shifts.first()
            
            # Debug
            if cash_register:
                print(f"[DEBUG Return] ✅ Found open shift: {cash_register.id}")
                print(f"[DEBUG Return] Shift user: {cash_register.user.username}")
                print(f"[DEBUG Return] Shift opened at: {cash_register.opened_at}")
            else:
                print(f"[DEBUG Return] ❌ No open cash register found for user {self.request.user.username}")
                # عرض جميع الشيفتات المفتوحة
                all_open = CashRegister.objects.filter(status='open')
                print(f"[DEBUG] All open shifts: {all_open.count()}")
                for s in all_open:
                    print(f"  - Shift {s.id}: user={s.user.username}, opened={s.opened_at}")
        
        saved_return = serializer.save(cash_register=cash_register)
        print(f"[DEBUG Return] ✅ Created return {saved_return.id}")
        print(f"[DEBUG Return]    - Amount: {saved_return.total_amount}")
        print(f"[DEBUG Return]    - Cash register: {saved_return.cash_register_id}")
        print(f"[DEBUG Return]    - Status: {saved_return.status}")
        print(f"[DEBUG] ========== perform_create finished ==========\n")
    
    @action(detail=False, methods=['GET'])
    def stats(self, request):
        """إحصائيات المرتجعات"""
        from datetime import datetime, timedelta
        from django.utils import timezone
        
        today = timezone.now().date()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        
        # Debug: عرض جميع المرتجعات
        all_returns = Return.objects.all()
        print(f"[DEBUG stats] Total returns in DB: {all_returns.count()}")
        for r in all_returns[:5]:  # أول 5 مرتجعات
            print(f"  - Return {r.id}: amount={r.total_amount}, status={r.status}, created_at={r.created_at}, cash_register={r.cash_register_id}")
        
        # إحصائيات اليوم
        today_returns = Return.objects.filter(
            created_at__date=today,
            status='completed'
        )
        
        print(f"[DEBUG stats] Today returns count: {today_returns.count()}")
        
        today_stats = today_returns.aggregate(
            total=Sum('total_amount'),
            count=Count('id')
        )
        
        # إحصائيات الأسبوع
        week_returns = Return.objects.filter(
            created_at__date__gte=week_ago,
            status='completed'
        ).aggregate(
            total=Sum('total_amount'),
            count=Count('id')
        )
        
        # إحصائيات الشهر
        month_returns = Return.objects.filter(
            created_at__date__gte=month_ago,
            status='completed'
        ).aggregate(
            total=Sum('total_amount'),
            count=Count('id')
        )
        
        result = {
            'today': {
                'amount': today_stats['total'] or 0,
                'count': today_stats['count'] or 0
            },
            'week': {
                'amount': week_returns['total'] or 0,
                'count': week_returns['count'] or 0
            },
            'month': {
                'amount': month_returns['total'] or 0,
                'count': month_returns['count'] or 0
            }
        }
        
        print(f"[DEBUG stats] Result: {result}")
        
        return Response(result)
