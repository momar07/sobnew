import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function UserPerformance() {
  const { user, isAdmin, isManager } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (isAdmin() || isManager()) {
      fetchUsers();
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/');
      const usersData = response.data.results || response.data;
      setUsers(Array.isArray(usersData) ? usersData : []);
      if (usersData && usersData.length > 0) {
        setSelectedUser(usersData[0].id);
      }
    } catch (error) {
      console.error('خطأ في جلب المستخدمين:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUser) {
      fetchPerformance();
    }
  }, [selectedUser, dateRange]);

  const fetchPerformance = async () => {
    try {
      const response = await api.get(`/users/${selectedUser}/performance/`, {
        params: {
          start_date: dateRange.start,
          end_date: dateRange.end
        }
      });
      setPerformance(response.data);
    } catch (error) {
      console.error('خطأ في جلب بيانات الأداء:', error);
    }
  };

  // التحقق من الصلاحيات
  if (!isAdmin() && !isManager()) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
          <h2 className="text-xl font-bold text-red-700 mb-2">غير مصرح</h2>
          <p className="text-red-600">ليس لديك صلاحية الوصول إلى هذه الصفحة</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <i className="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
      </div>
    );
  }

  const selectedUserData = users.find(u => u.id === selectedUser);

  // إعداد بيانات الرسم البياني
  const chartData = performance ? {
    labels: ['المبيعات', 'الإيرادات', 'متوسط الفاتورة', 'العملاء'],
    datasets: [
      {
        label: 'الأداء',
        data: [
          performance.total_sales,
          performance.total_revenue,
          performance.average_sale,
          performance.total_customers
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(139, 92, 246, 0.8)',
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(16, 185, 129)',
          'rgb(245, 158, 11)',
          'rgb(139, 92, 246)',
        ],
        borderWidth: 2
      }
    ]
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'إحصائيات الأداء',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">أداء المستخدمين</h1>
        <p className="text-gray-600 mt-1">تتبع وتحليل أداء الموظفين</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
              اختر المستخدم
            </label>
            <select
              value={selectedUser || ''}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-right"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.profile?.full_name || u.username} - {u.groups?.[0] === 'admin' ? 'مدير النظام' : u.groups?.[0] === 'manager' ? 'مدير' : 'كاشير'}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
              من تاريخ
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-right"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
              إلى تاريخ
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-right"
            />
          </div>
        </div>
      </div>

      {/* User Info Card */}
      {selectedUserData && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-3xl font-bold mr-4">
                {selectedUserData.first_name?.[0] || selectedUserData.username[0].toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{selectedUserData.profile?.full_name || selectedUserData.username}</h2>
                <p className="text-blue-100">@{selectedUserData.username}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm">
                    {selectedUserData.groups?.[0] === 'admin' ? 'مدير النظام' : selectedUserData.groups?.[0] === 'manager' ? 'مدير' : 'كاشير'}
                  </span>
                  {selectedUserData.profile?.employee_number && (
                    <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm">
                      #{selectedUserData.profile.employee_number}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-blue-100 text-sm">إجمالي العمليات</p>
              <p className="text-4xl font-bold">{selectedUserData.profile?.total_sales || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Performance Stats */}
      {performance && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Sales */}
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-shopping-cart text-blue-600 text-xl"></i>
                </div>
                <span className="text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded">عمليات البيع</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{performance.total_sales}</p>
              <p className="text-sm text-gray-600 mt-1">عملية بيع</p>
            </div>

            {/* Total Revenue */}
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-dollar-sign text-green-600 text-xl"></i>
                </div>
                <span className="text-xs text-gray-500 bg-green-50 px-2 py-1 rounded">إجمالي الإيرادات</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{performance.total_revenue?.toFixed(2)}</p>
              <p className="text-sm text-gray-600 mt-1">جنيه مصري</p>
            </div>

            {/* Average Sale */}
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-chart-line text-yellow-600 text-xl"></i>
                </div>
                <span className="text-xs text-gray-500 bg-yellow-50 px-2 py-1 rounded">متوسط الفاتورة</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{performance.average_sale?.toFixed(2)}</p>
              <p className="text-sm text-gray-600 mt-1">جنيه مصري</p>
            </div>

            {/* Total Customers */}
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-users text-purple-600 text-xl"></i>
                </div>
                <span className="text-xs text-gray-500 bg-purple-50 px-2 py-1 rounded">العملاء</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{performance.total_customers}</p>
              <p className="text-sm text-gray-600 mt-1">عميل مميز</p>
            </div>
          </div>

          {/* Performance Chart */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6 text-right">الرسم البياني للأداء</h3>
            <div style={{ height: '400px' }}>
              {chartData && <Bar data={chartData} options={chartOptions} />}
            </div>
          </div>

          {/* Additional Insights */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Best Day */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <i className="fas fa-calendar-star text-blue-600 text-2xl"></i>
                <h4 className="font-bold text-gray-900">أفضل يوم</h4>
              </div>
              <p className="text-2xl font-bold text-blue-600">{performance.best_day || 'لا توجد بيانات'}</p>
            </div>

            {/* Avg Items Per Sale */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
              <div className="flex items-center gap-3 mb-3">
                <i className="fas fa-box-open text-green-600 text-2xl"></i>
                <h4 className="font-bold text-gray-900">متوسط المنتجات</h4>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {performance.average_items_per_sale?.toFixed(1) || '0'} منتج/فاتورة
              </p>
            </div>

            {/* Performance Rating */}
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200">
              <div className="flex items-center gap-3 mb-3">
                <i className="fas fa-star text-yellow-600 text-2xl"></i>
                <h4 className="font-bold text-gray-900">تقييم الأداء</h4>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <i
                    key={star}
                    className={`fas fa-star ${
                      star <= (performance.performance_rating || 0)
                        ? 'text-yellow-500'
                        : 'text-gray-300'
                    }`}
                  ></i>
                ))}
                <span className="mr-2 font-bold text-gray-700">
                  {performance.performance_rating || 0}/5
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {!performance && (
        <div className="bg-gray-50 rounded-xl p-12 text-center">
          <i className="fas fa-chart-bar text-6xl text-gray-300 mb-4"></i>
          <p className="text-gray-500 text-lg">لا توجد بيانات أداء للفترة المحددة</p>
        </div>
      )}
    </div>
  );
}

export default UserPerformance;
