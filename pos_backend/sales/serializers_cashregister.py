"""
Serializers لإدارة الخزنة
"""
from rest_framework import serializers
from .models_cashregister import CashRegister, CashTransaction
from django.contrib.auth.models import User


class CashTransactionSerializer(serializers.ModelSerializer):
    """Serializer لمعاملات الخزنة"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = CashTransaction
        fields = [
            'id', 'cash_register', 'transaction_type', 'amount',
            'reason', 'note', 'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'created_by_name']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return 'غير محدد'


class CashRegisterSerializer(serializers.ModelSerializer):
    """Serializer لشيفت الخزنة"""
    user_name = serializers.SerializerMethodField()
    duration = serializers.ReadOnlyField()
    sales_count = serializers.ReadOnlyField()
    returns_count = serializers.ReadOnlyField()
    transactions = CashTransactionSerializer(many=True, read_only=True)
    
    class Meta:
        model = CashRegister
        fields = [
            'id', 'user', 'user_name', 
            'opening_balance', 'opened_at', 'opening_note',
            'closing_balance', 'closed_at', 'closing_note',
            'total_cash_sales', 'total_card_sales', 'total_sales', 'total_returns',
            'expected_cash', 'actual_cash', 'cash_difference',
            'status', 'duration', 'sales_count', 'returns_count', 'transactions'
        ]
        read_only_fields = [
            'id', 'opened_at', 'user_name', 'duration', 'sales_count', 'returns_count'
        ]
    
    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class CashRegisterListSerializer(serializers.ModelSerializer):
    """Serializer مبسط لقائمة الشيفتات"""
    user_name = serializers.SerializerMethodField()
    duration = serializers.ReadOnlyField()
    sales_count = serializers.ReadOnlyField()
    returns_count = serializers.ReadOnlyField()
    
    class Meta:
        model = CashRegister
        fields = [
            'id', 'user', 'user_name',
            'opening_balance', 'opened_at',
            'closing_balance', 'closed_at',
            'total_sales', 'total_returns',
            'expected_cash', 'actual_cash', 'cash_difference',
            'status', 'duration', 'sales_count', 'returns_count'
        ]
        read_only_fields = [
            'id', 'opened_at', 'user_name', 'duration', 'sales_count', 'returns_count'
        ]
    
    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class CashRegisterOpenSerializer(serializers.Serializer):
    """Serializer لفتح شيفت جديد"""
    opening_balance = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    opening_note = serializers.CharField(required=False, allow_blank=True)


class CashRegisterCloseSerializer(serializers.Serializer):
    """Serializer لإغلاق شيفت"""
    actual_cash = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    closing_note = serializers.CharField(required=False, allow_blank=True)
