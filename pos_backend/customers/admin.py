from django.contrib import admin
from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'email', 'total_purchases', 'points', 'created_at']
    search_fields = ['name', 'phone', 'email']
    list_filter = ['created_at']
    readonly_fields = ['created_at', 'updated_at']
