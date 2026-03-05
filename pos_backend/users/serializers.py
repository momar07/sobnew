from rest_framework import serializers
from django.contrib.auth.models import User, Group
from django.db import IntegrityError
from .models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    sales_count = serializers.ReadOnlyField()
    total_sales_amount = serializers.ReadOnlyField()
    employee_number = serializers.CharField(source='employee_id', required=False, allow_blank=True)
    total_sales = serializers.IntegerField(source='sales_count', read_only=True)
    total_revenue = serializers.DecimalField(source='total_sales_amount', max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            'id',
            'manager',
            'phone',
            'address',
            'employee_id',
            'employee_number',
            'avatar',
            'is_active',
            'full_name',
            'sales_count',
            'total_sales',
            'total_sales_amount',
            'total_revenue',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'sales_count', 'total_sales_amount']




class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ['id', 'name']


class UserSerializer(serializers.ModelSerializer):
    # بعض الـ users القديمة ممكن مايبقاش لها UserProfile.
    # لو استخدمنا nested serializer مباشر (instance.profile) هيحصل 500 في list.
    profile = serializers.SerializerMethodField()
    groups = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'is_active', 'date_joined', 'profile', 'groups'
        ]
        read_only_fields = ['id', 'date_joined']

    def get_groups(self, obj):
        return [g.name for g in obj.groups.all()]

    def get_profile(self, obj):
        profile, _ = UserProfile.objects.get_or_create(user=obj)
        return UserProfileSerializer(profile).data

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', None)

        instance.username = validated_data.get('username', instance.username)
        instance.email = validated_data.get('email', instance.email)
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.is_active = validated_data.get('is_active', instance.is_active)
        instance.save()

        if profile_data is not None:
            profile, _ = UserProfile.objects.get_or_create(user=instance)
            for field in ['manager', 'phone', 'address', 'employee_id', 'avatar', 'is_active']:
                if field in profile_data:
                    setattr(profile, field, profile_data[field])
            profile.save()

        return instance


class CurrentUserSerializer(serializers.ModelSerializer):
    """Serializer للمستخدم الحالي"""
    profile = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    groups = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'is_active', 'is_staff', 'profile', 'permissions', 'groups'
        ]

    def get_permissions(self, obj):
        perms = set(obj.get_all_permissions())
        users_perms = sorted([p.split('.', 1)[1] for p in perms if p.startswith('users.')])
        return users_perms

    def get_groups(self, obj):
        return [g.name for g in obj.groups.all()]

    def get_profile(self, obj):
        profile, _ = UserProfile.objects.get_or_create(user=obj)
        return UserProfileSerializer(profile).data


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    phone = serializers.CharField(required=False, allow_blank=True)
    employee_number = serializers.CharField(required=False, allow_blank=True)
    group = serializers.CharField(required=False, allow_blank=True)
    # Also allow sending group IDs directly (frontend uses groups: [id])
    groups = serializers.PrimaryKeyRelatedField(queryset=Group.objects.all(), many=True, required=False)
    # Frontend sends phone/employee_number inside profile
    profile = serializers.DictField(required=False, write_only=True)

    class Meta:
        model = User
        fields = [
            'username', 'password', 'email',
            'first_name', 'last_name',
            'phone', 'employee_number',
            'group',
            'groups',
            'profile'
        ]

    def _norm(self, v):
        if v is None:
            return None
        v = str(v).strip()
        return v or None

    def validate(self, attrs):
        profile = attrs.get('profile') or {}
        employee_number = self._norm(attrs.get('employee_number') or profile.get('employee_number'))
        if employee_number and UserProfile.objects.filter(employee_id=employee_number).exists():
            raise serializers.ValidationError({
                'employee_number': ['رقم الموظف مستخدم من قبل.']
            })
        attrs['employee_number'] = employee_number
        attrs['phone'] = self._norm(attrs.get('phone') or profile.get('phone'))
        return attrs

    def create(self, validated_data):
        profile = validated_data.pop('profile', {}) or {}

        group_ids = validated_data.pop('groups', [])

        phone = self._norm(validated_data.pop('phone', None) or profile.get('phone'))
        employee_number = self._norm(validated_data.pop('employee_number', None) or profile.get('employee_number'))
        group_name = (validated_data.pop('group', None) or 'Cashiers').strip()

        user = User.objects.create_user(**validated_data)

        # Prefer explicit group IDs; fallback to group name (legacy)
        if group_ids:
            user.groups.set(group_ids)

        try:
            UserProfile.objects.update_or_create(
                user=user,
                defaults={
                    'phone': phone,
                    'employee_id': employee_number
                }
            )
        except IntegrityError as e:
            if 'users_userprofile.employee_id' in str(e):
                raise serializers.ValidationError({
                    'employee_number': ['رقم الموظف مستخدم من قبل.']
                })
            raise

        # Assign legacy group name if no group ids were provided
        if not group_ids:
            try:
                grp = Group.objects.get(name=group_name)
                user.groups.add(grp)
            except Group.DoesNotExist:
                pass

        return user
