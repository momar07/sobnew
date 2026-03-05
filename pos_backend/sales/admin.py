from django.contrib import admin
from .models import Sale, SaleItem, Return, ReturnItem
from .models_cashregister import CashRegister, CashTransaction


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ['subtotal']


class ReturnItemInline(admin.TabularInline):
    model = ReturnItem
    extra = 0
    readonly_fields = ['subtotal']


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ['id', 'customer', 'user', 'total', 'payment_method', 'status', 'created_at']
    search_fields = ['customer__name', 'id', 'user__username']
    list_filter = ['status', 'payment_method', 'created_at']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [SaleItemInline]


@admin.register(SaleItem)
class SaleItemAdmin(admin.ModelAdmin):
    list_display = ['sale', 'product_name', 'quantity', 'price', 'subtotal', 'created_at']
    search_fields = ['product_name', 'sale__id']
    list_filter = ['created_at']
    readonly_fields = ['subtotal', 'created_at']


@admin.register(Return)
class ReturnAdmin(admin.ModelAdmin):
    list_display = ['id', 'sale', 'user', 'total_amount', 'status', 'created_at']
    search_fields = ['sale__id', 'user__username', 'id']
    list_filter = ['status', 'created_at']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [ReturnItemInline]


@admin.register(ReturnItem)
class ReturnItemAdmin(admin.ModelAdmin):
    list_display = ['return_obj', 'product', 'quantity', 'price', 'subtotal', 'created_at']
    search_fields = ['return_obj__id', 'product__name']
    list_filter = ['created_at']
    readonly_fields = ['subtotal', 'created_at']


class CashTransactionInline(admin.TabularInline):
    model = CashTransaction
    extra = 0
    readonly_fields = ['created_at']


@admin.register(CashRegister)
class CashRegisterAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'opened_at', 'closed_at', 'status', 'total_sales', 'cash_difference']
    search_fields = ['user__username', 'id']
    list_filter = ['status', 'opened_at', 'closed_at']
    readonly_fields = ['opened_at', 'duration', 'sales_count', 'returns_count']
    inlines = [CashTransactionInline]
    
    fieldsets = (
        ('معلومات الشيفت', {
            'fields': ('user', 'status', 'opened_at', 'closed_at', 'duration')
        }),
        ('الرصيد', {
            'fields': ('opening_balance', 'opening_note', 'closing_balance', 'closing_note')
        }),
        ('الإحصائيات', {
            'fields': ('total_cash_sales', 'total_card_sales', 'total_sales', 'total_returns', 'sales_count', 'returns_count')
        }),
        ('النقدية', {
            'fields': ('expected_cash', 'actual_cash', 'cash_difference')
        }),
    )


@admin.register(CashTransaction)
class CashTransactionAdmin(admin.ModelAdmin):
    list_display = ['id', 'cash_register', 'transaction_type', 'amount', 'reason', 'created_by', 'created_at']
    search_fields = ['cash_register__id', 'reason']
    list_filter = ['transaction_type', 'created_at']
    readonly_fields = ['created_at']

