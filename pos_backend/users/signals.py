from django.db.models.signals import post_save, post_migrate
from django.dispatch import receiver
from django.contrib.auth.models import User, Group, Permission
from .models import UserProfile
from django.contrib.contenttypes.models import ContentType


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """إنشاء ملف تعريف تلقائياً عند إنشاء مستخدم"""
    if created:
        UserProfile.objects.get_or_create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """حفظ ملف التعريف عند حفظ المستخدم"""
    if hasattr(instance, 'profile'):
        instance.profile.save()



# ===== RBAC bootstrap (Groups + Permissions) =====

PERMISSIONS_CATALOG = {
    # POS
    'pos_access': 'الوصول إلى شاشة نقاط البيع',
    # Sales
    'sales_view_own': 'عرض العمليات الخاصة بالمستخدم',
    'sales_view_team': 'عرض عمليات فريق المدير',
    'sales_cancel': 'إلغاء عملية بيع',
    # Returns
    'returns_create': 'إنشاء مرتجع',
    # Customers
    'customers_view': 'عرض العملاء',
    'customers_manage': 'إدارة العملاء',
    # Products
    'products_view': 'عرض المنتجات',
    'products_manage': 'إدارة المنتجات',
    # Reports
    'reports_view': 'عرض التقارير',
    # Cash Register
    'cashregister_view_own': 'عرض شيفت/خزنة المستخدم',
    'cashregister_view_team': 'عرض شيفت/خزنة فريق المدير',
    'cashregister_manage': 'إدارة الشيفت والخزنة',
    # Users / Settings
    'users_manage': 'إدارة المستخدمين',
    'settings_manage': 'إدارة الإعدادات',
}

GROUP_DEFINITIONS = {
    'Cashiers': {
        'perms': ['pos_access', 'sales_view_own', 'cashregister_view_own'],
    },
    'Cashier Plus': {
        'perms': ['pos_access', 'sales_view_own', 'cashregister_view_own', 'returns_create', 'customers_view'],
    },
    'Managers': {
        'perms': ['pos_access', 'sales_view_team', 'cashregister_view_team', 'returns_create', 'customers_view', 'reports_view'],
    },
    'Admins': {
        'perms': list(PERMISSIONS_CATALOG.keys()),
    },
}


@receiver(post_migrate)
def bootstrap_rbac(sender, **kwargs):
    """Ensure RBAC permissions & default groups exist."""
    try:
        ct = ContentType.objects.get_for_model(UserProfile)
    except Exception:
        return

    # Create permissions
    perm_objs = {}
    for codename, name in PERMISSIONS_CATALOG.items():
        perm, _ = Permission.objects.get_or_create(
            content_type=ct,
            codename=codename,
            defaults={'name': name},
        )
        # Keep name updated
        if perm.name != name:
            perm.name = name
            perm.save(update_fields=['name'])
        perm_objs[codename] = perm

    # Create groups and assign permissions
    for group_name, meta in GROUP_DEFINITIONS.items():
        grp, _ = Group.objects.get_or_create(name=group_name)
        desired = [perm_objs[c] for c in meta.get('perms', []) if c in perm_objs]
        grp.permissions.set(desired)




# Assign a default group at user creation.
# - Superusers go to Admins
# - Everyone else defaults to Cashiers (can be changed later from UI/admin)
@receiver(post_save, sender=User)
def assign_default_group(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        # Ensure groups exist (post_migrate should have created them)
        if instance.is_superuser:
            grp = Group.objects.get(name='Admins')
        else:
            grp = Group.objects.get(name='Cashiers')
        instance.groups.add(grp)
    except Exception:
        pass
