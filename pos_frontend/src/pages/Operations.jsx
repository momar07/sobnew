import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { salesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Operations = () => {
  const { isAdmin, isManager } = useAuth();
  const [activeTab, setActiveTab] = useState('latest'); // latest | search

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [searchText, setSearchText] = useState('');
  const [status, setStatus] = useState('');

  const canCancel = isAdmin || isManager; // safest default

  const fetchSales = async (params = {}) => {
    try {
      setLoading(true);
      setError('');
      const res = await salesAPI.getAll({ limit: 25, ordering: '-created_at', ...params });
      const list = res.data?.results || res.data || [];
      setSales(list);
    } catch (e) {
      console.error(e);
      setError('تعذر تحميل العمليات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    const params = {};
    if (searchText.trim()) params.search = searchText.trim();
    if (status) params.status = status;
    await fetchSales(params);
  };

  const handleCancel = async (sale) => {
    if (!sale?.id) return;
    const ok = window.confirm('هل أنت متأكد من إلغاء العملية؟ سيتم إرجاع المخزون وحساب نقاط العميل.');
    if (!ok) return;
    try {
      await salesAPI.cancel(sale.id);
      // refresh current view
      await handleSearch();
    } catch (e) {
      console.error(e);
      alert('تعذر إلغاء العملية. تأكد من الصلاحيات أو حالة العملية.');
    }
  };

  const tabs = useMemo(() => (
    [
      { key: 'latest', label: 'أحدث العمليات' },
      { key: 'search', label: 'بحث / إلغاء' },
    ]
  ), []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">العمليات</h1>
        <button
          type="button"
          onClick={() => fetchSales()}
          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
          title="تحديث"
        >
          <i className="fas fa-sync-alt ml-2"></i>
          تحديث
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 p-3 border-b border-gray-200">
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search Bar (only in search tab) */}
        {activeTab === 'search' && (
          <form onSubmit={handleSearch} className="p-4 border-b border-gray-200 flex flex-col lg:flex-row gap-3">
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="ابحث برقم العملية (UUID/جزء منه) أو اسم العميل"
              className="flex-1 input-field"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-field lg:w-56"
            >
              <option value="">كل الحالات</option>
              <option value="completed">مكتملة</option>
              <option value="cancelled">ملغاة</option>
              <option value="pending">قيد الانتظار</option>
            </select>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              بحث
            </button>
          </form>
        )}

        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center text-gray-600 py-10">جاري التحميل...</div>
          ) : sales.length === 0 ? (
            <div className="text-center text-gray-600 py-10">لا توجد عمليات</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-600 border-b">
                    <th className="text-right py-3">رقم</th>
                    <th className="text-right py-3">العميل</th>
                    <th className="text-right py-3">التاريخ</th>
                    <th className="text-right py-3">الإجمالي</th>
                    <th className="text-right py-3">الحالة</th>
                    <th className="text-right py-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id} className="border-b last:border-b-0">
                      <td className="py-3 font-mono text-gray-800">#{String(s.id).slice(0, 8)}</td>
                      <td className="py-3 text-gray-800">{s.customer_name || 'زائر'}</td>
                      <td className="py-3 text-gray-600">
                        {new Date(s.created_at).toLocaleString('ar-SA')}
                      </td>
                      <td className="py-3 font-semibold text-green-700">{s.total} ر.س</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          s.status === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : s.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {s.status === 'cancelled' ? 'ملغاة' : s.status === 'pending' ? 'قيد الانتظار' : 'مكتملة'}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/operations/${s.id}`}
                            className="text-blue-700 hover:text-blue-900 font-semibold"
                          >
                            تفاصيل
                          </Link>
                          {activeTab === 'search' && canCancel && s.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleCancel(s)}
                              className="text-red-700 hover:text-red-900 font-semibold"
                            >
                              إلغاء
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {!canCancel && (
        <div className="mt-4 text-xs text-gray-500">
          ملاحظة: إلغاء العمليات متاح للمدير/الأدمن فقط.
        </div>
      )}
    </div>
  );
};

export default Operations;
