import React from 'react';
import { useAuth } from '../context/AuthContext';

function UserManagementTest() {
  const { user } = useAuth();

  console.log('🔍 User Management Test - User:', user);
  console.log('🔍 User role:', user?.groups?.[0]);
  console.log('🔍 Is Admin?', user?.groups?.[0] === 'admin');
  console.log('🔍 Is Manager?', user?.groups?.[0] === 'manager');

  return (
    <div className="p-8">
      <div className="bg-white rounded-xl shadow-md p-8">
        <h1 className="text-3xl font-bold mb-6">🧪 اختبار صفحة إدارة المستخدمين</h1>
        
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded">
            <p className="font-bold">المستخدم الحالي:</p>
            <p>Username: {user?.username || 'غير متاح'}</p>
            <p>Name: {user?.first_name} {user?.last_name}</p>
            <p>Role: {user?.groups?.[0] || 'غير متاح'}</p>
            <p>Employee #: {user?.profile?.employee_number || 'غير متاح'}</p>
          </div>

          <div className="p-4 bg-green-50 rounded">
            <p className="font-bold">الصلاحيات:</p>
            <p>✅ Is Admin: {user?.groups?.[0] === 'admin' ? 'نعم' : 'لا'}</p>
            <p>✅ Is Manager: {user?.groups?.[0] === 'manager' ? 'نعم' : 'لا'}</p>
            <p>✅ Is Cashier: {user?.groups?.[0] === 'cashier' ? 'نعم' : 'لا'}</p>
          </div>

          <div className="p-4 bg-yellow-50 rounded">
            <p className="font-bold">⚠️ ملاحظة:</p>
            <p>إذا ظهر "غير متاح" في Role، المشكلة في:</p>
            <ul className="list-disc mr-6 mt-2">
              <li>Backend: تطبيق users غير مُفعّل</li>
              <li>Database: لم يتم عمل migrate</li>
              <li>User: لا يوجد UserProfile مرتبط</li>
            </ul>
          </div>

          <div className="p-4 bg-red-50 rounded">
            <p className="font-bold">🔧 خطوات الحل:</p>
            <ol className="list-decimal mr-6 mt-2">
              <li>تأكد من تشغيل Backend</li>
              <li>تأكد من عمل migrate للـ users app</li>
              <li>تأكد من تشغيل create_users.py</li>
              <li>افتح Console (F12) وشاهد الأخطاء</li>
            </ol>
          </div>
        </div>

        <div className="mt-8">
          <a href="/" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
            العودة للرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export default UserManagementTest;
