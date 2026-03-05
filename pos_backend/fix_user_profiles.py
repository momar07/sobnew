#!/usr/bin/env python
"""
Fix user profiles - Create missing UserProfile for existing users
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pos_backend.settings')
django.setup()

from django.contrib.auth.models import User
from users.models import UserProfile

def fix_user_profiles():
    print("🔍 Checking user profiles...")
    
    users = User.objects.all()
    
    if not users.exists():
        print("⚠️  No users found! Please create users first.")
        print("   Run: python create_users.py")
        return
    
    print(f"📋 Found {users.count()} users:")
    
    fixed_count = 0
    for user in users:
        try:
            profile = user.profile
            print(f"  ✅ {user.username} - Profile exists (profile)")
        except UserProfile.DoesNotExist:
            print(f"  ❌ {user.username} - NO PROFILE! Creating...")
            
            # Determine role based on username or permissions
            if 'admin' in user.username.lower() or user.is_superuser:
                role = 'admin'
            elif 'manager' in user.username.lower() or user.is_staff:
                role = 'manager'
            else:
                role = 'cashier'
            
            # Create profile
            UserProfile.objects.create(
                user=user,
                role=role,
                employee_number=f'EMP{user.id:03d}',
                phone=''
            )
            print(f"     ✅ Created profile: {role}")
            fixed_count += 1
    
    print("\n" + "="*50)
    if fixed_count > 0:
        print(f"✅ Fixed {fixed_count} user profile(s)")
    else:
        print("✅ All users have profiles!")
    print("="*50)
    print("\n💡 Now try logging in again and accessing the Users page.")

if __name__ == '__main__':
    fix_user_profiles()
