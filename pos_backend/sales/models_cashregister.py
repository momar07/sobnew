"""
نماذج إدارة الخزنة (Cash Register/Till Management)
"""
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.validators import MinValueValidator
import uuid


class CashRegister(models.Model):
    """نموذج شيفت الخزنة"""

    STATUS_CHOICES = [
        ('open',   'مفتوح'),
        ('closed', 'مغلق'),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='cash_registers',
        verbose_name='الكاشير'
    )

    # ─── معلومات الفتح ──────────────────────────────────────

    # ✅ MinValueValidator(0) — الرصيد الافتتاحي ما يكونش سالب
    opening_balance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        validators=[MinValueValidator(0)],
        verbose_name='الرصيد الافتتاحي'
    )
    opened_at = models.DateTimeField(
        default=timezone.now,
        verbose_name='وقت الفتح'
    )
    opening_note = models.TextField(
        blank=True,
        null=True,
        verbose_name='ملاحظات الفتح'
    )

    # ─── معلومات الإغلاق ────────────────────────────────────

    closing_balance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='الرصيد الختامي'
    )
    closed_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='وقت الإغلاق'
    )
    closing_note = models.TextField(
        blank=True,
        null=True,
        verbose_name='ملاحظات الإغلاق'
    )

    # ─── الإحصائيات ─────────────────────────────────────────

    total_cash_sales = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='إجمالي المبيعات النقدية'
    )
    total_card_sales = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='إجمالي المبيعات بالبطاقة'
    )
    total_sales = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='إجمالي المبيعات'
    )

    # ✅ إضافة total_cash_returns منفصل عن total_returns
    # عشان نحسب النقدية المتوقعة بدقة
    # total_returns = كل المرتجعات (نقدي + بطاقة)
    # total_cash_returns = المرتجعات النقدية بس (اللي بتأثر على الدرج)
    total_returns = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='إجمالي المرتجعات'
    )
    total_cash_returns = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='إجمالي المرتجعات النقدية'
    )

    # ─── الرصيد المتوقع vs الفعلي ───────────────────────────

    expected_cash = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='النقدية المتوقعة'
    )

    # ✅ MinValueValidator(0) — النقدية الفعلية ما تكونش سالبة
    actual_cash = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        validators=[MinValueValidator(0)],
        verbose_name='النقدية الفعلية'
    )
    cash_difference = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='الفرق في النقدية'
    )

    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='open',
        verbose_name='الحالة'
    )

    class Meta:
        ordering            = ['-opened_at']
        verbose_name        = 'شيفت الخزنة'
        verbose_name_plural = 'شيفتات الخزنة'

    def __str__(self):
        return (
            f"شيفت {self.user.get_full_name() or self.user.username}"
            f" - {self.opened_at.strftime('%Y-%m-%d %H:%M')}"
        )

    # ─── Business Logic Methods ──────────────────────────────

    def calculate_expected_cash(self):
        """
        حساب النقدية المتوقعة في الدرج.

        ✅ الصيغة الصحيحة:
        النقدية المتوقعة =
            الرصيد الافتتاحي
            + المبيعات النقدية
            - المرتجعات النقدية فقط   ← الإصلاح هنا
            + الإيداعات
            - السحب

        ❌ الصيغة القديمة الغلط:
            كانت بتطرح total_returns (كل المرتجعات حتى البطاقة)
            وده كان بيخلي النقدية المتوقعة أقل من الحقيقي
            لأن مرتجعات البطاقة مش بتأثر على الكاش الموجود في الدرج
        """
        deposits = self.transactions.filter(
            transaction_type='deposit'
        ).aggregate(
            total=models.Sum('amount')
        )['total'] or 0

        withdrawals = self.transactions.filter(
            transaction_type='withdrawal'
        ).aggregate(
            total=models.Sum('amount')
        )['total'] or 0

        # ✅ بنطرح total_cash_returns بس مش total_returns
        self.expected_cash = (
            self.opening_balance
            + self.total_cash_sales
            - self.total_cash_returns
            + deposits
            - withdrawals
        )
        return self.expected_cash

    def calculate_difference(self):
        """حساب الفرق بين النقدية المتوقعة والفعلية"""
        self.cash_difference = self.actual_cash - self.expected_cash
        return self.cash_difference

    # ✅ دالة جديدة لحساب closing_balance عند إغلاق الشيفت
    def calculate_closing_balance(self):
        """
        حساب الرصيد الختامي عند إغلاق الشيفت.

        الرصيد الختامي = النقدية الفعلية اللي عدّها الكاشير
        لأنه هو الرقم الحقيقي اللي في الدرج وقت الإغلاق
        """
        self.closing_balance = self.actual_cash
        return self.closing_balance

    # ─── Properties ─────────────────────────────────────────

    @property
    def duration(self):
        """مدة الشيفت بالساعات"""
        if self.status == 'closed' and self.closed_at:
            delta = self.closed_at - self.opened_at
        else:
            delta = timezone.now() - self.opened_at
        return round(delta.total_seconds() / 3600, 2)

    @property
    def sales_count(self):
        """عدد عمليات البيع المكتملة"""
        return self.sales.filter(status='completed').count()

    @property
    def returns_count(self):
        """عدد عمليات الإرجاع المكتملة"""
        return self.returns.filter(status='completed').count()

    @property
    def net_cash(self):
        """
        ✅ Property جديدة — صافي النقدية
        صافي النقدية = المبيعات النقدية - المرتجعات النقدية
        بيساعد في عرض ملخص سريع للشيفت
        """
        return self.total_cash_sales - self.total_cash_returns


class CashTransaction(models.Model):
    """نموذج معاملات الخزنة (إيداع/سحب)"""

    TRANSACTION_TYPES = [
        ('deposit',    'إيداع'),
        ('withdrawal', 'سحب'),
        ('adjustment', 'تعديل'),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    cash_register = models.ForeignKey(
        CashRegister,
        on_delete=models.CASCADE,
        related_name='transactions',
        verbose_name='الشيفت'
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPES,
        verbose_name='نوع المعاملة'
    )

    # ✅ MinValueValidator(0.01) — المبلغ لازم يكون أكبر من صفر
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        verbose_name='المبلغ'
    )
    reason = models.CharField(
        max_length=255,
        verbose_name='السبب'
    )
    note = models.TextField(
        blank=True,
        null=True,
        verbose_name='ملاحظات'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='المستخدم'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='تاريخ الإنشاء'
    )

    class Meta:
        ordering            = ['-created_at']
        verbose_name        = 'معاملة الخزنة'
        verbose_name_plural = 'معاملات الخزنة'

    def __str__(self):
        return (
            f"{self.get_transaction_type_display()}"
            f" - {self.amount} ر.س"
        )
