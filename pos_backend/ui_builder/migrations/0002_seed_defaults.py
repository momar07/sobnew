from django.db import migrations

def seed(apps, schema_editor):
    UiRoute = apps.get_model("ui_builder", "UiRoute")
    UiMenuItem = apps.get_model("ui_builder", "UiMenuItem")
    UiAction = apps.get_model("ui_builder", "UiAction")

    # ROUTES
    routes = [
        dict(key="pos.screen", label="POS", path="/", component="POS", wrapper="pos_shift", order=0),
        dict(key="dashboard.home", label="Dashboard", path="/dashboard", component="Dashboard", wrapper="auth", order=10),
        dict(key="products.list", label="Products", path="/products", component="Products", wrapper="auth", order=20,
             required_permissions=["users.products_view"]),
        dict(key="customers.list", label="Customers", path="/customers", component="Customers", wrapper="auth", order=30,
             required_permissions=["users.customers_view"]),
        dict(key="operations.list", label="Operations", path="/operations", component="Operations", wrapper="auth", order=40,
             required_permissions=["users.sales_view_own", "users.sales_view_team"]),
        dict(key="operations.details", label="Operation Details", path="/operations/:id", component="OperationDetails", wrapper="auth", order=41,
             required_permissions=["users.sales_view_own", "users.sales_view_team"]),
        dict(key="reports.home", label="Reports", path="/reports", component="Reports", wrapper="auth", order=50,
             required_permissions=["users.sales_view_own", "users.sales_view_team"]),
        dict(key="cashregister.home", label="Cash Register", path="/cash-register", component="CashRegister", wrapper="auth", order=60,
             required_permissions=["users.cashregister_view_own", "users.cashregister_view_team", "users.cashregister_manage"]),
        dict(key="users.manage", label="Users", path="/users", component="UserManagement", wrapper="auth", order=70,
             required_permissions=["auth.view_user"]),  # you can change later
        dict(key="performance.home", label="Performance", path="/performance", component="UserPerformance", wrapper="auth", order=80,
             required_permissions=["users.sales_view_team"]),
        dict(key="settings.home", label="Settings", path="/settings", component="Settings", wrapper="auth", order=90),
    ]

    for r in routes:
        UiRoute.objects.update_or_create(
            key=r["key"],
            defaults={
                "label": r["label"],
                "path": r["path"],
                "component": r["component"],
                "wrapper": r.get("wrapper","auth"),
                "order": r.get("order",0),
                "required_permissions": r.get("required_permissions", []),
            }
        )

    # SIDEBAR MENU (basic, flat)
    menu = [
        dict(key="menu.pos", label="POS", path="/", order=0),
        dict(key="menu.dashboard", label="Dashboard", path="/dashboard", order=10),
        dict(key="menu.products", label="Products", path="/products", order=20, required_permissions=["users.products_view"]),
        dict(key="menu.customers", label="Customers", path="/customers", order=30, required_permissions=["users.customers_view"]),
        dict(key="menu.operations", label="Operations", path="/operations", order=40, required_permissions=["users.sales_view_own","users.sales_view_team"]),
        dict(key="menu.reports", label="Reports", path="/reports", order=50, required_permissions=["users.sales_view_own","users.sales_view_team"]),
        dict(key="menu.cash", label="Cash Register", path="/cash-register", order=60, required_permissions=["users.cashregister_view_own","users.cashregister_view_team","users.cashregister_manage"]),
        dict(key="menu.users", label="Users", path="/users", order=70, required_permissions=["auth.view_user"]),
        dict(key="menu.performance", label="Performance", path="/performance", order=80, required_permissions=["users.sales_view_team"]),
        dict(key="menu.settings", label="Settings", path="/settings", order=90),
    ]
    for m in menu:
        UiMenuItem.objects.update_or_create(
            key=m["key"],
            defaults={
                "label": m["label"],
                "path": m["path"],
                "order": m.get("order",0),
                "icon": m.get("icon",""),
                "parent_key": m.get("parent_key",""),
                "badge": m.get("badge",""),
                "required_permissions": m.get("required_permissions", []),
            }
        )

    # ACTIONS
    actions = [
        dict(key="action.products.add", page_key="products.list", action_key="products.add", label="Add Product", order=10,
             required_permissions=["users.products_manage"]),
        dict(key="action.products.delete", page_key="products.list", action_key="products.delete", label="Delete Product", order=20,
             required_permissions=["users.products_manage"]),
        dict(key="action.sales.refund", page_key="operations.details", action_key="sales.refund", label="Refund", order=10,
             required_permissions=["users.returns_create"]),
    ]
    for a in actions:
        UiAction.objects.update_or_create(
            key=a["key"],
            defaults={
                "label": a["label"],
                "page_key": a["page_key"],
                "action_key": a["action_key"],
                "order": a.get("order",0),
                "variant": a.get("variant","primary"),
                "required_permissions": a.get("required_permissions", []),
                "api": a.get("api", {}),
            }
        )

def unseed(apps, schema_editor):
    UiRoute = apps.get_model("ui_builder", "UiRoute")
    UiMenuItem = apps.get_model("ui_builder", "UiMenuItem")
    UiAction = apps.get_model("ui_builder", "UiAction")
    UiRoute.objects.all().delete()
    UiMenuItem.objects.all().delete()
    UiAction.objects.all().delete()

class Migration(migrations.Migration):
    dependencies = [
        ("ui_builder", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed, reverse_code=unseed),
    ]
