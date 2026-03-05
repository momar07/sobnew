import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { salesAPI, returnsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const OperationDetails = () => {
  const { id } = useParams();
  const PAGE_KEY = 'operations.details';
  const { isAdmin, isManager, hasAction } = useAuth();
  const canRefund = hasAction(PAGE_KEY, 'sales.refund');
  const [sale, setSale] = useState(null);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnableItems, setReturnableItems] = useState([]);
  const [returnQty, setReturnQty] = useState({});
  const [returnReason, setReturnReason] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  const canCancel = (typeof isAdmin === 'function' ? isAdmin() : !!isAdmin) || (typeof isManager === 'function' ? isManager() : !!isManager);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await salesAPI.getOne(id);
      setSale(res.data);
      if (res.data?.has_returns) {
        const r = await salesAPI.getReturns(id);
        setReturns(r.data || []);
      } else {
        setReturns([]);
      }
    } catch (e) {
      console.error(e);
      setError('تعذر تحميل تفاصيل العملية');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handleCancel = async () => {
    if (!sale?.id) return;
    const ok = window.confirm('هل أنت متأكد من إلغاء العملية؟');
    if (!ok) return;
    try {
      await salesAPI.cancel(sale.id);
      await fetchDetails();
    } catch (e) {
      console.error(e);
      alert('تعذر إلغاء العملية.');
    }
  };



const openReturnModal = async () => {
  if (!sale?.id) return;
  try {
    const res = await salesAPI.getReturnableItems(sale.id);
    const items = res.data || [];
    setReturnableItems(items);
    // init quantities to 0
    const init = {};
    items.forEach((it) => (init[it.sale_item_id] = 0));
    setReturnQty(init);
    setReturnReason('');
    setShowReturnModal(true);
  } catch (e) {
    console.error(e);
    alert('تعذر تحميل الأصناف القابلة للإرجاع.');
  }
};

const submitReturn = async () => {
  if (!sale?.id) return;
  const items = returnableItems
    .map((it) => ({
      sale_item_id: it.sale_item_id,
      quantity: Number(returnQty[it.sale_item_id] || 0),
      remaining_quantity: Number(it.remaining_quantity || 0),
    }))
    .filter((x) => x.quantity > 0);

  if (!items.length) {
    alert('اختر كمية مرتجعة واحدة على الأقل.');
    return;
  }

  // validate
  for (const it of items) {
    if (it.quantity > it.remaining_quantity) {
      alert('كمية المرتجع لا يمكن أن تتجاوز الكمية المتبقية.');
      return;
    }
    if (it.quantity < 0) {
      alert('كمية غير صحيحة.');
      return;
    }
  }

  setReturnSubmitting(true);
  try {
    await returnsAPI.create({
      sale_id: sale.id,
      reason: returnReason || '',
      status: 'completed',
      items: items.map(({ sale_item_id, quantity }) => ({ sale_item_id, quantity })),
    });
    setShowReturnModal(false);
    await fetchDetails();
  } catch (e) {
    console.error(e);
    alert('تعذر إنشاء المرتجع (قد تكون الصلاحية غير متاحة).');
  } finally {
    setReturnSubmitting(false);
  }
};

  if (loading) {
    return <div className="p-6 text-gray-700">جاري التحميل...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">{error}</div>
        <div className="mt-4">
          <Link to="/operations" className="text-blue-700 hover:text-blue-900 font-semibold">العودة للعمليات</Link>
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="p-6">
        <div className="text-gray-700">لا توجد بيانات.</div>
        <div className="mt-4">
          <Link to="/operations" className="text-blue-700 hover:text-blue-900 font-semibold">العودة للعمليات</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">تفاصيل العملية</h1>
          <div className="text-sm text-gray-600 font-mono">#{String(sale.id).slice(0, 8)}</div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/operations"
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
          >
            رجوع
          </Link>
          {canCancel && sale.status !== 'cancelled' && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              إلغاء العملية
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500">العميل</div>
            <div className="text-gray-800 font-bold">{sale.customer_name || 'زائر'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">التاريخ</div>
            <div className="text-gray-800 font-bold">{new Date(sale.created_at).toLocaleString('ar-SA')}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">طريقة الدفع</div>
            <div className="text-gray-800 font-bold">{sale.payment_method}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">الحالة</div>
            <div>
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                sale.status === 'cancelled'
                  ? 'bg-red-100 text-red-700'
                  : sale.status === 'pending'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-green-100 text-green-800'
              }`}>
                {sale.status === 'cancelled' ? 'ملغاة' : sale.status === 'pending' ? 'قيد الانتظار' : 'مكتملة'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-gray-50 border">
            <div className="text-xs text-gray-500">Subtotal</div>
            <div className="font-bold text-gray-800">{sale.subtotal} ر.س</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 border">
            <div className="text-xs text-gray-500">خصم</div>
            <div className="font-bold text-gray-800">{sale.discount} ر.س</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 border">
            <div className="text-xs text-gray-500">ضريبة</div>
            <div className="font-bold text-gray-800">{sale.tax} ر.س</div>
          </div>
          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="text-xs text-green-700">الإجمالي</div>
            <div className="font-bold text-green-800 text-lg">{sale.total} ر.س</div>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="font-bold text-gray-800 mb-2">الأصناف</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-600 border-b">
                  <th className="text-right py-2">المنتج</th>
                  <th className="text-right py-2">الكمية</th>
                  <th className="text-right py-2">السعر</th>
                  <th className="text-right py-2">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {sale.items?.map((it, idx) => (
                  <tr key={idx} className="border-b last:border-b-0">
                    <td className="py-2 text-gray-800 font-semibold">{it.product_name}</td>
                    <td className="py-2 text-gray-700 font-mono">{it.quantity}</td>
                    <td className="py-2 text-gray-700 font-mono">{it.price}</td>
                    <td className="py-2 text-gray-800 font-bold font-mono">{it.subtotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {returns.length > 0 && (
          <div className="mt-6">
            <h2 className="font-bold text-red-700 mb-2">المرتجعات</h2>
            <div className="space-y-2">
              {returns.map((r, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-red-800">#{String(r.id).slice(0, 8)}</div>
                    <div className="text-sm font-bold text-red-800">{r.total_amount} ر.س</div>
                  </div>
                  <div className="text-xs text-red-700 mt-1">{new Date(r.created_at).toLocaleString('ar-SA')}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    

{showReturnModal && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">إنشاء مرتجع</h3>
        <button onClick={() => setShowReturnModal(false)} className="text-gray-500 hover:text-gray-700">
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="space-y-3 max-h-[55vh] overflow-auto border rounded-xl p-3">
        {returnableItems.map((it) => (
          <div key={it.sale_item_id} className="flex items-center justify-between gap-3 border-b last:border-b-0 py-2">
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{it.product_name}</div>
              <div className="text-xs text-gray-500">
                المتبقي للإرجاع: <span className="font-mono">{it.remaining_quantity}</span>
              </div>
            </div>
            <input
              type="number"
              min="0"
              max={it.remaining_quantity}
              value={returnQty[it.sale_item_id] ?? 0}
              onChange={(e) =>
                setReturnQty((prev) => ({ ...prev, [it.sale_item_id]: e.target.value }))
              }
              className="w-24 border rounded-lg px-2 py-1 text-sm font-mono"
            />
          </div>
        ))}
        {!returnableItems.length && (
          <div className="text-sm text-gray-600">لا توجد أصناف قابلة للإرجاع لهذه العملية.</div>
        )}
      </div>

      <div className="mt-4">
        <label className="block text-sm font-semibold mb-1">السبب (اختياري)</label>
        <input
          value={returnReason}
          onChange={(e) => setReturnReason(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          placeholder="مثال: عميل رجّع الصنف"
        />
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <button onClick={() => setShowReturnModal(false)} className="btn-secondary">
          إغلاق
        </button>
        <button onClick={submitReturn} className="btn-primary" disabled={returnSubmitting}>
          {returnSubmitting ? 'جاري الحفظ...' : 'تأكيد المرتجع'}
        </button>
      </div>
    </div>
  </div>
)}
</div>
  );
};

export default OperationDetails;
