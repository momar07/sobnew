import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { productsAPI, categoriesAPI, salesAPI, customersAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const POS = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Ref لـ scroll container
  const cartItemsRef = useRef(null);
  const lastItemRef = useRef(null);
  const paidInputRef = useRef(null);

  const {
    // tabs
    tabs,
    activeTabId,
    setActiveTabId,
    createTab,
    closeTab,

    // active tab data
    cart,
    customer,
    paymentMethod,
    discount,
    tax,
    paidAmount,
    lastAddedItemId,

    // operations
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setCustomer,
    setPaymentMethod,
    setDiscount,
    setTax,
    setPaidAmount,
    getSubtotal,
    getTotal,
  } = useCart();

  // Auto-scroll للعنصر الجديد
  useEffect(() => {
    if (lastAddedItemId && lastItemRef.current) {
      lastItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [lastAddedItemId]);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchCustomers();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await categoriesAPI.getAll();
      setCategories(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await customersAPI.getAll();
      const customersList = response.data.results || response.data;
      console.log('✅ Customers loaded:', customersList.length);
      setCustomers(customersList);
    } catch (error) {
      console.error('❌ Error fetching customers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      if (searchQuery) params.search = searchQuery;

      const response = await productsAPI.getAll(params);
      setProducts(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, searchQuery]);

  // Auto-refresh للمخزون كل 30 ثانية
  useEffect(() => {
    const interval = setInterval(() => {
      fetchProducts(); // تحديث صامت بدون loading indicator
    }, 30000); // 30 ثانية

    return () => clearInterval(interval);
  }, [selectedCategory, searchQuery]);

  // تحديث المخزون عند العودة للتاب/النافذة
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchProducts(); // تحديث عند العودة للصفحة
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [selectedCategory, searchQuery]);

  
  const closeOrResetCurrentTab = () => {
    // لو فيه أكتر من تبويب، اقفل الحالي
    if (tabs.length > 1) {
      closeTab(activeTabId);
      return;
    }
    // لو تبويب واحد فقط، صفّر السلة بدل ما تقفلها
    clearCart();
  };

  const focusPaidInput = () => {
    // فوكس على خانة المدفوع (مفيد عند فتح تبويب جديد أو عند بدء كتابة أرقام)
    setTimeout(() => {
      paidInputRef.current?.focus();
      // select كل الرقم لسهولة الاستبدال (لو فيه قيمة)
      if (paidInputRef.current?.select) paidInputRef.current.select();
    }, 0);
  };

  const handleCreateNewTab = () => {
    createTab({ switchTo: true });
    focusPaidInput();
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      // لو المستخدم بيكتب داخل input/textarea ما نتدخلش
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const isNumberKey = /^\d$/.test(e.key) || e.key === '.';
      if (!isNumberKey) return;
      if (!cart || cart.length === 0) return;

      e.preventDefault();
      const next = `${paidAmount || ''}${e.key}`;
      setPaidAmount(next);
      // خليك دايمًا على خانة المدفوع بعد أول رقم
      setTimeout(() => {
        const el = paidInputRef.current;
        if (!el) return;
        el.focus();
        if (typeof el.setSelectionRange === 'function') {
          const len = String(next).length;
          el.setSelectionRange(len, len);
        }
      }, 0);
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [cart, paidAmount, setPaidAmount]);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('السلة فارغة!');
      return;
    }

    try {
      const subtotal = getSubtotal();
      const discountAmount = (subtotal * discount) / 100;
      const taxAmount = ((subtotal - discountAmount) * tax) / 100;
      const total = getTotal();

      const saleData = {
        customer: customer || null, // العميل المختار (UUID string أو null)
        subtotal: subtotal.toFixed(2),
        discount: discountAmount.toFixed(2),
        tax: taxAmount.toFixed(2),
        total: total.toFixed(2),
        payment_method: paymentMethod,
        status: 'completed',
        items: cart.map(item => ({
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      };

      console.log('📦 Sale Data:', saleData);
      await salesAPI.create(saleData);
      
      // ✨ تحديث المخزون مباشرة بعد البيع الناجح
      updateProductsStock();
      
      alert('تمت عملية البيع بنجاح! ✓');
      closeOrResetCurrentTab();
      
      // إعادة جلب المنتجات لتحديث العرض
      fetchProducts();
    } catch (error) {
      console.error('Error creating sale:', error);
      alert('حدث خطأ أثناء إتمام عملية البيع');
    }
  };

  // دالة لتحديث المخزون محلياً (Real-time update)
  const updateProductsStock = () => {
    setProducts(prevProducts => 
      prevProducts.map(product => {
        // البحث عن المنتج في السلة
        const cartItem = cart.find(item => item.id === product.id);
        
        if (cartItem) {
          // خصم الكمية المباعة من المخزون
          return {
            ...product,
            stock: product.stock - cartItem.quantity
          };
        }
        
        return product;
      })
    );
  };

  return (
    <div className="flex h-screen bg-gray-100 relative pt-12">
      {/* POS Tabs */}
      <div className="absolute top-0 left-0 right-0 bg-white border-b z-20">
        <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTabId(t.id)}
              className={
                `flex items-center gap-2 px-3 py-1 rounded-full border whitespace-nowrap ` +
                (t.id === activeTabId ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200')
              }
              title={t.name}
            >
              <span className="text-sm font-medium">{t.name}</span>
              <span className="text-xs opacity-80">
                ({t.cart?.reduce((sum, it) => sum + (it.quantity || 0), 0) || 0})
              </span>

              <span
                onClick={(e) => {
                  e.stopPropagation();
                  const hasItems = (t.cart?.length || 0) > 0;
                  if (hasItems) {
                    const ok = window.confirm('يوجد أصناف داخل هذه العملية. هل تريد إغلاقها؟');
                    if (!ok) return;
                  }
                  closeTab(t.id);
                }}
                className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-black/10"
                title="إغلاق"
                role="button"
              >
                ✕
              </span>
            </button>
          ))}

          <button
            onClick={handleCreateNewTab}
            className="px-3 py-1 rounded-full border border-dashed border-gray-300 text-gray-700 hover:bg-gray-50 whitespace-nowrap"
            title="تعليق العملية الحالية وفتح عملية جديدة"
          >
            + عملية جديدة
          </button>
        </div>
      </div>


      {/* Products Section */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Search and Categories */}
        <div className="mb-6">
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              placeholder="البحث عن منتج أو مسح الباركود..."
              className="input-field flex-1"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              onClick={() => fetchProducts()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="تحديث المخزون"
            >
              <i className="fas fa-sync-alt"></i>
            </button>

            <Link
              to="/pos/barcode"
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
              title="فتح وضع الباركود (مناسب للسكانر)"
            >
              <i className="fas fa-barcode ml-2"></i>
              وضع الباركود
            </Link>
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap ${
                selectedCategory === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <i className="fas fa-th ml-1"></i>
              الكل
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap ${
                  selectedCategory === category.id
                    ? 'text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
                style={{
                  backgroundColor: selectedCategory === category.id ? category.color : '',
                }}
              >
                {category.icon && <i className={`${category.icon} ml-1`}></i>}
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-10">
              <i className="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
              <p className="mt-2 text-gray-600">جاري التحميل...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="col-span-full text-center py-10">
              <i className="fas fa-box-open text-6xl text-gray-400 mb-4"></i>
              <p className="text-gray-600">لا توجد منتجات</p>
            </div>
          ) : (
            products.map((product) => (
              <div
                key={product.id}
                onClick={() => addToCart(product)}
                className="card cursor-pointer hover:shadow-lg transition-shadow"
              >
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-32 object-cover rounded-lg mb-3"
                  />
                )}
                <h3 className="font-semibold text-gray-800 mb-2">{product.name}</h3>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-blue-600">
                    {product.price} ر.س
                  </span>
                  <span className={`text-sm font-semibold ${
                    product.stock < 10 ? 'text-red-600' : 
                    product.stock < 30 ? 'text-orange-500' : 
                    'text-green-600'
                  }`}>
                    <i className="fas fa-box ml-1"></i>
                    {product.stock}
                  </span>
                </div>
                {product.category_name && (
                  <span
                    className="inline-block mt-2 px-2 py-1 text-xs rounded-full text-white"
                    style={{ backgroundColor: product.category_color }}
                  >
                    {product.category_name}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-96 bg-white shadow-lg p-6 flex flex-col">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">
          <i className="fas fa-shopping-cart ml-2"></i>
          سلة المشتريات
        </h2>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto mb-4">
          {cart.length === 0 ? (
            <div className="text-center py-10">
              <i className="fas fa-shopping-basket text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500">السلة فارغة</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div 
                  key={item.id}
                  ref={lastAddedItemId === item.id ? lastItemRef : null}
                  className={`border rounded-lg p-3 transition-all duration-500 ${
                    lastAddedItemId === item.id 
                      ? 'border-green-500 bg-green-50 shadow-lg scale-105 ring-2 ring-green-400' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-800">{item.name}</h4>
                      {lastAddedItemId === item.id && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500 text-white animate-pulse">
                          <i className="fas fa-check ml-1"></i>
                          جديد
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 bg-gray-200 rounded hover:bg-gray-300"
                      >
                        -
                      </button>
                      <span className="w-12 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 bg-gray-200 rounded hover:bg-gray-300"
                      >
                        +
                      </button>
                    </div>
                    
                    <div className="text-left">
                      <p className="text-sm text-gray-600">{item.price} ر.س</p>
                      <p className="font-bold text-blue-600">
                        {(item.price * item.quantity).toFixed(2)} ر.س
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        {cart.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            {/* Discount & Tax */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-sm text-gray-600">الخصم %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="input-field"
                />
              </div>
              <div className="flex-1">
                <label className="text-sm text-gray-600">الضريبة %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={tax}
                  onChange={(e) => setTax(Number(e.target.value))}
                  className="input-field"
                />
              </div>
            </div>

            {/* Customer Selection */}
            <div>
              <label className="text-sm text-gray-600 block mb-2">
                <i className="fas fa-user ml-1"></i>
                العميل ({customers.length} متاح)
              </label>
              <select
                value={customer || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  console.log('Selected customer value:', value);
                  setCustomer(value || null);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-right"
              >
                <option value="">بدون عميل (زائر)</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} - {customer.phone}
                  </option>
                ))}
              </select>
              {customer && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ تم اختيار العميل
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="text-sm text-gray-600 block mb-2">طريقة الدفع</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="input-field"
              >
                <option value="cash">نقدي</option>
                <option value="card">بطاقة</option>
                <option value="both">نقدي + بطاقة</option>
              </select>
            </div>

            {/* Summary */}
            <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">المجموع الفرعي:</span>
                <span className="font-semibold">{getSubtotal().toFixed(2)} ر.س</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>الخصم ({discount}%):</span>
                  <span>-{((getSubtotal() * discount) / 100).toFixed(2)} ر.س</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-sm text-blue-600">
                  <span>الضريبة ({tax}%):</span>
                  <span>
                    +{(((getSubtotal() - (getSubtotal() * discount) / 100) * tax) / 100).toFixed(2)} ر.س
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>الإجمالي:</span>
                <span className="text-blue-600">{getTotal().toFixed(2)} ر.س</span>
              </div>
            
              <div className="mt-3 space-y-2 border-t pt-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm text-gray-700 font-semibold whitespace-nowrap">المدفوع:</label>
                  <input
                    type="number"
                    ref={paidInputRef}
                    min="0"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCheckout(); } }}
                    className="w-40 p-2 border rounded text-right"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">الباقي / المتبقي:</span>
                  <span className={`font-bold ${(() => {
                    const paid = parseFloat(paidAmount || '0') || 0;
                    const diff = paid - getTotal();
                    return diff >= 0 ? 'text-green-700' : 'text-red-700';
                  })()}`}>
                    {(() => {
                      const paid = parseFloat(paidAmount || '0') || 0;
                      const diff = paid - getTotal();
                      const label = diff >= 0 ? 'باقي' : 'متبقي';
                      return `${label}: ${Math.abs(diff).toFixed(2)} ر.س`;
                    })()}
                  </span>
                </div>
              </div>
</div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleCheckout}
                className="w-full btn-success py-3 text-lg"
              >
                <i className="fas fa-check-circle ml-2"></i>
                إتمام عملية البيع
              </button>
              <button
                onClick={closeOrResetCurrentTab}
                className="w-full btn-danger"
              >
                <i className="fas fa-times-circle ml-2"></i>
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default POS;