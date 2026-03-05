from django.contrib import admin
from .models import UiRoute, UiMenuItem, UiAction

@admin.register(UiRoute)
class UiRouteAdmin(admin.ModelAdmin):
    list_display = ("order", "key", "label", "path", "component", "wrapper", "is_active", "scope_type", "scope_key")
    list_filter = ("is_active", "wrapper", "scope_type")
    search_fields = ("key", "label", "path", "component")
    ordering = ("order", "key")

@admin.register(UiMenuItem)
class UiMenuItemAdmin(admin.ModelAdmin):
    list_display = ("order", "key", "label", "path", "icon", "parent_key", "is_active", "scope_type", "scope_key")
    list_filter = ("is_active", "scope_type")
    search_fields = ("key", "label", "path", "parent_key")
    ordering = ("order", "key")

@admin.register(UiAction)
class UiActionAdmin(admin.ModelAdmin):
    list_display = ("order", "page_key", "action_key", "key", "label", "variant", "is_active", "scope_type", "scope_key")
    list_filter = ("is_active", "scope_type", "variant")
    search_fields = ("key", "label", "page_key", "action_key")
    ordering = ("page_key", "order", "key")
