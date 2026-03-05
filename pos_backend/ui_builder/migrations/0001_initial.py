# Generated manually (run `python manage.py makemigrations ui_builder` to regenerate if needed)
from django.db import migrations, models

class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='UiRoute',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.SlugField(help_text='Stable identifier, e.g. products.list', max_length=120, unique=True)),
                ('label', models.CharField(max_length=120)),
                ('order', models.PositiveIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('scope_type', models.CharField(choices=[('global', 'Global'), ('branch', 'Branch')], default='global', max_length=20)),
                ('scope_key', models.CharField(blank=True, default='', help_text='e.g. branch code/id. Empty = global.', max_length=80)),
                ('required_permissions', models.JSONField(blank=True, default=list, help_text="List of 'app_label.codename'")),
                ('required_groups', models.JSONField(blank=True, default=list, help_text='List of Django group names')),
                ('permission_mode', models.CharField(choices=[('any', 'Any'), ('all', 'All')], default='any', max_length=10)),
                ('meta', models.JSONField(blank=True, default=dict)),
                ('path', models.CharField(help_text='React Router path, e.g. /products or /operations/:id', max_length=160)),
                ('component', models.CharField(help_text='React page component file name, e.g. Products', max_length=120)),
                ('wrapper', models.CharField(choices=[('auth', 'Protected (Auth)'), ('pos_shift', 'POS Protected (Open Shift)'), ('public', 'Public')], default='auth', max_length=20)),
            ],
            options={'ordering': ['order', 'label']},
        ),
        migrations.CreateModel(
            name='UiMenuItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.SlugField(help_text='Stable identifier, e.g. products.list', max_length=120, unique=True)),
                ('label', models.CharField(max_length=120)),
                ('order', models.PositiveIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('scope_type', models.CharField(choices=[('global', 'Global'), ('branch', 'Branch')], default='global', max_length=20)),
                ('scope_key', models.CharField(blank=True, default='', help_text='e.g. branch code/id. Empty = global.', max_length=80)),
                ('required_permissions', models.JSONField(blank=True, default=list, help_text="List of 'app_label.codename'")),
                ('required_groups', models.JSONField(blank=True, default=list, help_text='List of Django group names')),
                ('permission_mode', models.CharField(choices=[('any', 'Any'), ('all', 'All')], default='any', max_length=10)),
                ('meta', models.JSONField(blank=True, default=dict)),
                ('path', models.CharField(help_text='React Router path', max_length=160)),
                ('icon', models.CharField(blank=True, default='', help_text='Icon name as string', max_length=80)),
                ('parent_key', models.SlugField(blank=True, default='', help_text='Optional parent menu key', max_length=120)),
                ('badge', models.CharField(blank=True, default='', max_length=40)),
            ],
            options={'ordering': ['order', 'label']},
        ),
        migrations.CreateModel(
            name='UiAction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.SlugField(help_text='Stable identifier, e.g. products.list', max_length=120, unique=True)),
                ('label', models.CharField(max_length=120)),
                ('order', models.PositiveIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('scope_type', models.CharField(choices=[('global', 'Global'), ('branch', 'Branch')], default='global', max_length=20)),
                ('scope_key', models.CharField(blank=True, default='', help_text='e.g. branch code/id. Empty = global.', max_length=80)),
                ('required_permissions', models.JSONField(blank=True, default=list, help_text="List of 'app_label.codename'")),
                ('required_groups', models.JSONField(blank=True, default=list, help_text='List of Django group names')),
                ('permission_mode', models.CharField(choices=[('any', 'Any'), ('all', 'All')], default='any', max_length=10)),
                ('meta', models.JSONField(blank=True, default=dict)),
                ('page_key', models.SlugField(help_text='Page identifier, e.g. products.list', max_length=120)),
                ('action_key', models.SlugField(help_text='Action identifier, e.g. products.add', max_length=120)),
                ('variant', models.CharField(blank=True, default='primary', max_length=30)),
                ('api', models.JSONField(blank=True, default=dict, help_text='Optional: {method, url}. If empty, frontend handles by action_key')),
            ],
            options={'ordering': ['order', 'label']},
        ),
    ]
