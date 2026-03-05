"""
Views لإدارة الخزنة
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, Q
from django.utils import timezone
from .models_cashregister import CashRegister, CashTransaction
from .models import Sale
from .serializers_cashregister import (
    CashRegisterSerializer,
    CashRegisterListSerializer,
    CashTransactionSerializer,
    CashRegisterOpenSerializer,
    CashRegisterCloseSerializer
)


class CashRegisterViewSet(viewsets.ModelViewSet):
    """ViewSet لإدارة شيفتات الخزنة"""
    queryset = CashRegister.objects.all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return CashRegisterListSerializer
        return CashRegisterSerializer
    
    def get_queryset(self):
        """فلترة الشيفتات حسب المستخدم"""
        queryset = CashRegister.objects.select_related('user').prefetch_related('transactions')
        user = self.request.user
        
        # RBAC permissions
        # Manager (team) sees own + team
        if user.is_superuser or user.has_perm('users.cashregister_view_team'):
            return queryset.filter(Q(user=user) | Q(user__profile__manager=user))
        
        # Cashier (own) sees only own
        if user.has_perm('users.cashregister_view_own'):
            return queryset.filter(user=user)

        return queryset.none()
    
    def retrieve(self, request, *args, **kwargs):
        """الحصول على تفاصيل شيفت مع حساب الإحصائيات Real-time"""
        instance = self.get_object()
        
        # إذا كان الشيفت مفتوح، احسب الإحصائيات Real-time
        if instance.status == 'open':
            sales = Sale.objects.filter(
                cash_register=instance,
                status='completed'
            )
            
            # إجمالي المبيعات
            cash_sales = sales.filter(
                Q(payment_method='cash') | Q(payment_method='both')
            ).aggregate(total=Sum('total'))['total'] or 0
            
            card_sales = sales.filter(
                Q(payment_method='card') | Q(payment_method='both')
            ).aggregate(total=Sum('total'))['total'] or 0
            
            total_sales = sales.aggregate(total=Sum('total'))['total'] or 0
            
            # إجمالي المرتجعات
            returns_qs = instance.returns.filter(status='completed')
            total_returns = returns_qs.aggregate(total=Sum('total_amount'))['total'] or 0
            
            # Debug: طباعة عدد المرتجعات
            print(f"[DEBUG retrieve] CashRegister {instance.id}:")
            print(f"  - All returns: {instance.returns.count()}")
            print(f"  - Completed returns: {returns_qs.count()}")
            print(f"  - Total: {total_returns}")
            
            # عرض كل مرتجع
            for r in instance.returns.all():
                print(f"    * Return {r.id}: {r.total_amount} ر.س, status={r.status}")
            
            # تحديث القيم
            instance.total_cash_sales = cash_sales
            instance.total_card_sales = card_sales
            instance.total_sales = total_sales
            instance.total_returns = total_returns
            instance.calculate_expected_cash()
            
            instance.save(update_fields=[
                'total_cash_sales', 'total_card_sales', 
                'total_sales', 'total_returns', 'expected_cash'
            ])
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    @action(detail=False, methods=['GET'])
    def current(self, request):
        """الحصول على الشيفت المفتوح الحالي للمستخدم"""
        from django.db.models import Q
        
        cash_register = CashRegister.objects.filter(
            user=request.user,
            status='open'
        ).first()
        
        if cash_register:
            # حساب الإحصائيات Real-time للشيفت المفتوح
            sales = Sale.objects.filter(
                cash_register=cash_register,
                status='completed'
            )
            
            # إجمالي المبيعات النقدية
            cash_sales = sales.filter(
                Q(payment_method='cash') | Q(payment_method='both')
            ).aggregate(total=Sum('total'))['total'] or 0
            
            # إجمالي المبيعات بالبطاقة
            card_sales = sales.filter(
                Q(payment_method='card') | Q(payment_method='both')
            ).aggregate(total=Sum('total'))['total'] or 0
            
            # إجمالي كل المبيعات
            total_sales = sales.aggregate(total=Sum('total'))['total'] or 0
            
            # إجمالي المرتجعات
            returns_qs = cash_register.returns.filter(status='completed')
            total_returns = returns_qs.aggregate(total=Sum('total_amount'))['total'] or 0
            
            # Debug - عرض تفاصيل المرتجعات
            print(f"[DEBUG current()] CashRegister {cash_register.id}:")
            print(f"  - All returns (any status): {cash_register.returns.count()}")
            print(f"  - Completed returns: {returns_qs.count()}")
            print(f"  - Total returns amount: {total_returns}")
            
            # عرض كل مرتجع
            for r in cash_register.returns.all():
                print(f"    * Return {r.id}: amount={r.total_amount}, status={r.status}, created_at={r.created_at}")
            
            # تحديث القيم
            cash_register.total_cash_sales = cash_sales
            cash_register.total_card_sales = card_sales
            cash_register.total_sales = total_sales
            cash_register.total_returns = total_returns
            
            # حساب النقدية المتوقعة
            cash_register.calculate_expected_cash()
            
            # حفظ التحديثات (بدون تغيير closed_at)
            cash_register.save(update_fields=[
                'total_cash_sales', 'total_card_sales', 
                'total_sales', 'total_returns', 'expected_cash'
            ])
            
            serializer = CashRegisterSerializer(cash_register)
            return Response(serializer.data)
        
        return Response({'detail': 'لا يوجد شيفت مفتوح حالياً'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['POST'])
    def open_shift(self, request):
        """فتح شيفت جديد"""
        # التحقق من عدم وجود شيفت مفتوح
        existing = CashRegister.objects.filter(
            user=request.user,
            status='open'
        ).exists()
        
        if existing:
            return Response(
                {'error': 'يوجد شيفت مفتوح بالفعل. يجب إغلاقه أولاً'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = CashRegisterOpenSerializer(data=request.data)
        if serializer.is_valid():
            cash_register = CashRegister.objects.create(
                user=request.user,
                opening_balance=serializer.validated_data['opening_balance'],
                opening_note=serializer.validated_data.get('opening_note', ''),
                status='open'
            )
            
            response_serializer = CashRegisterSerializer(cash_register)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['POST'])
    def close_shift(self, request, pk=None):
        """إغلاق الشيفت"""
        cash_register = self.get_object()
        
        # التحقق من أن الشيفت مفتوح
        if cash_register.status == 'closed':
            return Response(
                {'error': 'الشيفت مغلق بالفعل'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # التحقق من أن المستخدم هو صاحب الشيفت أو مدير
        if cash_register.user != request.user and not (
            request.user.is_superuser or request.user.groups.filter(name__in=['Admins','Managers']).exists() or request.user.has_perm('users.cashregister_manage') or request.user.has_perm('users.cashregister_view_team')
        ):
            return Response(
                {'error': 'لا يمكنك إغلاق شيفت مستخدم آخر'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = CashRegisterCloseSerializer(data=request.data)
        if serializer.is_valid():
            # حساب إحصائيات الشيفت
            sales = Sale.objects.filter(
                cash_register=cash_register,
                status='completed'
            )
            
            # إجمالي المبيعات النقدية
            cash_sales = sales.filter(
                Q(payment_method='cash') | Q(payment_method='both')
            ).aggregate(total=Sum('total'))['total'] or 0
            
            # إجمالي المبيعات بالبطاقة
            card_sales = sales.filter(
                Q(payment_method='card') | Q(payment_method='both')
            ).aggregate(total=Sum('total'))['total'] or 0
            
            # إجمالي كل المبيعات
            total_sales = sales.aggregate(total=Sum('total'))['total'] or 0
            
            # إجمالي المرتجعات
            returns_qs = cash_register.returns.filter(status='completed')
            total_returns = returns_qs.aggregate(total=Sum('total_amount'))['total'] or 0
            
            # Debug
            print(f"[DEBUG close_shift] CashRegister {cash_register.id}:")
            print(f"  - Returns count: {returns_qs.count()}")
            print(f"  - Total returns: {total_returns}")
            print(f"  - Total sales: {total_sales}")
            print(f"  - Cash sales: {cash_sales}")
            
            # تحديث بيانات الخزنة
            cash_register.total_cash_sales = cash_sales
            cash_register.total_card_sales = card_sales
            cash_register.total_sales = total_sales
            cash_register.total_returns = total_returns
            
            # حساب النقدية المتوقعة
            cash_register.calculate_expected_cash()
            
            # النقدية الفعلية من المستخدم
            cash_register.actual_cash = serializer.validated_data['actual_cash']
            
            # حساب الفرق
            cash_register.calculate_difference()
            
            # الإغلاق
            cash_register.closed_at = timezone.now()
            cash_register.closing_note = serializer.validated_data.get('closing_note', '')
            cash_register.status = 'closed'
            cash_register.save()
            
            response_serializer = CashRegisterSerializer(cash_register)
            return Response(response_serializer.data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['GET'])
    def stats(self, request):
        # RBAC
        if not (request.user.is_superuser or request.user.has_perm('users.cashregister_view_team') or request.user.has_perm('users.cashregister_view_own')):
            return Response({'detail': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        """إحصائيات الخزنة"""
        user = request.user
        
        # فلترة حسب الصلاحية
        if user.is_superuser or user.groups.filter(name='Admins').exists():
            queryset = CashRegister.objects.all()
        elif user.has_perm('users.cashregister_view_team'):
            queryset = CashRegister.objects.filter(Q(user=user) | Q(user__profile__manager=user))
        else:
            queryset = CashRegister.objects.filter(user=user)
        
        # الشيفت الحالي
        current_shift = queryset.filter(status='open').first()
        
        # إحصائيات اليوم
        today = timezone.now().date()
        today_shifts = queryset.filter(opened_at__date=today)
        
        # إحصائيات الأسبوع
        week_ago = today - timezone.timedelta(days=7)
        week_shifts = queryset.filter(opened_at__date__gte=week_ago)
        
        data = {
            'current_shift': CashRegisterSerializer(current_shift).data if current_shift else None,
            'today': {
                'shifts_count': today_shifts.count(),
                'total_sales': today_shifts.aggregate(total=Sum('total_sales'))['total'] or 0,
                'total_returns': today_shifts.aggregate(total=Sum('total_returns'))['total'] or 0,
            },
            'week': {
                'shifts_count': week_shifts.count(),
                'total_sales': week_shifts.aggregate(total=Sum('total_sales'))['total'] or 0,
                'total_returns': week_shifts.aggregate(total=Sum('total_returns'))['total'] or 0,
            }
        }
        
        return Response(data)


class CashTransactionViewSet(viewsets.ModelViewSet):
    """ViewSet لمعاملات الخزنة (إيداع/سحب)"""
    queryset = CashTransaction.objects.all()
    serializer_class = CashTransactionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """فلترة المعاملات حسب الشيفت"""
        queryset = CashTransaction.objects.select_related('cash_register', 'created_by')
        
        # فلترة حسب الشيفت
        cash_register_id = self.request.query_params.get('cash_register', None)
        if cash_register_id:
            queryset = queryset.filter(cash_register_id=cash_register_id)
        
        return queryset.order_by('-created_at')
    
    def perform_create(self, serializer):
        """حفظ المستخدم مع المعاملة"""
        serializer.save(created_by=self.request.user)
