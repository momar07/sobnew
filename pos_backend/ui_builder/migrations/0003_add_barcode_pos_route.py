from django.db import migrations


def add_barcode_pos_route(apps, schema_editor):
    UiRoute = apps.get_model('ui_builder', 'UiRoute')

    # Add a dedicated route for barcode-first POS screen
    UiRoute.objects.update_or_create(
        key='pos.barcode',
        defaults={
            # UiRoute in this project doesn't have title_ar/title_en/icon fields.
            # Store UI metadata in `meta` and keep `label` as a simple fallback.
            'label': 'Barcode POS',
            'path': '/pos/barcode',
            'component': 'BarcodePOS',
            'wrapper': 'pos_shift',
            'required_permissions': ['users.sales_create'],
            'meta': {
                'title_ar': 'نقطة البيع - الباركود',
                'title_en': 'POS - Barcode',
                'icon': 'fas fa-barcode',
            },
        },
    )


def remove_barcode_pos_route(apps, schema_editor):
    UiRoute = apps.get_model('ui_builder', 'UiRoute')
    UiRoute.objects.filter(key='pos.barcode').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('ui_builder', '0002_seed_defaults'),
    ]

    operations = [
        migrations.RunPython(add_barcode_pos_route, remove_barcode_pos_route),
    ]
