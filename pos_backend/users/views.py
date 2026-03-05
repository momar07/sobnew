from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.contrib.auth.models import User, Group
from django_filters.rest_framework import DjangoFilterBackend
from .models import UserProfile
from ui_builder.services import build_ui_schema_for_user
from ui_builder.serializers import (
    UiRouteSerializer,
    UiMenuItemSerializer,
    UiActionSerializer
)
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    CurrentUserSerializer,
    UserProfileSerializer,
    GroupSerializer,
)


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet لإدارة المستخدمين"""
    queryset = User.objects.select_related('profile').all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter
    ]
    search_fields = [
        'username', 'email',
        'first_name', 'last_name',
        'profile__employee_id'
    ]
    ordering_fields = ['date_joined', 'username']
    ordering = ['-date_joined']

    # ─── Helpers ────────────────────────────────────────────

    def _require_perm(self, request, perm_codename):
        user = request.user
        if user.is_superuser or user.has_perm(f'users.{perm_codename}'):
            return
        raise PermissionDenied('Not authorized')

    # ─── Serializer & Permissions ────────────────────────────

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    # ✅ إصلاح get_permissions — كل action ليه صلاحية مختلفة
    def get_permissions(self):
        """
        - list / retrieve / me / cashiers / performance
          → IsAuthenticated بس (أي يوزر logged in يشوف)
        - create / update / partial_update / destroy
          → IsAuthenticated + RBAC check في الـ perform_* methods
        """
        # كل الـ actions محتاجة authentication على الأقل
        return [IsAuthenticated()]

    # ─── CRUD Permission Checks ──────────────────────────────

    def perform_create(self, serializer):
        """التحقق من الصلاحيات قبل الإنشاء"""
        self._require_perm(self.request, 'users_manage')
        serializer.save()

    def perform_update(self, serializer):
        """التحقق من الصلاحيات قبل التعديل"""
        self._require_perm(self.request, 'users_manage')
        serializer.save()

    # ✅ إصلاح perform_destroy
    # المشكلة الأصلية: بيرمي PermissionError (Python built-in)
    # DRF مش بيمسكها → بيرجع 500 بدل 403
    # الحل: نستخدم PermissionDenied من rest_framework.exceptions
    def perform_destroy(self, instance):
        """
        Soft Delete — بيعمل is_active = False بدل حذف حقيقي
        """
        self._require_perm(self.request, 'users_manage')

        # ✅ PermissionDenied من DRF → 403 Forbidden صح
        if instance == self.request.user:
            raise PermissionDenied("لا يمكنك حذف حسابك الخاص")

        instance.is_active = False
        instance.save(update_fields=['is_active'])

    # ─── Custom Actions ──────────────────────────────────────

    @action(detail=False, methods=['get'])
    def me(self, request):
        """الحصول على بيانات المستخدم الحالي"""
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def cashiers(self, request):
        """قائمة الكاشيرات فقط"""
        cashiers = User.objects.filter(
            groups__name__in=['Cashiers', 'Cashier Plus'],
            is_active=True
        ).distinct()
        serializer = self.get_serializer(cashiers, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def performance(self, request, pk=None):
        """أداء المستخدم (المبيعات)"""
        user = self.get_object()

        from sales.models import Sale, SaleItem
        from django.db.models import Sum, Count, Avg
        from datetime import datetime

        start_date = request.query_params.get('start_date')
        end_date   = request.query_params.get('end_date')

        sales_query = Sale.objects.filter(
            user=user,
            status='completed'
        )

        if start_date:
            try:
                start = datetime.strptime(start_date, '%Y-%m-%d').date()
                sales_query = sales_query.filter(created_at__date__gte=start)
            except ValueError:
                pass

        if end_date:
            try:
                end = datetime.strptime(end_date, '%Y-%m-%d').date()
                sales_query = sales_query.filter(created_at__date__lte=end)
            except ValueError:
                pass

        # إحصائيات أساسية
        stats = sales_query.aggregate(
            total_sales=Count('id'),
            total_revenue=Sum('total'),
            average_sale=Avg('total')
        )

        # عدد العملاء المميزين
        total_customers = sales_query.filter(
            customer__isnull=False
        ).values('customer').distinct().count()

        # أفضل يوم
        best_day_data = sales_query.values(
            'created_at__date'
        ).annotate(
            daily_sales=Count('id')
        ).order_by('-daily_sales').first()

        best_day = (
            best_day_data['created_at__date'].strftime('%Y-%m-%d')
            if best_day_data else None
        )

        # متوسط عدد المنتجات لكل فاتورة
        total_items = SaleItem.objects.filter(
            sale__in=sales_query
        ).aggregate(total=Sum('quantity'))

        total_sales_count = stats['total_sales'] or 1
        average_items_per_sale = (
            total_items['total'] or 0
        ) / total_sales_count

        # ✅ تقييم الأداء بشكل أوضح
        total_sales = stats['total_sales'] or 0
        if total_sales >= 100:
            performance_rating = 5
        elif total_sales >= 50:
            performance_rating = 4
        elif total_sales >= 20:
            performance_rating = 3
        elif total_sales >= 10:
            performance_rating = 2
        else:
            performance_rating = 1

        return Response({
            'user':                  CurrentUserSerializer(user).data,
            'total_sales':           total_sales,
            'total_revenue':         float(stats['total_revenue'] or 0),
            'average_sale':          float(stats['average_sale'] or 0),
            'total_customers':       total_customers,
            'best_day':              best_day,
            'average_items_per_sale': float(average_items_per_sale),
            'performance_rating':    performance_rating,
        })


# ─── MeWithUiView ────────────────────────────────────────────────────────────

class MeWithUiView(APIView):
    """
    Return current user + permissions + dynamic UI schema.
    Frontend يستخدم ده بدل /users/me/ للـ dynamic UI.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        scope_type = "global"
        scope_key  = ""

        schema = build_ui_schema_for_user(
            user,
            scope_type=scope_type,
            scope_key=scope_key
        )

        data = {
            "user":        CurrentUserSerializer(user).data,
            "permissions": schema["permissions"],
            "groups":      schema["groups"],
            "scope":       schema["scope"],
            "ui": {
                "routes":  UiRouteSerializer(
                    schema["routes"], many=True
                ).data,
                "sidebar": UiMenuItemSerializer(
                    schema["sidebar"], many=True
                ).data,
                "actions": {
                    k: UiActionSerializer(v, many=True).data
                    for k, v in schema["actions"].items()
                },
            },
        }
        return Response(data)


# ─── Groups Views ─────────────────────────────────────────────────────────────

class GroupsListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def _is_admin_like(self, user):
        if user.is_superuser:
            return True
        return user.groups.filter(
            name__in=['Admins', 'Managers']
        ).exists()

    def get(self, request):
        if not self._is_admin_like(request.user) and not \
                request.user.has_perm('auth.view_group'):
            raise PermissionDenied('Not authorized')
        qs = Group.objects.all().order_by('name')
        return Response(GroupSerializer(qs, many=True).data)

    def post(self, request):
        if not self._is_admin_like(request.user) and not \
                request.user.has_perm('auth.add_group'):
            raise PermissionDenied('Not authorized')
        serializer = GroupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        grp = serializer.save()
        return Response(
            GroupSerializer(grp).data,
            status=status.HTTP_201_CREATED
        )


class GroupsDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _is_admin_like(self, user):
        if user.is_superuser:
            return True
        return user.groups.filter(
            name__in=['Admins', 'Managers']
        ).exists()

    def delete(self, request, pk):
        if not self._is_admin_like(request.user) and not \
                request.user.has_perm('auth.delete_group'):
            raise PermissionDenied('Not authorized')

        try:
            grp = Group.objects.get(pk=pk)
        except Group.DoesNotExist:
            return Response(
                {'detail': 'Group not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        grp.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
