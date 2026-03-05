import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);

const genId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `tab_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
};

const makeTab = (index) => ({
  id: genId(),
  name: `عملية ${index}`,
  cart: [],
  customer: null,
  discount: 0, // نسبة %
  tax: 0,      // نسبة %
  paymentMethod: 'cash',
  paidAmount: '',
  lastAddedItemId: null,
});

const STORAGE_KEY_TABS = 'pos_tabs_v1';
const STORAGE_KEY_ACTIVE = 'pos_active_tab_v1';

const getCustomerLabel = (customer) => {
  if (!customer) return null;
  return customer.name || customer.full_name || customer.customer_name || customer.phone || customer.mobile || null;
};

const computeTabName = (tab, index) => {
  const label = getCustomerLabel(tab.customer);
  return label ? `${label} - عملية ${index}` : `عملية ${index}`;
};

const decorateTabs = (tabs) => {
  return (tabs || []).map((t, i) => {
    const id = t?.id || genId();
    const safeTab = {
      ...makeTab(i + 1),
      ...t,
      id,
    };
    return {
      ...safeTab,
      name: computeTabName(safeTab, i + 1),
    };
  });
};

export const CartProvider = ({ children }) => {
  // Tabs state
  const [tabs, setTabs] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TABS);
      if (!raw) return decorateTabs([makeTab(1)]);
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return decorateTabs([makeTab(1)]);
      return decorateTabs(parsed);
    } catch {
      return decorateTabs([makeTab(1)]);
    }
  });

  const [activeTabId, setActiveTabId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_ACTIVE) || null;
    } catch {
      return null;
    }
  });

  // Used to safely switch active tab after tabs state updates
  const [pendingActiveTabId, setPendingActiveTabId] = useState(null);

  // Ensure activeTabId is valid
  const activeTab = useMemo(() => {
    let tab = tabs.find(t => t.id === activeTabId);
    if (!tab) tab = tabs[0];
    return tab;
  }, [tabs, activeTabId]);

  const safeSetActiveTabId = (id) => {
    setActiveTabId(id);
  };

  useEffect(() => {
    if (!pendingActiveTabId) return;
    if (tabs.some(t => t.id === pendingActiveTabId)) {
      setActiveTabId(pendingActiveTabId);
      setPendingActiveTabId(null);
    }
  }, [pendingActiveTabId, tabs]);

  // Persist tabs + active tab to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(tabs));
      const idToSave = activeTabId || (tabs[0]?.id ?? '');
      if (idToSave) localStorage.setItem(STORAGE_KEY_ACTIVE, idToSave);
    } catch {
      // ignore
    }
  }, [tabs, activeTabId]);

  const createTab = ({ switchTo = true } = {}) => {
    setTabs(prev => {
      const next = decorateTabs([...prev, makeTab(prev.length + 1)]);
      const newTabId = next[next.length - 1].id;
      if (switchTo) setPendingActiveTabId(newTabId);
      return next;
    });
  };

  const closeTab = (tabId) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === tabId);
      if (idx === -1) return prev;

      const next = prev.filter(t => t.id !== tabId);

      // لو ما بقاش فيه تبويبات، اعمل واحد جديد
      if (next.length === 0) {
        const fresh = decorateTabs([makeTab(1)]);
        safeSetActiveTabId(fresh[0].id);
        return fresh;
      }

      // لو قفلنا التبويب الحالي، حوّل على اللي قبله أو بعده
      if (activeTabId === tabId) {
        const newIdx = Math.max(0, idx - 1);
        safeSetActiveTabId(next[Math.min(newIdx, next.length - 1)].id);
      }

      // إعادة توليد أسماء التبويبات (باسم العميل إن وجد)
      return decorateTabs(next);
    });
  };

  const updateActiveTab = (updater) => {
    setTabs(prev => {
      const next = prev.map(t => (t.id === activeTab.id ? updater(t) : t));
      return decorateTabs(next);
    });
  };

  // Cart operations (on active tab)
  const addToCart = (product) => {
    updateActiveTab(tab => {
      const existing = tab.cart.find(i => i.id === product.id);
      let nextCart;
      if (existing) {
        nextCart = tab.cart.map(i =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      } else {
        nextCart = [...tab.cart, { ...product, quantity: 1 }];
      }
      return { ...tab, cart: nextCart, lastAddedItemId: product.id };
    });

    // إزالة التحديد بعد 2 ثانية (بس على التبويب الحالي)
    setTimeout(() => {
      updateActiveTab(tab => ({ ...tab, lastAddedItemId: null }));
    }, 2000);
  };

  const removeFromCart = (productId) => {
    updateActiveTab(tab => ({ ...tab, cart: tab.cart.filter(i => i.id !== productId) }));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    updateActiveTab(tab => ({
      ...tab,
      cart: tab.cart.map(i => (i.id === productId ? { ...i, quantity } : i)),
    }));
  };

  const clearCart = () => {
    updateActiveTab(tab => ({
      ...tab,
      cart: [],
      customer: null,
      discount: 0,
      tax: 0,
      paymentMethod: 'cash',
      paidAmount: '',
      lastAddedItemId: null,
    }));
  };

  const setCustomer = (customer) => updateActiveTab(tab => ({ ...tab, customer }));
  const setDiscount = (discount) => updateActiveTab(tab => ({ ...tab, discount }));
  const setTax = (tax) => updateActiveTab(tab => ({ ...tab, tax }));
  const setPaymentMethod = (paymentMethod) => updateActiveTab(tab => ({ ...tab, paymentMethod }));
  const setPaidAmount = (paidAmount) => updateActiveTab(tab => ({ ...tab, paidAmount }));

  const getSubtotal = () => {
    return activeTab.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotal = () => {
    const subtotal = getSubtotal();
    const discountAmount = (subtotal * activeTab.discount) / 100;
    const taxAmount = ((subtotal - discountAmount) * activeTab.tax) / 100;
    return subtotal - discountAmount + taxAmount;
  };

  const getTotalItems = () => {
    return activeTab.cart.reduce((total, item) => total + item.quantity, 0);
  };

  const value = {
    // tabs
    tabs,
    activeTabId: activeTab.id,
    setActiveTabId: safeSetActiveTabId,
    createTab,
    closeTab,

    // active tab data
    cart: activeTab.cart,
    customer: activeTab.customer,
    discount: activeTab.discount,
    tax: activeTab.tax,
    paymentMethod: activeTab.paymentMethod,
    paidAmount: activeTab.paidAmount,
    lastAddedItemId: activeTab.lastAddedItemId,

    // ops
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setCustomer,
    setDiscount,
    setTax,
    setPaymentMethod,
    setPaidAmount,
    getSubtotal,
    getTotal,
    getTotalItems,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
