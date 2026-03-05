from rest_framework import serializers
from .models import Sale, SaleItem, Return, ReturnItem
from products.models import Product
from customers.models import Customer
from django.db import transaction


class SaleItemSerializer(serializers.ModelSerializer):
    product_id = serializers.UUIDField(write_only=True, required=False)
    
    class Meta:
        model = SaleItem
        fields = ['id', 'product', 'product_id', 'product_name', 'quantity', 'price', 'subtotal', 'created_at']
        read_only_fields = ['id', 'subtotal', 'created_at']


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, required=False)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    user_name = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()
    items_count = serializers.ReadOnlyField()
    total_profit = serializers.ReadOnlyField()
    has_returns = serializers.SerializerMethodField()
    returns_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Sale
        fields = [
            'id', 'customer', 'customer_name', 'user', 'user_name', 'user_role',
            'subtotal', 'discount', 'tax', 'total',
            'payment_method', 'status', 'notes',
            'items', 'items_count', 'total_profit',
            'has_returns', 'returns_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'user']
    
    def get_user_name(self, obj):
        """الحصول على اسم المستخدم"""
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return None
    
    def get_user_role(self, obj):
        """الحصول على دور المستخدم (مبني على Groups)"""
        if not obj.user:
            return None
        try:
            groups = [g.name for g in obj.user.groups.all()]
        except Exception:
            groups = []
        # Return a friendly primary label
        if 'Admins' in groups:
            return 'مدير النظام'
        if 'Managers' in groups:
            return 'مدير'
        if 'Cashier Plus' in groups:
            return 'كاشير بلس'
        if 'Cashiers' in groups:
            return 'كاشير'
        # fallback
        return groups[0] if groups else None

    def get_has_returns(self, obj):
        """التحقق من وجود مرتجعات"""
        return obj.returns.exists()
    
    def get_returns_count(self, obj):
        """عدد المرتجعات"""
        return obj.returns.count()
    
    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        sale = Sale.objects.create(**validated_data)

        for item_data in items_data:
            # accept product_id OR product (uuid) from client
            product_id = item_data.pop('product_id', None) or item_data.get('product')
            if not product_id:
                raise serializers.ValidationError("يجب إرسال product_id أو product لكل عنصر")

            try:
                product = Product.objects.get(id=product_id)
            except Product.DoesNotExist:
                raise serializers.ValidationError(f"المنتج غير موجود: {product_id}")

            qty = int(item_data.get('quantity') or 0)
            if qty <= 0:
                raise serializers.ValidationError(f"كمية غير صحيحة للمنتج: {product.name}")

            # stock enforcement + decrement (if stock field is used)
            if product.stock is not None:
                if product.stock < qty:
                    raise serializers.ValidationError(f"المخزون غير كافي للمنتج: {product.name}")
                product.stock -= qty
                product.save(update_fields=['stock'])

            SaleItem.objects.create(
                sale=sale,
                product=product,
                **item_data
            )

        # تحديث إجمالي مشتريات العميل
        if sale.customer and sale.status == 'completed':
            sale.customer.total_purchases += sale.total
            sale.customer.points += int(sale.total)  # نقطة لكل ريال
            sale.customer.save(update_fields=['total_purchases', 'points'])

        return sale


class SaleListSerializer(serializers.ModelSerializer):
    """Serializer مبسط لقائمة المبيعات"""
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    user_name = serializers.SerializerMethodField()
    items_count = serializers.ReadOnlyField()
    
    class Meta:
        model = Sale
        fields = [
            'id', 'customer_name', 'user_name', 'total',
            'payment_method', 'status', 'items_count', 'created_at'
        ]
    
    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return 'غير محدد'


class SalesStatsSerializer(serializers.Serializer):
    """Serializer لإحصائيات المبيعات"""
    today_sales = serializers.DecimalField(max_digits=10, decimal_places=2)
    today_count = serializers.IntegerField()
    week_sales = serializers.DecimalField(max_digits=10, decimal_places=2)
    month_sales = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_profit = serializers.DecimalField(max_digits=10, decimal_places=2)
    top_products = serializers.ListField()
    recent_sales = SaleListSerializer(many=True)