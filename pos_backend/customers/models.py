from django.db import models
import uuid


class Customer(models.Model):
    """نموذج العميل"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, verbose_name="اسم العميل")
    phone = models.CharField(max_length=20, unique=True, verbose_name="رقم الهاتف")
    email = models.EmailField(blank=True, null=True, verbose_name="البريد الإلكتروني")
    address = models.TextField(blank=True, null=True, verbose_name="العنوان")
    total_purchases = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0, 
        verbose_name="إجمالي المشتريات"
    )
    points = models.IntegerField(default=0, verbose_name="نقاط الولاء")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ التسجيل")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")
    
    class Meta:
        verbose_name = "عميل"
        verbose_name_plural = "العملاء"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} - {self.phone}"
    
    @property
    def purchase_count(self):
        """عدد عمليات الشراء"""
        return self.sales.filter(status='completed').count()
