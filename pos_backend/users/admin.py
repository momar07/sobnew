from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User, Group
from django.utils.html import format_html
from .models import UserProfile
from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

# فك التسجيل القديم
admin.site.unregister(User)



class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'ملف المستخدم'
    fk_name = 'user'
    fields = ('manager', 'employee_id', 'phone', 'address', 'avatar', 'is_active')
    extra = 0


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)

    # Show groups instead of legacy "role"
    list_display = ('username', 'email', 'first_name', 'last_name', 'get_groups', 'is_active', 'is_staff', 'date_joined')
    list_filter = ('is_active', 'is_staff', 'groups', 'date_joined')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('-date_joined',)

    def get_groups(self, obj):
        qs = obj.groups.all().values_list('name', flat=True)
        return ", ".join(qs) if qs else "-"
    get_groups.short_description = 'المجموعات'


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'manager', 'employee_id', 'phone', 'is_active', 'sales_count', 'total_sales_amount')
    list_filter = ('is_active', 'created_at', 'manager')
    search_fields = ('user__username', 'user__email', 'employee_id', 'phone', 'manager__username')
    autocomplete_fields = ('user', 'manager')
    fieldsets = (
        ('بيانات المستخدم', {'fields': ('user', 'manager', 'is_active')}),
        ('معلومات إضافية', {'fields': ('employee_id', 'phone', 'address', 'avatar')}),
        ('معلومات النظام', {'fields': ('created_at', 'updated_at')}),
    )
    readonly_fields = ('created_at', 'updated_at')


# NOTE:
# We no longer use UserProfile.role. Access control is now based on Django Groups & Permissions.
