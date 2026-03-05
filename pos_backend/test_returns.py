#!/usr/bin/env python
"""
سكريبت لاختبار المرتجعات في النظام
يُستخدم لفحص سبب عدم ظهور المرتجعات في التقارير والخزينة
"""

import os
import sys
import django

# إعداد Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pos_backend.settings')
django.setup()

from sales.models import Return, CashRegister, Sale
from django.utils import timezone
from django.db.models import Sum, Count

def test_returns():
    print("=" * 80)
    print("فحص المرتجعات في النظام")
    print("=" * 80)
    
    # 1. إجمالي المرتجعات
    all_returns = Return.objects.all()
    print(f"\n1️⃣ إجمالي المرتجعات في قاعدة البيانات: {all_returns.count()}")
    
    if all_returns.count() == 0:
        print("   ⚠️ لا توجد أي مرتجعات!")
        print("   💡 قم بإنشاء مرتجع واحد على الأقل من واجهة POS")
        return
    
    # 2. عرض أول 10 مرتجعات
    print("\n2️⃣ أول 10 مرتجعات:")
    for i, r in enumerate(all_returns[:10], 1):
        print(f"   {i}. Return ID: {str(r.id)[:8]}")
        print(f"      - المبلغ: {r.total_amount} ر.س")
        print(f"      - الحالة: {r.status}")
        print(f"      - تاريخ الإنشاء: {r.created_at}")
        print(f"      - الشيفت: {str(r.cash_register_id)[:8] if r.cash_register_id else 'None ❌'}")
        print(f"      - المستخدم: {r.user.username if r.user else 'None'}")
        print()
    
    # 3. تصنيف حسب الحالة
    print("\n3️⃣ تصنيف حسب الحالة:")
    statuses = Return.objects.values('status').annotate(count=Count('id'), total=Sum('total_amount'))
    for s in statuses:
        print(f"   - {s['status']}: {s['count']} مرتجع، إجمالي {s['total'] or 0} ر.س")
    
    # 4. المرتجعات المُربطة بشيفت
    returns_with_shift = Return.objects.filter(cash_register__isnull=False).count()
    returns_without_shift = Return.objects.filter(cash_register__isnull=True).count()
    print(f"\n4️⃣ ربط المرتجعات بالشيفتات:")
    print(f"   - مرتجعات مُربطة بشيفت: {returns_with_shift} ✅")
    print(f"   - مرتجعات بدون شيفت: {returns_without_shift} {'⚠️' if returns_without_shift > 0 else ''}")
    
    # 5. إحصائيات اليوم
    today = timezone.now().date()
    today_returns = Return.objects.filter(created_at__date=today, status='completed')
    today_stats = today_returns.aggregate(total=Sum('total_amount'), count=Count('id'))
    
    print(f"\n5️⃣ إحصائيات اليوم ({today}):")
    print(f"   - عدد المرتجعات: {today_stats['count'] or 0}")
    print(f"   - إجمالي المبلغ: {today_stats['total'] or 0} ر.س")
    
    if today_stats['count'] == 0:
        print("   ⚠️ لا توجد مرتجعات اليوم!")
        print("   💡 قم بإنشاء مرتجع جديد اليوم لاختبار التقارير")
    
    # 6. فحص الشيفتات المفتوحة
    print("\n6️⃣ فحص الشيفتات المفتوحة:")
    open_shifts = CashRegister.objects.filter(status='open')
    print(f"   - شيفتات مفتوحة: {open_shifts.count()}")
    
    for shift in open_shifts:
        returns_in_shift = shift.returns.filter(status='completed')
        returns_count = returns_in_shift.count()
        returns_total = returns_in_shift.aggregate(total=Sum('total_amount'))['total'] or 0
        
        print(f"\n   شيفت #{str(shift.id)[:8]}:")
        print(f"      - المستخدم: {shift.user.username}")
        print(f"      - وقت الفتح: {shift.opened_at}")
        print(f"      - المبيعات: {shift.sales.filter(status='completed').count()}")
        print(f"      - المرتجعات: {returns_count}")
        print(f"      - إجمالي المرتجعات: {returns_total} ر.س")
        
        if returns_count == 0:
            print(f"      ⚠️ لا توجد مرتجعات في هذا الشيفت!")
    
    # 7. المرتجعات اليوم بدون شيفت
    today_returns_no_shift = Return.objects.filter(
        created_at__date=today,
        status='completed',
        cash_register__isnull=True
    ).count()
    
    if today_returns_no_shift > 0:
        print(f"\n7️⃣ ⚠️ مرتجعات اليوم بدون شيفت: {today_returns_no_shift}")
        print("   💡 هذه المرتجعات لن تظهر في الخزينة!")
        print("   💡 تأكد من فتح الشيفت قبل إنشاء المرتجعات")
    
    print("\n" + "=" * 80)
    print("انتهى الفحص")
    print("=" * 80)

def fix_returns_without_shift():
    """محاولة إصلاح المرتجعات بدون شيفت"""
    print("\n🔧 محاولة إصلاح المرتجعات بدون شيفت...")
    
    returns_without_shift = Return.objects.filter(cash_register__isnull=True)
    count = returns_without_shift.count()
    
    if count == 0:
        print("   ✅ جميع المرتجعات مُربطة بشيفت")
        return
    
    print(f"   وجد {count} مرتجع بدون شيفت")
    
    for r in returns_without_shift:
        # محاولة إيجاد شيفت مناسب
        # ابحث عن شيفت للمستخدم نفسه في نفس اليوم
        shift = CashRegister.objects.filter(
            user=r.user,
            opened_at__date=r.created_at.date()
        ).first()
        
        if shift:
            r.cash_register = shift
            r.save()
            print(f"   ✅ تم ربط Return {str(r.id)[:8]} بـ Shift {str(shift.id)[:8]}")
        else:
            print(f"   ⚠️ لم يتم إيجاد شيفت مناسب لـ Return {str(r.id)[:8]}")

if __name__ == '__main__':
    test_returns()
    
    # اسأل المستخدم إذا يريد محاولة الإصلاح
    if Return.objects.filter(cash_register__isnull=True).count() > 0:
        answer = input("\n❓ هل تريد محاولة إصلاح المرتجعات بدون شيفت؟ (y/n): ")
        if answer.lower() == 'y':
            fix_returns_without_shift()
            print("\n🔄 إعادة فحص...")
            test_returns()
