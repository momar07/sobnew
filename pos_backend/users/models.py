from django.db import models
from django.contrib.auth.models import User
import uuid


class UserProfile(models.Model):
    """ملف تعريف المستخدم الموسع"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')

    # Team manager (one-level)
    manager = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='managed_users',
        verbose_name="المدير"
    )

    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name="رقم الهاتف")
    address = models.TextField(blank=True, null=True, verbose_name="العنوان")
    employee_id = models.CharField(max_length=50, blank=True, null=True, unique=True, verbose_name="رقم الموظف")
    avatar = models.URLField(blank=True, null=True, verbose_name="صورة الملف الشخصي")
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")

    class Meta:
        verbose_name = "ملف المستخدم"
        verbose_name_plural = "ملفات المستخدمين"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username}"

    @property
    def full_name(self):
        """الاسم الكامل"""
        return self.user.get_full_name() or self.user.username

    @property
    def sales_count(self):
        """عدد عمليات البيع"""
        from sales.models import Sale
        return Sale.objects.filter(user=self.user, status='completed').count()

    @property
    def total_sales_amount(self):
        """إجمالي المبيعات"""
        from sales.models import Sale
        from django.db.models import Sum
        from decimal import Decimal
        result = Sale.objects.filter(user=self.user, status='completed').aggregate(total=Sum('total'))
        return Decimal(str(result['total'] or 0))
