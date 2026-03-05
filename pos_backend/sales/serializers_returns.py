from rest_framework import serializers
from django.db import transaction
from django.db.models import Sum, F
from .models import Sale, SaleItem, Return, ReturnItem
from products.models import Product


class ReturnItemSerializer(serializers.ModelSerializer):
    """Serializer لعناصر المرتجع"""
    product_name = serializers.CharField(
        source='sale_item.product_name',
        read_only=True
    )
    sale_item_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = ReturnItem
        fields = [
            'id', 'sale_item_id', 'product', 'product_name',
            'quantity', 'price', 'subtotal', 'created_at'
        ]
        read_only_fields = ['id', 'subtotal', 'created_at', 'product']


class ReturnSerializer(serializers.ModelSerializer):
    """Serializer للمرتجعات"""
    items = ReturnItemSerializer(many=True)
    sale_id = serializers.UUIDField(write_only=True)
    user_name = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()

    class Meta:
        model = Return
        fields = [
            'id', 'sale', 'sale_id', 'user', 'user_name', 'customer_name',
            'total_amount', 'reason', 'status', 'items',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at', 'sale']

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return 'غير محدد'

    def get_customer_name(self, obj):
        if obj.sale and obj.sale.customer:
            return obj.sale.customer.name
        return 'زائر'

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        sale_id = validated_data.pop('sale_id')

        # ✅ استخراج cash_register من validated_data
        cash_register = validated_data.pop('cash_register', None)

        reason = validated_data.get('reason', '')
        return_status = validated_data.get('status', 'completed')

        # التحقق من وجود الفاتورة
        try:
            sale = Sale.objects.get(id=sale_id)
        except Sale.DoesNotExist:
            raise serializers.ValidationError(
                "عملية البيع غير موجودة"
            )

        # التحقق من أن الفاتورة مكتملة وليست ملغاة
        if sale.status != 'completed':
            raise serializers.ValidationError(
                "لا يمكن إرجاع فاتورة غير مكتملة"
            )

        # ✅ إنشاء المرتجع داخل transaction.atomic
        # لو أي حاجة فشلت في الـ items كل حاجة هترجع — المرتجع والمخزون
        return_obj = Return.objects.create(
            sale=sale,
            user=self.context['request'].user,
            cash_register=cash_register,
            reason=reason,
            status=return_status
        )

        total_amount = 0

        for item_data in items_data:
            sale_item_id = item_data.pop('sale_item_id')
            quantity = item_data.get('quantity')

            # إزالة price لأننا نأخذه من sale_item دايماً
            item_data.pop('price', None)

            # التحقق من وجود عنصر الفاتورة وإنه تابع لنفس الفاتورة
            try:
                sale_item = SaleItem.objects.select_for_update().get(
                    id=sale_item_id,
                    sale=sale
                )
            except SaleItem.DoesNotExist:
                raise serializers.ValidationError(
                    f"عنصر الفاتورة غير موجود: {sale_item_id}"
                )

            # ✅ حساب الكمية المرتجعة مسبقاً بدقة
            previous_returns = ReturnItem.objects.filter(
                sale_item=sale_item,
                return_obj__status='completed'
            ).aggregate(total_returned=Sum('quantity'))

            total_returned = previous_returns['total_returned'] or 0
            remaining_quantity = sale_item.quantity - total_returned

            # التحقق من الكمية المطلوبة
            if quantity <= 0:
                raise serializers.ValidationError(
                    f"الكمية يجب أن تكون أكبر من صفر"
                )

            if quantity > remaining_quantity:
                raise serializers.ValidationError(
                    f"الكمية المرتجعة ({quantity}) أكبر من الكمية المتبقية "
                    f"({remaining_quantity}) للمنتج '{sale_item.product_name}'. "
                    f"الكمية الأصلية: {sale_item.quantity}, "
                    f"تم إرجاع مسبقاً: {total_returned}"
                )

            # إنشاء عنصر المرتجع
            return_item = ReturnItem.objects.create(
                return_obj=return_obj,
                sale_item=sale_item,
                product=sale_item.product,
                quantity=quantity,
                price=sale_item.price
            )

            total_amount += return_item.subtotal

            # ✅ إصلاح Race Condition — إرجاع المخزون بـ F() expression
            # في UPDATE واحدة atomic بدون قراءة وكتابة منفصلتين
            if sale_item.product:
                Product.objects.filter(
                    id=sale_item.product.id
                ).update(
                    stock=F('stock') + quantity
                )

        # تحديث المبلغ الإجمالي للمرتجع
        return_obj.total_amount = total_amount
        return_obj.save(update_fields=['total_amount'])

        return return_obj


class ReturnListSerializer(serializers.ModelSerializer):
    """Serializer مبسط لقائمة المرتجعات"""
    user_name = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    sale_number = serializers.SerializerMethodField()
    items_count = serializers.IntegerField(
        source='items.count',
        read_only=True
    )

    class Meta:
        model = Return
        fields = [
            'id', 'sale', 'sale_number', 'user_name', 'customer_name',
            'total_amount', 'status', 'items_count', 'created_at'
        ]

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return 'غير محدد'

    def get_customer_name(self, obj):
        if obj.sale and obj.sale.customer:
            return obj.sale.customer.name
        return 'زائر'

    def get_sale_number(self, obj):
        return str(obj.sale.id)[:8] if obj.sale else ''
