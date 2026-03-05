from typing import Dict, List, Set, Optional
from django.contrib.auth.models import User
from .models import UiRoute, UiMenuItem, UiAction, PermissionMode, ScopeType
import json

def _normalize_list(value):
    """Normalize JSONField/list-ish values that might come back as None, list, or a JSON string."""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return []
        # Try JSON first (e.g. '["cashier"]')
        try:
            v = json.loads(s)
            if isinstance(v, list):
                return v
        except Exception:
            pass
        # Fallback: split by commas/newlines
        parts = [p.strip() for p in s.replace("\n", ",").split(",")]
        return [p for p in parts if p]
    # Unknown type
    return []


def _passes_perms(user_perms: Set[str], required, mode: str) -> bool:
    required = _normalize_list(required)
    if not required:
        return True
    req = set(required)
    if mode == PermissionMode.ALL:
        return req.issubset(user_perms)
    # ANY
    return len(req.intersection(user_perms)) > 0

def _passes_groups(user_groups: Set[str], required_groups) -> bool:
    required_groups = _normalize_list(required_groups)
    if not required_groups:
        return True
    return len(set(required_groups).intersection(user_groups)) > 0

def build_ui_schema_for_user(
    user: User,
    *,
    scope_type: str = ScopeType.GLOBAL,
    scope_key: str = "",
) -> Dict:
    """Return UI schema filtered by permissions/groups and by (optional) scope (global/branch)."""
    user_perms = set(user.get_all_permissions())
    user_groups = set(user.groups.values_list("name", flat=True))

    def scope_qs(qs):
        # Always include global items.
        if scope_type == ScopeType.BRANCH and scope_key:
            return qs.filter(is_active=True).filter(
                # global OR matching branch
            ).filter(
                # emulate OR in a simple way for sqlite:
                # (scope_type='global') OR (scope_type='branch' and scope_key=...)
                # We'll do union.
            )
        return qs.filter(is_active=True)

    # Scope handling with union to support sqlite
    routes_qs = UiRoute.objects.filter(is_active=True)
    menu_qs = UiMenuItem.objects.filter(is_active=True)
    actions_qs = UiAction.objects.filter(is_active=True)

    if scope_type == ScopeType.BRANCH and scope_key:
        routes_qs = routes_qs.filter(scope_type=ScopeType.GLOBAL).union(
            UiRoute.objects.filter(is_active=True, scope_type=ScopeType.BRANCH, scope_key=scope_key),
            all=True
        )
        menu_qs = menu_qs.filter(scope_type=ScopeType.GLOBAL).union(
            UiMenuItem.objects.filter(is_active=True, scope_type=ScopeType.BRANCH, scope_key=scope_key),
            all=True
        )
        actions_qs = actions_qs.filter(scope_type=ScopeType.GLOBAL).union(
            UiAction.objects.filter(is_active=True, scope_type=ScopeType.BRANCH, scope_key=scope_key),
            all=True
        )

    routes = []
    for r in routes_qs.order_by("order","label"):
        if user.is_superuser or (_passes_perms(user_perms, r.required_permissions, r.permission_mode) and _passes_groups(user_groups, r.required_groups)):
            routes.append(r)

    sidebar = []
    for m in menu_qs.order_by("order","label"):
        if user.is_superuser or (_passes_perms(user_perms, m.required_permissions, m.permission_mode) and _passes_groups(user_groups, m.required_groups)):
            sidebar.append(m)

    actions_by_page: Dict[str, List] = {}
    for a in actions_qs.order_by("page_key","order","label"):
        if user.is_superuser or (_passes_perms(user_perms, a.required_permissions, a.permission_mode) and _passes_groups(user_groups, a.required_groups)):
            actions_by_page.setdefault(a.page_key, []).append(a)

    return {
        "routes": routes,
        "sidebar": sidebar,
        "actions": actions_by_page,
        "permissions": sorted(user_perms),
        "groups": sorted(user_groups),
        "scope": {"type": scope_type, "key": scope_key},
    }
