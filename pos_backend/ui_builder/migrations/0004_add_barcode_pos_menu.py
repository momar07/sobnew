from django.db import migrations


def add_barcode_pos_menu(apps, schema_editor):
    UiMenuItem = apps.get_model('ui_builder', 'UiMenuItem')

    UiMenuItem.objects.update_or_create(
        key='menu.pos_barcode',
        defaults={
            'label': 'Barcode POS',
            'path': '/pos/barcode',
            'order': 1,
            'icon': 'fas fa-barcode',
            'parent_key': '',
            'badge': '',
            'required_permissions': ['users.sales_create'],
            # Keep extra i18n metadata in `meta` (if your model has it).
            'meta': {
                'title_ar': 'نقطة البيع - الباركود',
                'title_en': 'POS - Barcode',
            },
        },
    )


def remove_barcode_pos_menu(apps, schema_editor):
    UiMenuItem = apps.get_model('ui_builder', 'UiMenuItem')
    UiMenuItem.objects.filter(key='menu.pos_barcode').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('ui_builder', '0003_add_barcode_pos_route'),
    ]

    operations = [
        migrations.RunPython(add_barcode_pos_menu, remove_barcode_pos_menu),
    ]
