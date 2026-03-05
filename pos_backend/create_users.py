"""
سكريبت لإنشاء مستخدمين تجريبيين
الاستخدام: python create_users.py
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pos_backend.settings')
django.setup()

from django.contrib.auth.models import User
from users.models import UserProfile


def create_users():
    """إنشاء مستخدمين تجريبيين"""
    
    users_data = [
        {
            'username': 'admin',
            'password': 'admin123',
            'email': 'admin@pos.com',
            'first_name': 'أحمد',
            'last_name': 'المدير',
                        'employee_id': 'EMP001',
            'phone': '0501111111'
        },
        {
            'username': 'manager',
            'password': 'manager123',
            'email': 'manager@pos.com',
            'first_name': 'محمد',
            'last_name': 'مدير المتجر',
                        'employee_id': 'EMP002',
            'phone': '0502222222'
        },
        {
            'username': 'cashier1',
            'password': 'cashier123',
            'email': 'cashier1@pos.com',
            'first_name': 'فاطمة',
            'last_name': 'الكاشير',
                        'employee_id': 'EMP003',
            'phone': '0503333333'
        },
        {
            'username': 'cashier2',
            'password': 'cashier123',
            'email': 'cashier2@pos.com',
            'first_name': 'علي',
            'last_name': 'الكاشير',
                        'employee_id': 'EMP004',
            'phone': '0504444444'
        },
    ]
    
    print("=" * 70)
    print("👥 إنشاء مستخدمين تجريبيين")
    print("=" * 70)
    print()
    
    for user_data in users_data:
        username = user_data['username']
        
        # التحقق من وجود المستخدم
        if User.objects.filter(username=username).exists():
            print(f"ℹ️  المستخدم موجود مسبقاً: {username}")
            continue
        
        # إنشاء المستخدم
        user = User.objects.create_user(
            username=user_data['username'],
            password=user_data['password'],
            email=user_data['email'],
            first_name=user_data['first_name'],
            last_name=user_data['last_name']
        )
        
        # تحديث Profile
        profile = user.profile        profile.employee_id = user_data['employee_id']
        profile.phone = user_data['phone']
        profile.save()
        
        # إعطاء صلاحيات staff للـ admin
        if user_data['role'] == 'admin':
            user.is_staff = True
            user.is_superuser = True
            user.save()
        
        role_ar = {
            'admin': 'مدير النظام',
            'manager': 'مدير المتجر',
            'cashier': 'كاشير'
        }
        
        print(f"✅ تم إنشاء: {user.get_full_name()} ({username}) - {role_ar[user_data['role']]}")
    
    print()
    print("=" * 70)
    print("✅ اكتمل!")
    print("=" * 70)
    print()
    print("📋 معلومات تسجيل الدخول:")
    print()
    print("┌─────────────┬──────────────┬─────────────────┐")
    print("│ Username    │ Password     │ الدور           │")
    print("├─────────────┼──────────────┼─────────────────┤")
    print("│ admin       │ admin123     │ مدير النظام     │")
    print("│ manager     │ manager123   │ مدير المتجر     │")
    print("│ cashier1    │ cashier123   │ كاشير           │")
    print("│ cashier2    │ cashier123   │ كاشير           │")
    print("└─────────────┴──────────────┴─────────────────┘")
    print()
    print("🔐 يمكنك الآن تسجيل الدخول بأي من هذه الحسابات!")
    print()
    print("💡 اختبر:")
    print("  1. افتح: http://localhost:5173")
    print("  2. سجل دخول بأي حساب")
    print("  3. جرب الصلاحيات المختلفة")
    print()


if __name__ == '__main__':
    create_users()

# NOTE: Roles removed; assign groups from Django admin or update this script if needed.
