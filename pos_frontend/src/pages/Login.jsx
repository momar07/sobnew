import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Login() {
  const navigate = useNavigate();
  const { login, user, loading: authLoading, isCashier } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // إعادة توجيه المستخدم المسجل حسب صلاحيته
  useEffect(() => {
    if (user && !authLoading) {
      // إذا كان الكاشير، وجهه إلى الخزنة
      if (isCashier && isCashier()) {
        navigate('/cash-register');
      } else {
        // الـ Admin والـ Manager يذهبون إلى الصفحة الرئيسية (POS)
        navigate('/');
      }
    }
  }, [user, authLoading, navigate]);

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-6xl text-blue-600 mb-4"></i>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(formData.username, formData.password);
      
      if (result.success) {
        // تم تسجيل الدخول بنجاح
        navigate('/');
      } else {
        setError(result.error || 'فشل تسجيل الدخول');
      }
    } catch (err) {
      setError('خطأ في الاتصال بالسيرفر');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // حسابات تجريبية للاختبار
  const demoAccounts = [
    { username: 'admin', password: 'admin123', role: 'مدير النظام' },
    { username: 'manager', password: 'manager123', role: 'مدير' },
    { username: 'cashier1', password: 'cashier123', role: 'كاشير' }
  ];

  const fillDemo = (username, password) => {
    setFormData({ username, password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl mb-4 shadow-lg">
            <i className="fas fa-cash-register text-white text-2xl"></i>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">نظام نقاط البيع</h1>
          <p className="text-gray-600">تسجيل الدخول إلى لوحة التحكم</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                اسم المستخدم
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                  placeholder="أدخل اسم المستخدم"
                  autoComplete="username"
                />
                <i className="fas fa-user absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                  placeholder="أدخل كلمة المرور"
                  autoComplete="current-password"
                />
                <i className="fas fa-lock absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-right">
                <i className="fas fa-exclamation-circle ml-2"></i>
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <i className="fas fa-spinner fa-spin ml-2"></i>
                  جاري تسجيل الدخول...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <i className="fas fa-sign-in-alt ml-2"></i>
                  تسجيل الدخول
                </span>
              )}
            </button>
          </form>

          {/* Demo Accounts */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-4 text-center">حسابات تجريبية للاختبار:</p>
            <div className="space-y-2">
              {demoAccounts.map((account, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => fillDemo(account.username, account.password)}
                  className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="text-xs text-gray-500">{account.password}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium text-gray-700 ml-2">{account.username}</span>
                    <span className="text-xs text-gray-500">({account.role})</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            نظام إدارة نقاط البيع الشامل v2.0
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
