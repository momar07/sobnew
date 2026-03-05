import { useState, useEffect } from 'react';
import { salesAPI, returnsAPI, cashRegisterAPI } from '../services/api';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('sales'); // 'sales' or 'returns'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Returns data
  const [returnsStats, setReturnsStats] = useState(null);
  const [returnsData, setReturnsData] = useState(null);
  const [returnsLoading, setReturnsLoading] = useState(false);

  
  // Shift reports
  const [shifts, setShifts] = useState([]);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftFrom, setShiftFrom] = useState('');
  const [shiftTo, setShiftTo] = useState('');
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftDetails, setShiftDetails] = useState(null);

// Load returns stats on mount
  useEffect(() => {
    if (activeTab === 'returns') {
      fetchReturnsStats();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'shifts' && shifts.length === 0) {
      fetchShifts();
    }
  }, [activeTab]);


  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      alert('يرجى تحديد تاريخ البداية والنهاية');
      return;
    }

    try {
      setLoading(true);
      const response = await salesAPI.getByDateRange(startDate, endDate);
      setReportData(response.data);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('حدث خطأ أثناء إنشاء التقرير');
    } finally {
      setLoading(false);
    }
  };

  const fetchReturnsStats = async () => {
    try {
      const response = await returnsAPI.getStats();
      setReturnsStats(response.data);
    } catch (error) {
      console.error('Error fetching returns stats:', error);
    }
  };

  const handleGenerateReturnsReport = async () => {
    if (!startDate || !endDate) {
      alert('يرجى تحديد تاريخ البداية والنهاية');
      return;
    }

    try {
      setReturnsLoading(true);
      const response = await returnsAPI.getAll({
        start_date: startDate,
        end_date: endDate,
        status: 'completed'
      });
      setReturnsData(response.data.results || response.data);
    } catch (error) {
      console.error('Error generating returns report:', error);
      alert('حدث خطأ أثناء إنشاء تقرير المرتجعات');
    } finally {
      setReturnsLoading(false);
    }
  };


  const formatDateTime = (iso) => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString('ar-EG');
    } catch {
      return iso;
    }
  };

  const fetchShifts = async () => {
    try {
      setShiftLoading(true);
      const res = await cashRegisterAPI.getAll({});
      const data = res.data?.results || res.data || [];
      setShifts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error fetching shifts:', e);
      alert('تعذر تحميل الشيفتات');
    } finally {
      setShiftLoading(false);
    }
  };

  const openShiftReport = async (shiftId) => {
    try {
      setShiftLoading(true);
      const res = await cashRegisterAPI.getOne(shiftId);
      setShiftDetails(res.data);
      setShowShiftModal(true);
    } catch (e) {
      console.error('Error fetching shift report:', e);
      alert('تعذر تحميل تقرير الشيفت');
    } finally {
      setShiftLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        <i className="fas fa-file-alt ml-2"></i>
        التقارير
      </h1>

      {/* Tabs */}
      <div className="card mb-6">
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'sales'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            <i className="fas fa-shopping-cart ml-2"></i>
            تقرير المبيعات
          </button>
          <button
            onClick={() => setActiveTab('returns')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'returns'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-gray-600 hover:text-red-600'
            }`}
          >
            <i className="fas fa-undo ml-2"></i>
            تقرير المرتجعات
          </button>
          <button
            onClick={() => setActiveTab('shifts')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'shifts'
                ? 'text-gray-800 border-b-2 border-gray-800'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <i className="fas fa-cash-register ml-2"></i>
            تقارير الشيفتات
          </button>
        </div>
      </div>

      {/* Sales Report */}
      {activeTab === 'sales' && (
        <>
          {/* Report Filters */}
          <div className="card mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">تقرير المبيعات حسب الفترة</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              من تاريخ
            </label>
            <input
              type="date"
              className="input-field"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              إلى تاريخ
            </label>
            <input
              type="date"
              className="input-field"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleGenerateReport}
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin ml-2"></i>
                  جاري الإنشاء...
                </>
              ) : (
                <>
                  <i className="fas fa-chart-bar ml-2"></i>
                  إنشاء التقرير
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Report Results */}
      {reportData && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <p className="text-blue-100 mb-1">إجمالي المبيعات</p>
              <h2 className="text-3xl font-bold">
                {reportData.stats?.total_sales || 0} ر.س
              </h2>
            </div>

            <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
              <p className="text-green-100 mb-1">عدد العمليات</p>
              <h2 className="text-3xl font-bold">
                {reportData.stats?.total_count || 0}
              </h2>
            </div>

            <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <p className="text-purple-100 mb-1">متوسط البيع</p>
              <h2 className="text-3xl font-bold">
                {reportData.stats?.avg_sale?.toFixed(2) || 0} ر.س
              </h2>
            </div>
          </div>

          {/* Sales Table */}
          <div className="card">
            <h3 className="text-xl font-bold mb-4 text-gray-800">
              تفاصيل المبيعات
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">رقم العملية</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">العميل</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المبلغ</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">طريقة الدفع</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.sales && reportData.sales.length > 0 ? (
                    reportData.sales.map((sale) => (
                      <tr key={sale.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono">
                          #{sale.id.substring(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {sale.customer_name || 'غير محدد'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-blue-600">
                          {sale.total} ر.س
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {sale.payment_method === 'cash' ? 'نقدي' :
                           sale.payment_method === 'card' ? 'بطاقة' : 'نقدي + بطاقة'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(sale.created_at).toLocaleString('ar-SA')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-4 py-10 text-center text-gray-500">
                        لا توجد مبيعات في هذه الفترة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

          {!reportData && !loading && (
            <div className="card text-center py-20">
              <i className="fas fa-chart-pie text-6xl text-gray-400 mb-4"></i>
              <p className="text-gray-600">اختر الفترة الزمنية وقم بإنشاء التقرير</p>
            </div>
          )}
        </>
      )}

      {/* Returns Report */}
      {activeTab === 'returns' && (
        <>
          {/* Returns Stats Cards */}
          {returnsStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
                <p className="text-red-100 mb-1">مرتجعات اليوم</p>
                <h2 className="text-3xl font-bold">
                  {returnsStats.today?.amount || 0} ر.س
                </h2>
                <p className="text-red-100 text-sm mt-2">
                  {returnsStats.today?.count || 0} عملية
                </p>
              </div>

              <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                <p className="text-orange-100 mb-1">مرتجعات الأسبوع</p>
                <h2 className="text-3xl font-bold">
                  {returnsStats.week?.amount || 0} ر.س
                </h2>
                <p className="text-orange-100 text-sm mt-2">
                  {returnsStats.week?.count || 0} عملية
                </p>
              </div>

              <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <p className="text-purple-100 mb-1">مرتجعات الشهر</p>
                <h2 className="text-3xl font-bold">
                  {returnsStats.month?.amount || 0} ر.س
                </h2>
                <p className="text-purple-100 text-sm mt-2">
                  {returnsStats.month?.count || 0} عملية
                </p>
              </div>
            </div>
          )}

          {/* Returns Report Filters */}
          <div className="card mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">تقرير المرتجعات حسب الفترة</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  من تاريخ
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  إلى تاريخ
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleGenerateReturnsReport}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg w-full"
                  disabled={returnsLoading}
                >
                  {returnsLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin ml-2"></i>
                      جاري الإنشاء...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-undo ml-2"></i>
                      إنشاء التقرير
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Returns Table */}
          {returnsData && (
            <div className="card">
              <h3 className="text-xl font-bold mb-4 text-gray-800">
                تفاصيل المرتجعات
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">رقم المرتجع</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">رقم الفاتورة</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">العميل</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الموظف</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المبلغ المسترد</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">عدد الأصناف</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnsData.length > 0 ? (
                      returnsData.map((returnItem) => (
                        <tr key={returnItem.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono">
                            #{returnItem.id.substring(0, 8)}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono">
                            #{returnItem.sale_number || returnItem.sale}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {returnItem.customer_name || 'زائر'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {returnItem.user_name || 'غير محدد'}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-red-600">
                            {returnItem.total_amount} ر.س
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {returnItem.items_count}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {new Date(returnItem.created_at).toLocaleString('ar-SA')}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="px-4 py-10 text-center text-gray-500">
                          لا توجد مرتجعات في هذه الفترة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              {returnsData.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <div className="text-gray-600">
                      <span className="font-semibold">إجمالي عدد المرتجعات:</span>
                      <span className="mr-2 text-lg font-bold text-gray-800">{returnsData.length}</span>
                    </div>
                    <div className="text-gray-600">
                      <span className="font-semibold">إجمالي المبالغ المستردة:</span>
                      <span className="mr-2 text-lg font-bold text-red-600">
                        {returnsData.reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0).toFixed(2)} ر.س
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!returnsData && !returnsLoading && (
            <div className="card text-center py-20">
              <i className="fas fa-undo text-6xl text-gray-400 mb-4"></i>
              <p className="text-gray-600">اختر الفترة الزمنية وقم بإنشاء تقرير المرتجعات</p>
            </div>
          )}
        </>
      )}
    
      {/* Shift Reports */}
      {activeTab === 'shifts' && (
        <>
          <div className="card mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                <i className="fas fa-cash-register ml-2"></i>
                تقارير الشيفتات
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={shiftFrom}
                  onChange={(e) => setShiftFrom(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm"
                  title="من تاريخ"
                />
                <input
                  type="date"
                  value={shiftTo}
                  onChange={(e) => setShiftTo(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm"
                  title="إلى تاريخ"
                />
                <button
                  onClick={fetchShifts}
                  className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg text-sm"
                  disabled={shiftLoading}
                >
                  <i className="fas fa-sync ml-2"></i>
                  تحديث
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-right p-3">الكاشير</th>
                    <th className="text-right p-3">فتح</th>
                    <th className="text-right p-3">إغلاق</th>
                    <th className="text-right p-3">إجمالي المبيعات</th>
                    <th className="text-right p-3">المرتجعات</th>
                    <th className="text-right p-3">فرق النقدية</th>
                    <th className="text-right p-3">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const toDateOnly = (iso) => {
                      if (!iso) return null;
                      try {
                        return new Date(iso).toISOString().slice(0, 10);
                      } catch {
                        return null;
                      }
                    };

                    const filtered = (shifts || [])
                      .filter(s => s.status === 'closed')
                      .filter(s => {
                        const d = toDateOnly(s.opened_at);
                        if (!d) return true;
                        if (shiftFrom && d < shiftFrom) return false;
                        if (shiftTo && d > shiftTo) return false;
                        return true;
                      });

                    if (shiftLoading) {
                      return (
                        <tr>
                          <td className="p-4 text-center text-gray-500" colSpan={7}>جاري التحميل...</td>
                        </tr>
                      );
                    }

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td className="p-4 text-center text-gray-500" colSpan={7}>لا توجد شيفتات مغلقة ضمن الفلتر</td>
                        </tr>
                      );
                    }

                    return filtered.slice(0, 50).map((s) => (
                      <tr key={s.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">{s.user_name || '-'}</td>
                        <td className="p-3">{formatDateTime(s.opened_at)}</td>
                        <td className="p-3">{formatDateTime(s.closed_at)}</td>
                        <td className="p-3 font-semibold">{Number(s.total_sales || 0).toFixed(2)}</td>
                        <td className="p-3">{Number(s.total_returns || 0).toFixed(2)}</td>
                        <td className="p-3">{Number(s.cash_difference || 0).toFixed(2)}</td>
                        <td className="p-3">
                          <button
                            onClick={() => openShiftReport(s.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-xs"
                          >
                            عرض التقرير
                          </button>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              * يعرض آخر 50 شيفت مغلق (حسب صلاحيات المستخدم). يمكنك تحديد تاريخ من/إلى للتصفية.
            </p>
          </div>

          {/* Shift Report Modal */}
          {showShiftModal && shiftDetails && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-800">
                    تقرير الشيفت
                  </h3>
                  <button
                    onClick={() => { setShowShiftModal(false); setShiftDetails(null); }}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <div className="text-sm text-gray-500">الكاشير</div>
                      <div className="font-semibold">{shiftDetails.user_name || '-'}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <div className="text-sm text-gray-500">الحالة</div>
                      <div className="font-semibold">{shiftDetails.status === 'closed' ? 'مغلق' : 'مفتوح'}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <div className="text-sm text-gray-500">وقت الفتح</div>
                      <div className="font-semibold">{formatDateTime(shiftDetails.opened_at)}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <div className="text-sm text-gray-500">وقت الإغلاق</div>
                      <div className="font-semibold">{formatDateTime(shiftDetails.closed_at)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <div className="text-sm text-blue-700">إجمالي المبيعات</div>
                      <div className="text-2xl font-bold text-blue-800">{Number(shiftDetails.total_sales || 0).toFixed(2)}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                      <div className="text-sm text-red-700">إجمالي المرتجعات</div>
                      <div className="text-2xl font-bold text-red-800">{Number(shiftDetails.total_returns || 0).toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <div className="text-sm text-gray-600">فرق النقدية</div>
                      <div className="text-2xl font-bold text-gray-800">{Number(shiftDetails.cash_difference || 0).toFixed(2)}</div>
                    </div>
                  </div>

                  {Array.isArray(shiftDetails.transactions) && shiftDetails.transactions.length > 0 && (
                    <div className="card">
                      <h4 className="text-lg font-bold mb-3 text-gray-800">حركات الخزنة</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b">
                              <th className="p-3 text-right">النوع</th>
                              <th className="p-3 text-right">المبلغ</th>
                              <th className="p-3 text-right">السبب</th>
                              <th className="p-3 text-right">الوقت</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shiftDetails.transactions.map((tx) => (
                              <tr key={tx.id} className="border-b hover:bg-gray-50">
                                <td className="p-3">{tx.type === 'deposit' ? 'إيداع' : 'سحب'}</td>
                                <td className="p-3 font-semibold">{Number(tx.amount || 0).toFixed(2)}</td>
                                <td className="p-3">{tx.reason || '-'}</td>
                                <td className="p-3">{formatDateTime(tx.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
</div>
  );
};

export default Reports;
