from rest_framework import serializers
from .models import UiRoute, UiMenuItem, UiAction

class UiRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = UiRoute
        fields = ["key", "label", "path", "component", "wrapper", "meta", "order"]

class UiMenuItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = UiMenuItem
        fields = ["key", "label", "path", "icon", "parent_key", "badge", "meta", "order"]

class UiActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UiAction
        fields = ["key", "label", "page_key", "action_key", "variant", "api", "meta", "order"]
