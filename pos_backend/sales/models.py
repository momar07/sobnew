from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
import uuid

# استيراد نماذج الخزنة
from .models_cashregister import CashRegister, CashTransaction


class Sale(models.Model):
    """نموذج عملية البيع"""

    PAYMENT_METHODS = [
        ('cash', 'نقدي'),
        ('card', 'بطاقة'),
        ('both', 'نقدي + بطاقة'),
    ]

    STATUS_CHOICES = [
        ('completed', 'مكتملة'),
        ('cancelled', 'ملغاة'),
        ('pending',   'قيد الانتظار'),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales',
        verbose_name="العميل"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sales',
        verbose_name="الموظف"
    )
    cash_register = models.ForeignKey(
        'CashRegister',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales',
        verbose_name="شيفت الخزنة"
    )
    subtotal = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=0,
        verbose_name="المجموع الفرعي"
    )
    discount = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=0,
        verbose_name="الخصم"
    )
    tax = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=0,
        verbose_name="الضريبة"
    )
    total = models.DecimalField(
        max_digits=10, decimal_places=2,
        verbose_name="المجموع الكلي"
    )
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHODS,
        default='cash',
        verbose_name="طريقة الدفع"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='completed',
        verbose_name="الحالة"
    )
    notes = models.TextField(
        blank=True, null=True,
        verbose_name="ملاحظات"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاريخ الإنشاء"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="تاريخ التحديث"
    )

    class Meta:
        verbose_name        = "عملية بيع"
        verbose_name_plural = "عمليات البيع"
        ordering            = ['-created_at']

    def __str__(self):
        return f"Sale #{str(self.id)[:8]} - {self.total}"

    @property
    def items_count(self):
        """عدد العناصر في عملية البيع"""
        return self.items.count()

    @property
    def total_profit(self):
        """
        إجمالي الربح من هذه العملية.

        ✅ لو استخدمت prefetch_related('items__product') قبل ما تطلب
        الـ property دي، مش هيتعمل أي queries إضافية خالص.

        مثال:
            sales = Sale.objects.prefetch_related('items__product').all()
            for sale in sales:
                print(sale.total_profit)  # ✅ zero extra queries
        """
        profit = 0
        for item in self.items.all():
            if item.product:
                profit += (item.price - item.product.cost) * item.quantity
        return profit


class SaleItem(models.Model):
    """نموذج عنصر في عملية البيع"""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    sale = models.ForeignKey(
        Sale,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name="عملية البيع"
    )
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.SET_NULL,
        null=True,
        related_name='sale_items',
        verbose_name="المنتج"
    )
    product_name = models.CharField(
        max_length=200,
        verbose_name="اسم المنتج"
    )

    # ✅ إصلاح quantity — MinValueValidator(1) يمنع الصفر والسالب
    quantity = models.IntegerField(
        verbose_name="الكمية",
        validators=[MinValueValidator(1)]
    )

    price = models.DecimalField(
        max_digits=10, decimal_places=2,
        verbose_name="السعر"
    )
    subtotal = models.DecimalField(
        max_digits=10, decimal_places=2,
        verbose_name="المجموع الفرعي"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاريخ الإنشاء"
    )

    class Meta:
        verbose_name        = "عنصر عملية بيع"
        verbose_name_plural = "عناصر عمليات البيع"
        ordering            = ['created_at']

    def __str__(self):
        return f"{self.product_name} x{self.quantity}"

    def save(self, *args, **kwargs):
        """حساب المجموع الفرعي تلقائياً"""
        self.subtotal = self.price * self.quantity
        super().save(*args, **kwargs)


class Return(models.Model):
    """نموذج المرتجعات"""

    STATUS_CHOICES = [
        ('pending',   'قيد المراجعة'),
        ('approved',  'مقبول'),
        ('rejected',  'مرفوض'),
        ('completed', 'مكتمل'),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    sale = models.ForeignKey(
        Sale,
        on_delete=models.CASCADE,
        related_name='returns',
        verbose_name="عملية البيع"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='processed_returns',
        verbose_name="الموظف"
    )
    cash_register = models.ForeignKey(
        'CashRegister',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='returns',
        verbose_name="شيفت الخزنة"
    )
    total_amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=0,
        verbose_name="المبلغ الإجمالي"
    )
    reason = models.TextField(
        blank=True, null=True,
        verbose_name="السبب"
    )

    # ✅ إصلاح default — المرتجع يبدأ بـ 'pending' محتاج مراجعة
    # الكود القديم كان default='completed' وده كان بيأثر على المخزون
    # فوراً بدون أي موافقة
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name="الحالة"
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاريخ الإنشاء"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="تاريخ التحديث"
    )

    class Meta:
        ordering            = ['-created_at']
        verbose_name        = 'مرتجع'
        verbose_name_plural = 'المرتجعات'

    def __str__(self):
        return f"مرتجع #{str(self.id)[:8]} - {self.total_amount} ر.س"


class ReturnItem(models.Model):
    """عناصر المرتجع"""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    return_obj = models.ForeignKey(
        Return,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name="المرتجع"
    )
    sale_item = models.ForeignKey(
        SaleItem,
        on_delete=models.CASCADE,
        verbose_name="عنصر الفاتورة"
    )
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.SET_NULL,
        null=True,
        verbose_name="المنتج"
    )

    # ✅ إصلاح quantity — MinValueValidator(1) يمنع الصفر والسالب
    quantity = models.PositiveIntegerField(
        default=1,
        verbose_name="الكمية",
        validators=[MinValueValidator(1)]
    )

    price = models.DecimalField(
        max_digits=10, decimal_places=2,
        verbose_name="السعر"
    )
    subtotal = models.DecimalField(
        max_digits=10, decimal_places=2,
        verbose_name="المجموع الفرعي"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاريخ الإنشاء"
    )

    class Meta:
        verbose_name        = 'عنصر مرتجع'
        verbose_name_plural = 'عناصر المرتجعات'

    def save(self, *args, **kwargs):
        """حساب المجموع الفرعي تلقائياً"""
        self.subtotal = self.quantity * self.price
        super().save(*args, **kwargs)

    def __str__(self):
        product_name = (
            self.product.name
            if self.product
            else self.sale_item.product_name
        )
        return f"{product_name} × {self.quantity}"
