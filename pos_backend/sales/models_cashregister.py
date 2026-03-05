"""
نماذج إدارة الخزنة (Cash Register/Till Management)
"""
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import uuid


class CashRegister(models.Model):
    """نموذج شيفت الخزنة"""
    
    STATUS_CHOICES = [
        ('open', 'مفتوح'),
        ('closed', 'مغلق'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cash_registers', verbose_name='الكاشير')
    
    # معلومات الفتح
    opening_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name='الرصيد الافتتاحي')
    opened_at = models.DateTimeField(default=timezone.now, verbose_name='وقت الفتح')
    opening_note = models.TextField(blank=True, null=True, verbose_name='ملاحظات الفتح')
    
    # معلومات الإغلاق
    closing_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name='الرصيد الختامي')
    closed_at = models.DateTimeField(blank=True, null=True, verbose_name='وقت الإغلاق')
    closing_note = models.TextField(blank=True, null=True, verbose_name='ملاحظات الإغلاق')
    
    # الإحصائيات
    total_cash_sales = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name='إجمالي المبيعات النقدية')
    total_card_sales = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name='إجمالي المبيعات بالبطاقة')
    total_sales = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name='إجمالي المبيعات')
    total_returns = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name='إجمالي المرتجعات')
    
    # الرصيد المتوقع vs الفعلي
    expected_cash = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name='النقدية المتوقعة')
    actual_cash = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name='النقدية الفعلية')
    cash_difference = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name='الفرق في النقدية')
    
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open', verbose_name='الحالة')
    
    class Meta:
        ordering = ['-opened_at']
        verbose_name = 'شيفت الخزنة'
        verbose_name_plural = 'شيفتات الخزنة'
    
    def __str__(self):
        return f"شيفت {self.user.get_full_name() or self.user.username} - {self.opened_at.strftime('%Y-%m-%d %H:%M')}"
    
    def calculate_expected_cash(self):
        """
        حساب النقدية المتوقعة
        الصيغة:
        النقدية المتوقعة = الرصيد الافتتاحي + المبيعات النقدية - المرتجعات + الإيداعات - السحب
        """
        # حساب إجمالي الإيداعات والسحب
        deposits = self.transactions.filter(transaction_type='deposit').aggregate(
            total=models.Sum('amount')
        )['total'] or 0
        
        withdrawals = self.transactions.filter(transaction_type='withdrawal').aggregate(
            total=models.Sum('amount')
        )['total'] or 0
        
        # الصيغة: الرصيد الافتتاحي + المبيعات النقدية - المرتجعات + الإيداعات - السحب
        self.expected_cash = (
            self.opening_balance + 
            self.total_cash_sales - 
            self.total_returns + 
            deposits - 
            withdrawals
        )
        return self.expected_cash
    
    def calculate_difference(self):
        """حساب الفرق بين المتوقع والفعلي"""
        self.cash_difference = self.actual_cash - self.expected_cash
        return self.cash_difference
    
    @property
    def duration(self):
        """مدة الشيفت"""
        if self.status == 'closed' and self.closed_at:
            delta = self.closed_at - self.opened_at
        else:
            delta = timezone.now() - self.opened_at
        
        hours = delta.total_seconds() / 3600
        return round(hours, 2)
    
    @property
    def sales_count(self):
        """عدد عمليات البيع"""
        return self.sales.filter(status='completed').count()
    
    @property
    def returns_count(self):
        """عدد عمليات الإرجاع"""
        return self.returns.filter(status='completed').count()


class CashTransaction(models.Model):
    """نموذج معاملات الخزنة (إيداع/سحب)"""
    
    TRANSACTION_TYPES = [
        ('deposit', 'إيداع'),
        ('withdrawal', 'سحب'),
        ('adjustment', 'تعديل'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cash_register = models.ForeignKey(CashRegister, on_delete=models.CASCADE, related_name='transactions', verbose_name='الشيفت')
    
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES, verbose_name='نوع المعاملة')
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='المبلغ')
    reason = models.CharField(max_length=255, verbose_name='السبب')
    note = models.TextField(blank=True, null=True, verbose_name='ملاحظات')
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, verbose_name='المستخدم')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'معاملة الخزنة'
        verbose_name_plural = 'معاملات الخزنة'
    
    def __str__(self):
        return f"{self.get_transaction_type_display()} - {self.amount} ر.س"
