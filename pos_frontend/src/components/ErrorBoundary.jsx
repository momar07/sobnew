import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🔴 Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <i className="fas fa-exclamation-triangle text-red-600 text-3xl"></i>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">حدث خطأ</h1>
              <p className="text-gray-600">عذراً، حدثت مشكلة في عرض هذه الصفحة</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="font-bold text-red-900 mb-2">تفاصيل الخطأ:</p>
              <pre className="text-sm text-red-800 overflow-auto" style={{ direction: 'ltr' }}>
                {this.state.error && this.state.error.toString()}
              </pre>
            </div>

            {this.state.errorInfo && (
              <details className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <summary className="cursor-pointer font-semibold text-gray-700 mb-2">
                  معلومات إضافية (للمطورين)
                </summary>
                <pre className="text-xs text-gray-600 overflow-auto mt-2" style={{ direction: 'ltr' }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="font-bold text-blue-900 mb-2">خطوات الحل:</p>
              <ol className="list-decimal mr-6 text-blue-800 space-y-1">
                <li>تحقق من Console (F12) لمزيد من التفاصيل</li>
                <li>تأكد أن Backend يعمل على localhost:8000</li>
                <li>تأكد من عمل migrations للـ users app</li>
                <li>جرّب تسجيل الخروج والدخول مرة أخرى</li>
              </ol>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                <i className="fas fa-home ml-2"></i>
                العودة للرئيسية
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                <i className="fas fa-redo ml-2"></i>
                إعادة المحاولة
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
