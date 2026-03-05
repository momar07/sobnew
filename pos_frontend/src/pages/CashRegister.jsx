import { useState, useEffect } from 'react';
import { cashRegisterAPI, cashTransactionAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const CashRegister = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [currentShift, setCurrentShift] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Open Shift Modal
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingNote, setOpeningNote] = useState('');
  
  // Close Shift Modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actualCash, setActualCash] = useState('');
  const [closingNote, setClosingNote] = useState('');
  
  // Summary Modal (بعد الإغلاق)
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [closedShiftData, setClosedShiftData] = useState(null);
  
  // Transactions
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState('deposit');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionReason, setTransactionReason] = useState('');
  const [transactionNote, setTransactionNote] = useState('');


  useEffect(() => {
    fetchData();
    
    // تحديث تلقائي كل 10 ثوانٍ (silent - بدون loading spinner)
    const interval = setInterval(() => {
      fetchData(true);
    }, 10000);
    
    // تحديث عند العودة للصفحة (Visibility Change)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // ✅ Empty dependency - يعمل مرة واحدة فقط عند mount

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [currentResponse, statsResponse] = await Promise.all([
        cashRegisterAPI.getCurrent().catch(() => ({ data: null })),
        cashRegisterAPI.getStats()
      ]);
      
      setCurrentShift(currentResponse.data);
      setStats(statsResponse.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (!silent) setLoading(false);
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


  const handleOpenShift = async (e) => {
    e.preventDefault();
    
    if (!openingBalance || parseFloat(openingBalance) < 0) {
      alert('يرجى إدخال رصيد افتتاحي صحيح');
      return;
    }

    try {
      setActionLoading(true);
      await cashRegisterAPI.openShift({
        opening_balance: parseFloat(openingBalance),
        opening_note: openingNote
      });
      
      alert('✅ تم فتح الشيفت بنجاح!\n\nسيظهر لك الآن تاب الـ POS في القائمة الجانبية ويمكنك البدء في البيع.');
      setShowOpenModal(false);
      setOpeningBalance('');
      setOpeningNote('');
      fetchData();
    } catch (error) {
      console.error('Error opening shift:', error);
      alert(error.response?.data?.error || 'حدث خطأ أثناء فتح الشيفت');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    
    if (!actualCash || parseFloat(actualCash) < 0) {
      alert('يرجى إدخال المبلغ الفعلي في الخزنة');
      return;
    }

    if (!window.confirm('هل أنت متأكد من إغلاق الشيفت؟')) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await cashRegisterAPI.closeShift(currentShift.id, {
        actual_cash: parseFloat(actualCash),
        closing_note: closingNote
      });
      
      // حفظ بيانات الشيفت المُغلق
      setClosedShiftData(response.data);
      
      // إغلاق modal الإغلاق وفتح modal الملخص
      setShowCloseModal(false);
      setShowSummaryModal(true);
      setActionLoading(false);
    } catch (error) {
      console.error('Error closing shift:', error);
      alert(error.response?.data?.error || 'حدث خطأ أثناء إغلاق الشيفت');
      setActionLoading(false);
    }
  };
  
  const handleLogoutAfterSummary = () => {
    logout();
    navigate('/login');
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    
    if (!transactionAmount || parseFloat(transactionAmount) <= 0) {
      alert('يرجى إدخال مبلغ صحيح');
      return;
    }
    
    if (!transactionReason.trim()) {
      alert('يرجى إدخال سبب المعاملة');
      return;
    }

    try {
      setActionLoading(true);
      await cashTransactionAPI.create({
        cash_register: currentShift.id,
        transaction_type: transactionType,
        amount: parseFloat(transactionAmount),
        reason: transactionReason,
        note: transactionNote
      });
      
      alert('تم إضافة المعاملة بنجاح');
      setShowTransactionModal(false);
      setTransactionAmount('');
      setTransactionReason('');
      setTransactionNote('');
      fetchData();
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('حدث خطأ أثناء إضافة المعاملة');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          <i className="fas fa-cash-register ml-2"></i>
          إدارة الخزنة
        </h1>
        
        {!currentShift && (
          <button
            onClick={() => setShowOpenModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold"
          >
            <i className="fas fa-folder-open ml-2"></i>
            فتح شيفت جديد
          </button>
        )}
        
        {currentShift && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowTransactionModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              <i className="fas fa-plus ml-2"></i>
              معاملة
            </button>
            <button
              onClick={() => setShowCloseModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold"
            >
              <i className="fas fa-door-closed ml-2"></i>
              إغلاق الشيفت
            </button>
          </div>
        )}
      </div>

      {/* Current Shift Status */}
      {currentShift ? (
        <>
          {/* Shift Info Card */}
          <div className="card mb-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">شيفت مفتوح حالياً</h2>
                <p className="text-green-100">
                  <i className="fas fa-user ml-2"></i>
                  {currentShift.user_name}
                </p>
              </div>
              <div className="bg-white bg-opacity-20 px-4 py-2 rounded-lg">
                <p className="text-sm text-green-100">المدة</p>
                <p className="text-2xl font-bold">{currentShift.duration} ساعة</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-green-100 text-sm">وقت الفتح</p>
                <p className="font-semibold">
                  {new Date(currentShift.opened_at).toLocaleString('ar-SA', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              
              <div>
                <p className="text-green-100 text-sm">الرصيد الافتتاحي</p>
                <p className="text-xl font-bold">{currentShift.opening_balance} ر.س</p>
              </div>
              
              <div>
                <p className="text-green-100 text-sm">عدد المبيعات</p>
                <p className="text-xl font-bold">{currentShift.sales_count}</p>
              </div>
              
              <div>
                <p className="text-green-100 text-sm">عدد المرتجعات</p>
                <p className="text-xl font-bold">{currentShift.returns_count}</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <p className="text-blue-100 mb-1">إجمالي المبيعات</p>
              <h2 className="text-3xl font-bold">{currentShift.total_sales} ر.س</h2>
              <p className="text-blue-100 text-sm mt-2">
                نقدي: {currentShift.total_cash_sales} ر.س
              </p>
              <p className="text-blue-100 text-sm">
                بطاقة: {currentShift.total_card_sales} ر.س
              </p>
            </div>

            <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
              <p className="text-red-100 mb-1">إجمالي المرتجعات</p>
              <h2 className="text-3xl font-bold">{currentShift.total_returns} ر.س</h2>
            </div>

            <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <p className="text-purple-100 mb-1">النقدية المتوقعة</p>
              <h2 className="text-3xl font-bold">{currentShift.expected_cash} ر.س</h2>
              <p className="text-purple-100 text-sm mt-2">
                الافتتاحي + النقدي - المرتجعات
              </p>
            </div>

            <div className={`card text-white ${
              currentShift.cash_difference === 0 ? 'bg-gradient-to-br from-gray-500 to-gray-600' :
              currentShift.cash_difference > 0 ? 'bg-gradient-to-br from-green-500 to-green-600' :
              'bg-gradient-to-br from-orange-500 to-orange-600'
            }`}>
              <p className="opacity-90 mb-1">الفرق في النقدية</p>
              <h2 className="text-3xl font-bold">
                {currentShift.cash_difference > 0 && '+'}
                {currentShift.cash_difference} ر.س
              </h2>
              <p className="opacity-90 text-sm mt-2">
                {currentShift.cash_difference === 0 ? 'متطابق' :
                 currentShift.cash_difference > 0 ? 'زيادة' : 'نقص'}
              </p>
            </div>
          </div>

          {/* Transactions Table */}
          {currentShift.transactions && currentShift.transactions.length > 0 && (
            <div className="card">
              <h3 className="text-xl font-bold mb-4 text-gray-800">
                <i className="fas fa-exchange-alt ml-2"></i>
                معاملات الخزنة
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">النوع</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المبلغ</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">السبب</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">بواسطة</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentShift.transactions.map((transaction) => (
                      <tr key={transaction.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-white ${
                            transaction.transaction_type === 'deposit' ? 'bg-green-600' :
                            transaction.transaction_type === 'withdrawal' ? 'bg-red-600' :
                            'bg-blue-600'
                          }`}>
                            {transaction.transaction_type === 'deposit' ? 'إيداع' :
                             transaction.transaction_type === 'withdrawal' ? 'سحب' : 'تعديل'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold">
                          {transaction.amount} ر.س
                        </td>
                        <td className="px-4 py-3 text-sm">{transaction.reason}</td>
                        <td className="px-4 py-3 text-sm">{transaction.created_by_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(transaction.created_at).toLocaleString('ar-SA')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card text-center py-20">
          <i className="fas fa-cash-register text-6xl text-gray-400 mb-4"></i>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">لا يوجد شيفت مفتوح</h2>
          <p className="text-gray-600 mb-6">يرجى فتح شيفت جديد للبدء في العمل</p>
          <button
            onClick={() => setShowOpenModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold inline-block"
          >
            <i className="fas fa-folder-open ml-2"></i>
            فتح شيفت جديد
          </button>
        </div>
      )}

      
      

{/* Open Shift Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              <i className="fas fa-folder-open ml-2"></i>
              فتح شيفت جديد
            </h2>
            
            <form onSubmit={handleOpenShift}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  الرصيد الافتتاحي (ر.س) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ملاحظات الفتح (اختياري)
                </label>
                <textarea
                  className="input-field"
                  rows="3"
                  value={openingNote}
                  onChange={(e) => setOpeningNote(e.target.value)}
                  placeholder="أي ملاحظات عند فتح الشيفت..."
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold"
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin ml-2"></i>
                      جاري الفتح...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check ml-2"></i>
                      فتح الشيفت
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={actionLoading}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseModal && currentShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              <i className="fas fa-door-closed ml-2"></i>
              إغلاق الشيفت
            </h2>
            
            {/* Summary */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <h3 className="font-semibold text-gray-800 mb-2">ملخص الشيفت:</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600">إجمالي المبيعات:</p>
                  <p className="font-semibold">{currentShift.total_sales} ر.س</p>
                </div>
                <div>
                  <p className="text-gray-600">إجمالي المرتجعات:</p>
                  <p className="font-semibold">{currentShift.total_returns} ر.س</p>
                </div>
                <div>
                  <p className="text-gray-600">الرصيد الافتتاحي:</p>
                  <p className="font-semibold">{currentShift.opening_balance} ر.س</p>
                </div>
                <div>
                  <p className="text-gray-600">النقدية المتوقعة:</p>
                  <p className="font-semibold text-blue-600">{currentShift.expected_cash} ر.س</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleCloseShift}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  المبلغ الفعلي في الخزنة (ر.س) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field text-lg font-semibold"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  placeholder="0.00"
                  required
                />
                {actualCash && (
                  <p className={`text-sm mt-2 ${
                    (parseFloat(actualCash) - currentShift.expected_cash) === 0 ? 'text-green-600' :
                    (parseFloat(actualCash) - currentShift.expected_cash) > 0 ? 'text-blue-600' :
                    'text-red-600'
                  }`}>
                    الفرق: {((parseFloat(actualCash) || 0) - currentShift.expected_cash).toFixed(2)} ر.س
                    {' '}
                    {(parseFloat(actualCash) - currentShift.expected_cash) === 0 && '(متطابق ✓)'}
                    {(parseFloat(actualCash) - currentShift.expected_cash) > 0 && '(زيادة)'}
                    {(parseFloat(actualCash) - currentShift.expected_cash) < 0 && '(نقص)'}
                  </p>
                )}
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ملاحظات الإغلاق (اختياري)
                </label>
                <textarea
                  className="input-field"
                  rows="3"
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  placeholder="أي ملاحظات عند إغلاق الشيفت..."
                />
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg mb-4">
                <p className="text-yellow-800 text-sm">
                  <i className="fas fa-exclamation-triangle ml-2"></i>
                  تنبيه: بعد إغلاق الشيفت، سيتم تسجيل الخروج تلقائياً.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold"
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin ml-2"></i>
                      جاري الإغلاق...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-door-closed ml-2"></i>
                      إغلاق الشيفت
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={actionLoading}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showTransactionModal && currentShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              <i className="fas fa-exchange-alt ml-2"></i>
              إضافة معاملة
            </h2>
            
            <form onSubmit={handleAddTransaction}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  نوع المعاملة *
                </label>
                <select
                  className="input-field"
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                  required
                >
                  <option value="deposit">إيداع</option>
                  <option value="withdrawal">سحب</option>
                  <option value="adjustment">تعديل</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  المبلغ (ر.س) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={transactionAmount}
                  onChange={(e) => setTransactionAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  السبب *
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={transactionReason}
                  onChange={(e) => setTransactionReason(e.target.value)}
                  placeholder="مثال: دفع فاتورة، استلام إيداع، إلخ"
                  required
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ملاحظات (اختياري)
                </label>
                <textarea
                  className="input-field"
                  rows="2"
                  value={transactionNote}
                  onChange={(e) => setTransactionNote(e.target.value)}
                  placeholder="أي ملاحظات إضافية..."
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold"
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin ml-2"></i>
                      جاري الإضافة...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check ml-2"></i>
                      إضافة
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTransactionModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={actionLoading}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Summary Modal - ملخص الإغلاق */}
      {showSummaryModal && closedShiftData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
              <div className="flex items-center justify-center mb-2">
                <i className="fas fa-check-circle text-4xl"></i>
              </div>
              <h2 className="text-2xl font-bold text-center">تم إغلاق الشيفت بنجاح</h2>
              <p className="text-green-100 text-center mt-1">ملخص الشيفت النهائي</p>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {/* معلومات الشيفت */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">الكاشير</p>
                    <p className="font-bold text-gray-800">{closedShiftData.user_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">مدة الشيفت</p>
                    <p className="font-bold text-gray-800">{closedShiftData.duration} ساعة</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">وقت الفتح</p>
                    <p className="font-semibold text-gray-700 text-sm">
                      {new Date(closedShiftData.opened_at).toLocaleString('ar-SA', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">وقت الإغلاق</p>
                    <p className="font-semibold text-gray-700 text-sm">
                      {new Date(closedShiftData.closed_at).toLocaleString('ar-SA', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* الإحصائيات المالية */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700 mb-1">الرصيد الافتتاحي</p>
                  <p className="text-2xl font-bold text-blue-900">{closedShiftData.opening_balance} ر.س</p>
                </div>
                
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700 mb-1">إجمالي المبيعات</p>
                  <p className="text-2xl font-bold text-green-900">{closedShiftData.total_sales} ر.س</p>
                  <p className="text-xs text-green-600 mt-1">
                    نقدي: {closedShiftData.total_cash_sales} ر.س | بطاقة: {closedShiftData.total_card_sales} ر.س
                  </p>
                </div>
                
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700 mb-1">إجمالي المرتجعات</p>
                  <p className="text-2xl font-bold text-red-900">{closedShiftData.total_returns} ر.س</p>
                  <p className="text-xs text-red-600 mt-1">
                    عدد المرتجعات: {closedShiftData.returns_count}
                  </p>
                </div>
                
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-700 mb-1">النقدية المتوقعة</p>
                  <p className="text-2xl font-bold text-purple-900">{closedShiftData.expected_cash} ر.س</p>
                  <p className="text-xs text-purple-600 mt-1">
                    الافتتاحي + النقدي - المرتجعات
                  </p>
                </div>
              </div>

              {/* المطابقة النقدية */}
              <div className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-gray-300 mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <i className="fas fa-calculator ml-2"></i>
                  مطابقة النقدية
                </h3>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">المتوقع</p>
                    <p className="text-xl font-bold text-gray-800">{closedShiftData.expected_cash} ر.س</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">الفعلي</p>
                    <p className="text-xl font-bold text-gray-800">{closedShiftData.actual_cash} ر.س</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">الفرق</p>
                    <p className={`text-2xl font-bold ${
                      closedShiftData.cash_difference === 0 ? 'text-green-600' :
                      closedShiftData.cash_difference > 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {closedShiftData.cash_difference > 0 && '+'}
                      {closedShiftData.cash_difference} ر.س
                    </p>
                  </div>
                </div>
                
                {/* تقييم الفرق */}
                <div className={`p-3 rounded-lg text-center ${
                  closedShiftData.cash_difference === 0 ? 'bg-green-100 border border-green-300' :
                  Math.abs(closedShiftData.cash_difference) <= 10 ? 'bg-yellow-100 border border-yellow-300' :
                  'bg-red-100 border border-red-300'
                }`}>
                  <p className={`font-bold ${
                    closedShiftData.cash_difference === 0 ? 'text-green-700' :
                    Math.abs(closedShiftData.cash_difference) <= 10 ? 'text-yellow-700' :
                    'text-red-700'
                  }`}>
                    {closedShiftData.cash_difference === 0 ? '✅ مطابق تماماً - ممتاز!' :
                     closedShiftData.cash_difference > 0 ? `⚠️ زيادة في النقدية: ${closedShiftData.cash_difference} ر.س` :
                     `⚠️ نقص في النقدية: ${Math.abs(closedShiftData.cash_difference)} ر.س`}
                  </p>
                </div>
              </div>

              {/* عدد العمليات */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                  <p className="text-sm text-blue-700 mb-1">عدد المبيعات</p>
                  <p className="text-3xl font-bold text-blue-900">{closedShiftData.sales_count}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
                  <p className="text-sm text-red-700 mb-1">عدد المرتجعات</p>
                  <p className="text-3xl font-bold text-red-900">{closedShiftData.returns_count}</p>
                </div>
              </div>

              {/* ملاحظة الإغلاق */}
              {closedShiftData.closing_note && (
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 mb-6">
                  <p className="text-sm text-yellow-700 font-semibold mb-1">
                    <i className="fas fa-sticky-note ml-1"></i>
                    ملاحظة الإغلاق
                  </p>
                  <p className="text-gray-800">{closedShiftData.closing_note}</p>
                </div>
              )}

              {/* زر تسجيل الخروج */}
              <button
                onClick={handleLogoutAfterSummary}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white py-4 rounded-lg font-bold text-lg transition-all duration-200 flex items-center justify-center"
              >
                <i className="fas fa-sign-out-alt ml-2"></i>
                تسجيل الخروج
              </button>
              
              <p className="text-center text-gray-500 text-sm mt-3">
                شكراً لك! تم حفظ جميع البيانات بنجاح
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashRegister;
