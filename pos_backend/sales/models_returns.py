from django.db import models
from django.contrib.auth.models import User
from sales.models import Sale, SaleItem
from products.models import Product
import uuid


class Return(models.Model):
    """نموذج المرتجعات"""
    
    STATUS_CHOICES = [
        ('pending', 'قيد المراجعة'),
        ('approved', 'مقبول'),
        ('rejected', 'مرفوض'),
        ('completed', 'مكتمل'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='returns')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='processed_returns')
    
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    reason = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'مرتجع'
        verbose_name_plural = 'المرتجعات'
    
    def __str__(self):
        return f"مرتجع #{str(self.id)[:8]} - {self.sale}"


class ReturnItem(models.Model):
    """عناصر المرتجع"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    return_obj = models.ForeignKey(Return, on_delete=models.CASCADE, related_name='items')
    sale_item = models.ForeignKey(SaleItem, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'عنصر مرتجع'
        verbose_name_plural = 'عناصر المرتجعات'
    
    def save(self, *args, **kwargs):
        # حساب المجموع الفرعي تلقائياً
        self.subtotal = self.quantity * self.price
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.product.name if self.product else 'منتج محذوف'} × {self.quantity}"
