from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SaleViewSet
from .views_returns import ReturnViewSet
from .views_cashregister import CashRegisterViewSet, CashTransactionViewSet

router = DefaultRouter()
router.register(r'sales', SaleViewSet)
router.register(r'returns', ReturnViewSet)
router.register(r'cash-registers', CashRegisterViewSet, basename='cash-register')
router.register(r'cash-transactions', CashTransactionViewSet, basename='cash-transaction')

urlpatterns = [
    path('', include(router.urls)),
]
