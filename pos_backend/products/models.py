from django.db import models
import uuid


class Category(models.Model):
    """نموذج فئة المنتجات"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, verbose_name="اسم الفئة")
    icon = models.CharField(max_length=50, blank=True, null=True, verbose_name="أيقونة")
    color = models.CharField(max_length=7, default="#3B82F6", verbose_name="اللون")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    
    class Meta:
        verbose_name = "فئة"
        verbose_name_plural = "الفئات"
        ordering = ['name']
    
    def __str__(self):
        return self.name


class Product(models.Model):
    """نموذج المنتج"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, verbose_name="اسم المنتج")
    category = models.ForeignKey(
        Category, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='products',
        verbose_name="الفئة"
    )
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="سعر البيع")
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="التكلفة")
    stock = models.IntegerField(default=0, verbose_name="الكمية المتاحة")
    barcode = models.CharField(max_length=100, unique=True, blank=True, null=True, verbose_name="الباركود")
    image_url = models.URLField(blank=True, null=True, verbose_name="رابط الصورة")
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    description = models.TextField(blank=True, null=True, verbose_name="الوصف")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")
    
    class Meta:
        verbose_name = "منتج"
        verbose_name_plural = "المنتجات"
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name
    
    @property
    def profit_margin(self):
        """حساب هامش الربح"""
        if self.cost > 0:
            return ((self.price - self.cost) / self.cost) * 100
        return 0
    
    @property
    def is_low_stock(self):
        """التحقق من انخفاض المخزون"""
        return self.stock < 10
