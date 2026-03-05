from django.db import models

class ScopeType(models.TextChoices):
    GLOBAL = "global", "Global"
    BRANCH = "branch", "Branch"

class PermissionMode(models.TextChoices):
    ANY = "any", "Any"
    ALL = "all", "All"

class UiBase(models.Model):
    key = models.SlugField(max_length=120, unique=True, help_text="Stable identifier, e.g. products.list")
    label = models.CharField(max_length=120)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    # Future-proofing: allow per-branch UI definitions
    scope_type = models.CharField(max_length=20, choices=ScopeType.choices, default=ScopeType.GLOBAL)
    scope_key = models.CharField(max_length=80, blank=True, default="", help_text="e.g. branch code/id. Empty = global.")

    # RBAC
    required_permissions = models.JSONField(default=list, blank=True, help_text="List of 'app_label.codename'")
    required_groups = models.JSONField(default=list, blank=True, help_text="List of Django group names")
    permission_mode = models.CharField(max_length=10, choices=PermissionMode.choices, default=PermissionMode.ANY)

    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        abstract = True
        ordering = ["order", "label"]

    def __str__(self):
        return f"{self.key} ({self.label})"

class UiRoute(UiBase):
    class Wrapper(models.TextChoices):
        AUTH = "auth", "Protected (Auth)"
        POS_SHIFT = "pos_shift", "POS Protected (Open Shift)"
        PUBLIC = "public", "Public"

    path = models.CharField(max_length=160, help_text="React Router path, e.g. /products or /operations/:id")
    component = models.CharField(max_length=120, help_text="React page component file name, e.g. Products")
    wrapper = models.CharField(max_length=20, choices=Wrapper.choices, default=Wrapper.AUTH)

class UiMenuItem(UiBase):
    path = models.CharField(max_length=160, help_text="React Router path")
    icon = models.CharField(max_length=80, blank=True, default="", help_text="Icon name as string")
    parent_key = models.SlugField(max_length=120, blank=True, default="", help_text="Optional parent menu key")
    badge = models.CharField(max_length=40, blank=True, default="")

class UiAction(UiBase):
    page_key = models.SlugField(max_length=120, help_text="Page identifier, e.g. products.list")
    action_key = models.SlugField(max_length=120, help_text="Action identifier, e.g. products.add")
    variant = models.CharField(max_length=30, blank=True, default="primary")
    # optional: describe how to execute (generic API call)
    api = models.JSONField(default=dict, blank=True, help_text="Optional: {method, url}. If empty, frontend handles by action_key")
