from rest_framework import serializers
from .models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    purchase_count = serializers.ReadOnlyField()
    
    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'phone', 'email', 'address',
            'total_purchases', 'points', 'purchase_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'total_purchases', 'points', 'created_at', 'updated_at']


class CustomerListSerializer(serializers.ModelSerializer):
    """Serializer مبسط لقائمة العملاء"""
    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'total_purchases', 'points']
