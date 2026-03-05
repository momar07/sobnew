"""
سكريبت لإضافة فئات المنتجات
الاستخدام: python add_categories.py
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pos_backend.settings')
django.setup()

from products.models import Category

def add_categories():
    """إضافة فئات المنتجات"""
    
    categories_data = [
        {'name': 'إلكترونيات', 'icon': 'fas fa-laptop', 'color': '#3B82F6'},
        {'name': 'أطعمة ومشروبات', 'icon': 'fas fa-coffee', 'color': '#10B981'},
        {'name': 'ملابس', 'icon': 'fas fa-tshirt', 'color': '#F59E0B'},
        {'name': 'كتب وقرطاسية', 'icon': 'fas fa-book', 'color': '#8B5CF6'},
        {'name': 'أدوات منزلية', 'icon': 'fas fa-home', 'color': '#EF4444'},
        {'name': 'ألعاب', 'icon': 'fas fa-gamepad', 'color': '#EC4899'},
        {'name': 'رياضة', 'icon': 'fas fa-dumbbell', 'color': '#14B8A6'},
        {'name': 'صحة وجمال', 'icon': 'fas fa-medkit', 'color': '#F97316'},
        {'name': 'أجهزة منزلية', 'icon': 'fas fa-blender', 'color': '#06B6D4'},
        {'name': 'إكسسوارات', 'icon': 'fas fa-gem', 'color': '#84CC16'},
    ]
    
    print("=" * 60)
    print("🏷️  إضافة فئات المنتجات")
    print("=" * 60)
    print()
    
    for cat_data in categories_data:
        category, created = Category.objects.get_or_create(
            name=cat_data['name'],
            defaults={
                'icon': cat_data['icon'],
                'color': cat_data['color']
            }
        )
        
        status = "✅ تم إنشاء" if created else "ℹ️  موجود مسبقاً"
        print(f"{status}: {category.name} ({category.color})")
    
    print()
    print("=" * 60)
    print(f"✅ تم! إجمالي الفئات: {Category.objects.count()}")
    print("=" * 60)
    print()
    print("💡 يمكنك الآن:")
    print("  1. فتح http://localhost:8000/admin/products/category/")
    print("  2. فتح واجهة React لرؤية الفئات")
    print()

if __name__ == '__main__':
    add_categories()
