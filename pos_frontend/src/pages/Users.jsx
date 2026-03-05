import { useState, useEffect } from 'react';
import { usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { isAdmin } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    password2: '',
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    employee_id: '',
  });

  useEffect(() => {
    if (isAdmin()) {
      fetchUsers();
    }
  }, [searchQuery]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAll({ search: searchQuery });
      setUsers(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.password2) {
      alert('كلمات المرور غير متطابقة');
      return;
    }

    try {
      await usersAPI.create(formData);
      alert('تم إضافة المستخدم بنجاح!');
      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      alert(error.response?.data?.username?.[0] || 'حدث خطأ أثناء إضافة المستخدم');
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    if (!confirm(`هل أنت متأكد من تغيير الدور؟`)) return;

    try {
      await usersAPI.changeRole(userId, newRole);
      alert('تم تغيير الدور بنجاح!');
      fetchUsers();
    } catch (error) {
      console.error('Error changing role:', error);
      alert('حدث خطأ أثناء تغيير الدور');
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;

    try {
      await usersAPI.delete(userId);
      alert('تم حذف المستخدم بنجاح!');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('حدث خطأ أثناء حذف المستخدم');
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      password2: '',
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      employee_id: '',
    });
  };

  if (!isAdmin()) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="text-center py-20">
          <i className="fas fa-lock text-6xl text-gray-400 mb-4"></i>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">
            غير مصرح
          </h2>
          <p className="text-gray-600">
            فقط مدير النظام يمكنه الوصول لهذه الصفحة
          </p>
        </div>
      </div>
    );
  }

  const getRoleBadge = (groups=[]) => {
    if (groups?.includes('Admins')) return <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-700">مدير النظام</span>;
    if (groups?.includes('Managers')) return <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700">مدير</span>;
    if (groups?.includes('Cashier Plus')) return <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-700">كاشير +</span>;
    if (groups?.includes('Cashiers')) return <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-700">كاشير</span>;
    return <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700">مستخدم</span>;
  };

  // NOTE: There used to be a duplicate/unfinished role-badge implementation here.
  // It caused an extra closing brace `}` at the end of the file and broke Vite.
  // The `getRoleBadge(groups)` above is the correct implementation.

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          <i className="fas fa-users ml-2"></i>
          إدارة المستخدمين
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <i className="fas fa-user-plus ml-2"></i>
          إضافة مستخدم جديد
        </button>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <input
          type="text"
          placeholder="البحث عن مستخدم..."
          className="input-field"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-10">
            <i className="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
          </div>
        ) : users.length === 0 ? (
          <div className="col-span-full text-center py-10">
            <i className="fas fa-users text-6xl text-gray-400 mb-4"></i>
            <p className="text-gray-600">لا يوجد مستخدمين</p>
          </div>
        ) : (
          users.map((user) => (
            <div key={user.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {user.first_name?.[0] || user.username[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">
                      {user.first_name && user.last_name
                        ? `${user.first_name} ${user.last_name}`
                        : user.username}
                    </h3>
                    <p className="text-sm text-gray-600">@{user.username}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {user.email && (
                  <p className="text-sm text-gray-600">
                    <i className="fas fa-envelope ml-2"></i>
                    {user.email}
                  </p>
                )}
                {user.profile?.phone && (
                  <p className="text-sm text-gray-600">
                    <i className="fas fa-phone ml-2"></i>
                    {user.profile.phone}
                  </p>
                )}
                {user.profile?.employee_id && (
                  <p className="text-sm text-gray-600">
                    <i className="fas fa-id-badge ml-2"></i>
                    {user.profile.employee_id}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between mb-4">
                {getRoleBadge(user.groups?.[0])}
                <span className={`text-sm ${user.is_active ? 'text-green-600' : 'text-red-600'}`}>
                  <i className={`fas fa-circle ml-1 text-xs`}></i>
                  {user.is_active ? 'نشط' : 'غير نشط'}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {user.profile?.sales_count || 0}
                  </p>
                  <p className="text-xs text-gray-600">عدد المبيعات</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {user.profile?.total_sales_amount || 0} ر.س
                  </p>
                  <p className="text-xs text-gray-600">إجمالي المبيعات</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <select
                  value={user.groups?.[0]}
                  onChange={(e) => handleChangeRole(user.id, e.target.value)}
                  className="flex-1 input-field text-sm"
                >
                  <option value="admin">مدير النظام</option>
                  <option value="manager">مدير المتجر</option>
                  <option value="cashier">كاشير</option>
                </select>
                <button
                  onClick={() => handleDelete(user.id)}
                  className="text-red-600 hover:text-red-700 px-3"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              إضافة مستخدم جديد
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    اسم المستخدم *
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    الاسم الأول
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    اسم العائلة
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    كلمة المرور *
                  </label>
                  <input
                    type="password"
                    required
                    className="input-field"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    تأكيد كلمة المرور *
                  </label>
                  <input
                    type="password"
                    required
                    className="input-field"
                    value={formData.password2}
                    onChange={(e) => setFormData({ ...formData, password2: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    className="input-field"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    رقم الموظف
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex space-x-3 space-x-reverse pt-4">
                <button type="submit" className="btn-primary flex-1">
                  <i className="fas fa-save ml-2"></i>
                  حفظ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="btn-secondary flex-1"
                >
                  <i className="fas fa-times ml-2"></i>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
