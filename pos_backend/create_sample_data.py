"""
Script لإنشاء بيانات تجريبية للنظام
يمكن تشغيله من Django shell أو كملف standalone
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pos_backend.settings')
django.setup()

from products.models import Category, Product
from customers.models import Customer
from decimal import Decimal

def create_categories():
    """إنشاء فئات المنتجات"""
    categories_data = [
        {'name': 'إلكترونيات', 'icon': 'fas fa-laptop', 'color': '#3B82F6'},
        {'name': 'أطعمة ومشروبات', 'icon': 'fas fa-coffee', 'color': '#10B981'},
        {'name': 'ملابس', 'icon': 'fas fa-tshirt', 'color': '#F59E0B'},
        {'name': 'كتب وقرطاسية', 'icon': 'fas fa-book', 'color': '#8B5CF6'},
        {'name': 'أدوات منزلية', 'icon': 'fas fa-home', 'color': '#EF4444'},
    ]
    
    categories = []
    for cat_data in categories_data:
        category, created = Category.objects.get_or_create(
            name=cat_data['name'],
            defaults={
                'icon': cat_data['icon'],
                'color': cat_data['color']
            }
        )
        categories.append(category)
        print(f"{'✓ تم إنشاء' if created else '✓ موجود مسبقاً'}: {category.name}")
    
    return categories

def create_products(categories):
    """إنشاء منتجات تجريبية"""
    products_data = [
        # إلكترونيات
        {'name': 'لابتوب Dell Latitude', 'category': categories[0], 'price': '3500.00', 'cost': '2800.00', 'stock': 10, 'barcode': '1001'},
        {'name': 'ماوس لاسلكي Logitech', 'category': categories[0], 'price': '150.00', 'cost': '100.00', 'stock': 50, 'barcode': '1002'},
        {'name': 'لوحة مفاتيح ميكانيكية', 'category': categories[0], 'price': '450.00', 'cost': '300.00', 'stock': 25, 'barcode': '1003'},
        {'name': 'سماعات بلوتوث', 'category': categories[0], 'price': '250.00', 'cost': '150.00', 'stock': 30, 'barcode': '1004'},
        
        # أطعمة ومشروبات
        {'name': 'قهوة محمصة 500g', 'category': categories[1], 'price': '45.00', 'cost': '30.00', 'stock': 100, 'barcode': '2001'},
        {'name': 'شاي أخضر 100 كيس', 'category': categories[1], 'price': '25.00', 'cost': '15.00', 'stock': 150, 'barcode': '2002'},
        {'name': 'عسل طبيعي 1kg', 'category': categories[1], 'price': '120.00', 'cost': '80.00', 'stock': 40, 'barcode': '2003'},
        {'name': 'شوكولاتة فاخرة', 'category': categories[1], 'price': '35.00', 'cost': '20.00', 'stock': 80, 'barcode': '2004'},
        
        # ملابس
        {'name': 'قميص قطني رجالي', 'category': categories[2], 'price': '120.00', 'cost': '70.00', 'stock': 60, 'barcode': '3001'},
        {'name': 'بنطال جينز', 'category': categories[2], 'price': '180.00', 'cost': '100.00', 'stock': 45, 'barcode': '3002'},
        {'name': 'حذاء رياضي', 'category': categories[2], 'price': '350.00', 'cost': '200.00', 'stock': 35, 'barcode': '3003'},
        
        # كتب وقرطاسية
        {'name': 'دفتر ملاحظات A4', 'category': categories[3], 'price': '15.00', 'cost': '8.00', 'stock': 200, 'barcode': '4001'},
        {'name': 'أقلام جاف 10 قطع', 'category': categories[3], 'price': '20.00', 'cost': '12.00', 'stock': 150, 'barcode': '4002'},
        {'name': 'كتاب تطوير الذات', 'category': categories[3], 'price': '60.00', 'cost': '35.00', 'stock': 50, 'barcode': '4003'},
        
        # أدوات منزلية
        {'name': 'طقم أواني طهي', 'category': categories[4], 'price': '450.00', 'cost': '280.00', 'stock': 20, 'barcode': '5001'},
        {'name': 'مكنسة كهربائية', 'category': categories[4], 'price': '550.00', 'cost': '350.00', 'stock': 15, 'barcode': '5002'},
        {'name': 'طقم أطباق 24 قطعة', 'category': categories[4], 'price': '280.00', 'cost': '180.00', 'stock': 25, 'barcode': '5003'},
    ]
    
    for prod_data in products_data:
        product, created = Product.objects.get_or_create(
            barcode=prod_data['barcode'],
            defaults={
                'name': prod_data['name'],
                'category': prod_data['category'],
                'price': Decimal(prod_data['price']),
                'cost': Decimal(prod_data['cost']),
                'stock': prod_data['stock'],
                'is_active': True,
            }
        )
        print(f"{'✓ تم إنشاء' if created else '✓ موجود مسبقاً'}: {product.name}")

def create_customers():
    """إنشاء عملاء تجريبيين"""
    customers_data = [
        {'name': 'أحمد محمد السعيد', 'phone': '0501234567', 'email': 'ahmed@example.com', 'address': 'الرياض، حي الملقا'},
        {'name': 'فاطمة علي', 'phone': '0507654321', 'email': 'fatima@example.com', 'address': 'جدة، حي الروضة'},
        {'name': 'خالد عبدالله', 'phone': '0509876543', 'email': 'khaled@example.com', 'address': 'الدمام، حي الفيصلية'},
        {'name': 'نورة سعيد', 'phone': '0503456789', 'email': 'noura@example.com', 'address': 'مكة، حي العزيزية'},
        {'name': 'محمود حسن', 'phone': '0508765432', 'email': 'mahmoud@example.com', 'address': 'المدينة، حي الحرة'},
    ]
    
    for cust_data in customers_data:
        customer, created = Customer.objects.get_or_create(
            phone=cust_data['phone'],
            defaults={
                'name': cust_data['name'],
                'email': cust_data['email'],
                'address': cust_data['address'],
            }
        )
        print(f"{'✓ تم إنشاء' if created else '✓ موجود مسبقاً'}: {customer.name}")

def main():
    """تشغيل السكريبت"""
    print("=" * 60)
    print("🚀 بدء إنشاء البيانات التجريبية...")
    print("=" * 60)
    
    print("\n📂 إنشاء الفئات...")
    categories = create_categories()
    
    print("\n📦 إنشاء المنتجات...")
    create_products(categories)
    
    print("\n👥 إنشاء العملاء...")
    create_customers()
    
    print("\n" + "=" * 60)
    print("✅ تم إنشاء جميع البيانات بنجاح!")
    print("=" * 60)
    print("\n💡 يمكنك الآن:")
    print("  1. فتح واجهة React: http://localhost:5173")
    print("  2. الدخول إلى Admin Panel: http://localhost:8000/admin")
    print("  3. البدء في استخدام نظام POS")
    print()

if __name__ == '__main__':
    main()
