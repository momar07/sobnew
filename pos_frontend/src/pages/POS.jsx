import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { productsAPI, categoriesAPI, salesAPI, customersAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const POS = () => {
  const { user } = useAuth();
  const [products, setProducts]           = useState([]);
  const [categories, setCategories]       = useState([]);
  const [customers, setCustomers]         = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery]     = useState('');

  // ✅ loading منفصل — واحد للـ init وواحد للـ products بس
  const [initialLoading, setInitialLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);

  const cartItemsRef  = useRef(null);
  const lastItemRef   = useRef(null);
  const paidInputRef  = useRef(null);

  const {
    tabs, activeTabId, setActiveTabId, createTab, closeTab,
    cart, customer, paymentMethod, discount, tax, paidAmount,
    lastAddedItemId,
    addToCart, removeFromCart, updateQuantity, clearCart,
    setCustomer, setPaymentMethod, setDiscount, setTax, setPaidAmount,
    getSubtotal, getTotal,
  } = useCart();

  // Auto-scroll للعنصر الجديد
  useEffect(() => {
    if (lastAddedItemId && lastItemRef.current) {
      lastItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [lastAddedItemId]);

  // ✅ fetchProducts بـ useCallback عشان مايتعمل instance جديد في كل render
  const fetchProducts = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setProductsLoading(true);
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      if (searchQuery)       params.search   = searchQuery;

      const response = await productsAPI.getAll(params);
      setProducts(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      if (showLoader) setProductsLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  // ✅ الحل الرئيسي — fetchInitialData
  // بنجيب الـ categories والـ customers والـ products مع بعض
  // وبنستنى كلهم يخلصوا قبل ما نشيل الـ loading
  // وده بيضمن إن الـ render الأول يكون كامل البيانات
  useEffect(() => {
    const fetchInitialData = async () => {
      setInitialLoading(true);
      try {
        // ✅ Promise.all — بيشغل الثلاث calls مع بعض
        // وبيستنى كلهم يخلصوا قبل ما يكمل
        const [categoriesRes, productsRes, customersRes] = await Promise.all([
          categoriesAPI.getAll(),
          productsAPI.getAll(),
          customersAPI.getAll(),
        ]);

        setCategories(categoriesRes.data.results || categoriesRes.data);
        setProducts(productsRes.data.results   || productsRes.data);
        setCustomers(customersRes.data.results || customersRes.data);

      } catch (error) {
        console.error('Error fetching initial data:', error);
      } finally {
        // ✅ بس لما كل البيانات جاهزة نشيل الـ loading
        setInitialLoading(false);
      }
    };

    fetchInitialData();
  }, []); // ← بيشتغل مرة واحدة عند أول mount بس

  // ✅ لما الـ category أو الـ search يتغير — بس بعد ما الـ init خلص
  useEffect(() => {
    if (!initialLoading) {
      fetchProducts(true);
    }
  }, [selectedCategory, searchQuery]);

  // Auto-refresh كل 30 ثانية — silent بدون loader
  useEffect(() => {
    const interval = setInterval(() => {
      fetchProducts(false); // false = بدون loader
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchProducts]);

  // تحديث عند العودة للتاب
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchProducts(false); // false = بدون loader
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchProducts]);

  const closeOrResetCurrentTab = () => {
    if (tabs.length > 1) { closeTab(activeTabId); return; }
    clearCart();
  };

  const focusPaidInput = () => {
    setTimeout(() => {
      paidInputRef.current?.focus();
      if (paidInputRef.current?.select) paidInputRef.current.select();
    }, 0);
  };

  const handleCreateNewTab = () => {
    createTab({ switchTo: true });
    focusPaidInput();
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const isNumberKey = /^\d$/.test(e.key) || e.key === '.';
      if (!isNumberKey) return;
      if (!cart || cart.length === 0) return;
      e.preventDefault();
      const next = `${paidAmount || ''}${e.key}`;
      setPaidAmount(next);
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
    if (cart.length === 0) { alert('السلة فارغة!'); return; }
    try {
      const subtotal       = getSubtotal();
      const discountAmount = (subtotal * discount) / 100;
      const taxAmount      = ((subtotal - discountAmount) * tax) / 100;
      const total          = getTotal();

      const saleData = {
        customer:       customer || null,
        subtotal:       subtotal.toFixed(2),
        discount:       discountAmount.toFixed(2),
        tax:            taxAmount.toFixed(2),
        total:          total.toFixed(2),
        payment_method: paymentMethod,
        status:         'completed',
        items: cart.map(item => ({
          product_id:   item.id,
          product_name: item.name,
          quantity:     item.quantity,
          price:        item.price,
        })),
      };

      await salesAPI.create(saleData);
      updateProductsStock();
      alert('تمت عملية البيع بنجاح! ✓');
      closeOrResetCurrentTab();
      fetchProducts(false); // ✅ silent refresh بعد البيع
    } catch (error) {
      console.error('Error creating sale:', error);
      alert('حدث خطأ أثناء إتمام عملية البيع');
    }
  };

  const updateProductsStock = () => {
    setProducts(prev =>
      prev.map(product => {
        const cartItem = cart.find(item => item.id === product.id);
        return cartItem
          ? { ...product, stock: product.stock - cartItem.quantity }
          : product;
      })
    );
  };

  // ✅ شاشة loading موحدة للـ init فقط
  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-6xl text-blue-600"></i>
          <p className="mt-4 text-gray-600 text-lg">جاري تحميل نظام البيع...</p>
        </div>
      </div>
    );
  }

  // ======= JSX (نفس الـ UI القديم بالظبط بدون أي تغيير) =======
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
                (t.id === activeTabId
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200')
              }
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
                role="button"
              >✕</span>
            </button>
          ))}
          <button
            onClick={handleCreateNewTab}
            className="px-3 py-1 rounded-full border border-dashed border-gray-300 text-gray-700 hover:bg-gray-50 whitespace-nowrap"
          >
            + عملية جديدة
          </button>
        </div>
      </div>

      {/* Products Section */}
      <div className="flex-1 p-6 overflow-y-auto">
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
              onClick={() => fetchProducts(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="تحديث المخزون"
            >
              <i className="fas fa-sync-alt"></i>
            </button>
            <Link
              to="/pos/barcode"
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
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
              <i className="fas fa-th ml-1"></i>الكل
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
          {productsLoading ? (
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
                    product.stock < 10  ? 'text-red-600'    :
                    product.stock < 30  ? 'text-orange-500' :
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

      {/* Cart Section - نفس الكود القديم بالظبط */}
      <div className="w-96 bg-white shadow-lg p-6 flex flex-col">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">
          <i className="fas fa-shopping-cart ml-2"></i>سلة المشتريات
        </h2>
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
                          <i className="fas fa-check ml-1"></i>جديد
                        </span>
                      )}
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-600 hover:text-red-700">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 bg-gray-200 rounded hover:bg-gray-300">-</button>
                      <span className="w-12 text-center font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 bg-gray-200 rounded hover:bg-gray-300">+</button>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-gray-600">{item.price} ر.س</p>
                      <p className="font-bold text-blue-600">{(item.price * item.quantity).toFixed(2)} ر.س</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-sm text-gray-600">الخصم %</label>
                <input type="number" min="0" max="100" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="input-field" />
              </div>
              <div className="flex-1">
                <label className="text-sm text-gray-600">الضريبة %</label>
                <input type="number" min="0" max="100" value={tax} onChange={(e) => setTax(Number(e.target.value))} className="input-field" />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-2">
                <i className="fas fa-user ml-1"></i>العميل ({customers.length} متاح)
              </label>
              <select
                value={customer || ''}
                onChange={(e) => setCustomer(e.target.value || null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-right"
              >
                <option value="">بدون عميل (زائر)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
                ))}
              </select>
              {customer && <p className="text-xs text-green-600 mt-1">✓ تم اختيار العميل</p>}
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-2">طريقة الدفع</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input-field">
                <option value="cash">نقدي</option>
                <option value="card">بطاقة</option>
                <option value="both">نقدي + بطاقة</option>
              </select>
            </div>
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
                  <span>+{(((getSubtotal() - (getSubtotal() * discount) / 100) * tax) / 100).toFixed(2)} ر.س</span>
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
                    return (paid - getTotal()) >= 0 ? 'text-green-700' : 'text-red-700';
                  })()}`}>
                    {(() => {
                      const paid = parseFloat(paidAmount || '0') || 0;
                      const diff = paid - getTotal();
                      return `${diff >= 0 ? 'باقي' : 'متبقي'}: ${Math.abs(diff).toFixed(2)} ر.س`;
                    })()}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <button onClick={handleCheckout} className="w-full btn-success py-3 text-lg">
                <i className="fas fa-check-circle ml-2"></i>إتمام عملية البيع
              </button>
              <button onClick={closeOrResetCurrentTab} className="w-full btn-danger">
                <i className="fas fa-times-circle ml-2"></i>إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default POS;
