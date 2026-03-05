from django.contrib import admin
from .models import Category, Product


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'color', 'created_at']
    search_fields = ['name']
    list_filter = ['created_at']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'price', 'cost', 'stock', 'is_active', 'created_at']
    search_fields = ['name', 'barcode']
    list_filter = ['category', 'is_active', 'created_at']
    list_editable = ['price', 'stock', 'is_active']
    readonly_fields = ['created_at', 'updated_at']
