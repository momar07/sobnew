import { useState, useEffect } from 'react';
import { salesAPI } from '../services/api';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // جلب البيانات عند التحميل الأول
  useEffect(() => {
    fetchStats();
  }, []);

  // تحديث تلقائي كل 30 ثانية
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchStats(true); // تحديث صامت (بدون loading)
    }, 30000); // 30 ثانية

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchStats = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await salesAPI.getStats();
      setStats(response.data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // دالة التحديث اليدوي
  const handleRefresh = () => {
    fetchStats();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <i className="fas fa-spinner fa-spin text-6xl text-blue-600"></i>
      </div>
    );
  }

  const topProductsChart = {
    labels: stats?.top_products?.map(p => p.product__name) || [],
    datasets: [{
      label: 'المبيعات',
      data: stats?.top_products?.map(p => p.total_sales) || [],
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(251, 146, 60, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(168, 85, 247, 0.8)',
      ],
    }],
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          <i className="fas fa-chart-line ml-2"></i>
          لوحة التحكم
        </h1>
        
        <div className="flex items-center gap-3">
          {/* آخر تحديث */}
          <div className="text-sm text-gray-600">
            <i className="fas fa-clock ml-1"></i>
            آخر تحديث: {lastUpdate.toLocaleTimeString('ar-SA')}
          </div>

          {/* زر التحديث اليدوي */}
          <button
            onClick={handleRefresh}
            className="btn-primary"
            disabled={loading}
          >
            <i className={`fas fa-sync-alt ml-2 ${loading ? 'fa-spin' : ''}`}></i>
            تحديث
          </button>

          {/* تبديل التحديث التلقائي */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              autoRefresh 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            }`}
            title={autoRefresh ? 'إيقاف التحديث التلقائي' : 'تفعيل التحديث التلقائي'}
          >
            <i className={`fas ${autoRefresh ? 'fa-pause' : 'fa-play'} ml-2`}></i>
            {autoRefresh ? 'تلقائي' : 'يدوي'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Today Sales */}
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 mb-1">مبيعات اليوم</p>
              <h2 className="text-3xl font-bold">{stats?.today_sales || 0} ر.س</h2>
              <p className="text-blue-100 mt-2">
                <i className="fas fa-shopping-bag ml-1"></i>
                {stats?.today_count || 0} عملية بيع
              </p>
            </div>
            <div className="text-5xl opacity-20">
              <i className="fas fa-calendar-day"></i>
            </div>
          </div>
        </div>

        {/* Week Sales */}
        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 mb-1">مبيعات الأسبوع</p>
              <h2 className="text-3xl font-bold">{stats?.week_sales || 0} ر.س</h2>
            </div>
            <div className="text-5xl opacity-20">
              <i className="fas fa-calendar-week"></i>
            </div>
          </div>
        </div>

        {/* Month Sales */}
        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 mb-1">مبيعات الشهر</p>
              <h2 className="text-3xl font-bold">{stats?.month_sales || 0} ر.س</h2>
            </div>
            <div className="text-5xl opacity-20">
              <i className="fas fa-calendar-alt"></i>
            </div>
          </div>
        </div>

        {/* Total Profit */}
        <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 mb-1">إجمالي الأرباح</p>
              <h2 className="text-3xl font-bold">{stats?.total_profit || 0} ر.س</h2>
            </div>
            <div className="text-5xl opacity-20">
              <i className="fas fa-chart-line"></i>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Products Chart */}
        <div className="card">
          <h3 className="text-xl font-bold mb-4 text-gray-800">
            <i className="fas fa-trophy ml-2 text-yellow-500"></i>
            أكثر المنتجات مبيعاً
          </h3>
          {stats?.top_products && stats.top_products.length > 0 ? (
            <Bar
              data={topProductsChart}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                  },
                },
              }}
            />
          ) : (
            <p className="text-gray-500 text-center py-10">لا توجد بيانات</p>
          )}
        </div>

        {/* Top Products List */}
        <div className="card">
          <h3 className="text-xl font-bold mb-4 text-gray-800">
            <i className="fas fa-list-ol ml-2"></i>
            تفاصيل المنتجات الأكثر مبيعاً
          </h3>
          <div className="space-y-3">
            {stats?.top_products && stats.top_products.length > 0 ? (
              stats.top_products.map((product, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{product.product__name}</p>
                      <p className="text-sm text-gray-600">
                        الكمية: {product.total_quantity}
                      </p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-blue-600">{product.total_sales} ر.س</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-10">لا توجد بيانات</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="card">
        <h3 className="text-xl font-bold mb-4 text-gray-800">
          <i className="fas fa-clock ml-2"></i>
          آخر العمليات
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">رقم العملية</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">العميل</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">البائع</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المبلغ</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">طريقة الدفع</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الحالة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recent_sales && stats.recent_sales.length > 0 ? (
                stats.recent_sales.map((sale) => (
                  <tr key={sale.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono">
                      #{sale.id.substring(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {sale.customer_name || 'زائر'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center">
                        <i className="fas fa-user-circle text-blue-500 ml-1"></i>
                        {sale.user_name || 'غير محدد'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-blue-600">
                      {sale.total} ر.س
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {sale.payment_method === 'cash' ? 'نقدي' :
                       sale.payment_method === 'card' ? 'بطاقة' : 'نقدي + بطاقة'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          sale.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {sale.status === 'completed' ? 'مكتملة' : 'ملغاة'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(sale.created_at).toLocaleDateString('ar-SA')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-4 py-10 text-center text-gray-500">
                    لا توجد عمليات بيع
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
