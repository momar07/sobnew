import { useState, useEffect } from 'react';
import { productsAPI, categoriesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Products = () => {
  const PAGE_KEY = 'products.list';
  const { hasAction } = useAuth();
  const canAdd = hasAction(PAGE_KEY, 'products.add');
  const canDelete = hasAction(PAGE_KEY, 'products.delete');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    cost: '',
    stock: '',
    barcode: '',
    image_url: '',
    is_active: true,
    description: '',
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [searchQuery]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await productsAPI.getAll({ search: searchQuery });
      setProducts(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await categoriesAPI.getAll();
      setCategories(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await productsAPI.update(editingProduct.id, formData);
        alert('تم تحديث المنتج بنجاح!');
      } else {
        await productsAPI.create(formData);
        alert('تم إضافة المنتج بنجاح!');
      }
      setShowModal(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('حدث خطأ أثناء حفظ المنتج');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price,
      cost: product.cost,
      stock: product.stock,
      barcode: product.barcode || '',
      image_url: product.image_url || '',
      is_active: product.is_active,
      description: product.description || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    
    try {
      await productsAPI.delete(id);
      alert('تم حذف المنتج بنجاح!');
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('حدث خطأ أثناء حذف المنتج');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      price: '',
      cost: '',
      stock: '',
      barcode: '',
      image_url: '',
      is_active: true,
      description: '',
    });
    setEditingProduct(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          <i className="fas fa-box ml-2"></i>
          إدارة المنتجات
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <i className="fas fa-plus ml-2"></i>
          إضافة منتج جديد
        </button>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <input
          type="text"
          placeholder="البحث عن منتج..."
          className="input-field"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Products Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المنتج</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الفئة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">السعر</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">التكلفة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المخزون</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الحالة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-10">
                    <i className="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-gray-500">
                    لا توجد منتجات
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-3 space-x-reverse">
                        {product.image_url && (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                        <div>
                          <p className="font-semibold text-gray-800">{product.name}</p>
                          {product.barcode && (
                            <p className="text-xs text-gray-500">{product.barcode}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {product.category_name && (
                        <span
                          className="px-2 py-1 rounded-full text-xs text-white"
                          style={{ backgroundColor: product.category_color }}
                        >
                          {product.category_name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-blue-600">
                      {product.price} ر.س
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {product.cost} ر.س
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          product.is_low_stock
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          product.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {product.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-2 space-x-reverse">
                        <button
                          onClick={() => handleEdit(product)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              {editingProduct ? 'تعديل منتج' : 'إضافة منتج جديد'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    اسم المنتج *
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
                    الفئة *
                  </label>
                  <select
                    required
                    className="input-field"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="">اختر الفئة</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    السعر *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input-field"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    التكلفة *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input-field"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    الكمية *
                  </label>
                  <input
                    type="number"
                    required
                    className="input-field"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    الباركود
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  رابط الصورة
                </label>
                <input
                  type="url"
                  className="input-field"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  الوصف
                </label>
                <textarea
                  className="input-field"
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                ></textarea>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  className="ml-2"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <label htmlFor="is_active" className="text-sm font-semibold text-gray-700">
                  المنتج نشط
                </label>
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

export default Products;
