import { useState, useEffect } from 'react';
import { customersAPI } from '../services/api';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, [searchQuery]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await customersAPI.getAll({ search: searchQuery });
      setCustomers(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await customersAPI.update(editingCustomer.id, formData);
        alert('تم تحديث العميل بنجاح!');
      } else {
        await customersAPI.create(formData);
        alert('تم إضافة العميل بنجاح!');
      }
      setShowModal(false);
      resetForm();
      fetchCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('حدث خطأ أثناء حفظ العميل');
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا العميل؟')) return;
    
    try {
      await customersAPI.delete(id);
      alert('تم حذف العميل بنجاح!');
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('حدث خطأ أثناء حذف العميل');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
    });
    setEditingCustomer(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          <i className="fas fa-users ml-2"></i>
          إدارة العملاء
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <i className="fas fa-user-plus ml-2"></i>
          إضافة عميل جديد
        </button>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <input
          type="text"
          placeholder="البحث عن عميل..."
          className="input-field"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-10">
            <i className="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
          </div>
        ) : customers.length === 0 ? (
          <div className="col-span-full text-center py-10">
            <i className="fas fa-users text-6xl text-gray-400 mb-4"></i>
            <p className="text-gray-600">لا يوجد عملاء</p>
          </div>
        ) : (
          customers.map((customer) => (
            <div key={customer.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <i className="fas fa-user text-blue-600 text-xl"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{customer.name}</h3>
                    <p className="text-sm text-gray-600">
                      <i className="fas fa-phone ml-1"></i>
                      {customer.phone}
                    </p>
                  </div>
                </div>
                
                <div className="flex space-x-2 space-x-reverse">
                  <button
                    onClick={() => handleEdit(customer)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    onClick={() => handleDelete(customer.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>

              {customer.email && (
                <p className="text-sm text-gray-600 mb-2">
                  <i className="fas fa-envelope ml-1"></i>
                  {customer.email}
                </p>
              )}

              {customer.address && (
                <p className="text-sm text-gray-600 mb-3">
                  <i className="fas fa-map-marker-alt ml-1"></i>
                  {customer.address}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {customer.total_purchases || 0} ر.س
                  </p>
                  <p className="text-xs text-gray-600">إجمالي المشتريات</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {customer.points || 0}
                  </p>
                  <p className="text-xs text-gray-600">النقاط</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              {editingCustomer ? 'تعديل عميل' : 'إضافة عميل جديد'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  الاسم *
                </label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  رقم الهاتف *
                </label>
                <input
                  type="tel"
                  required
                  className="input-field"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                  العنوان
                </label>
                <textarea
                  className="input-field"
                  rows="3"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                ></textarea>
              </div>

              <div className="flex space-x-3 space-x-reverse pt-4">
                <button type="submit" className="btn-primary flex-1">
                  <i className="fas fa-save ml-2"></i>
                  حفظ
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
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

export default Customers;
