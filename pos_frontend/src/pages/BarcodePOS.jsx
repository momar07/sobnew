import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { productsAPI, salesAPI } from '../services/api';

// Barcode-first POS screen (scanner / keyboard-wedge friendly)
// Simplified version WITHOUT customer search
export default function BarcodePOS() {
  // ---------- Helpers ----------
  const decodeJwtPayload = (token) => {
    try {
      const part = token.split('.')[1];
      const padded = part.replace(/-/g, '+').replace(/_/g, '/');
      const jsonStr = decodeURIComponent(
        atob(padded)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  };

  const getCashierId = () => {
    const token = localStorage.getItem('access_token');
    const p = token ? decodeJwtPayload(token) : null;
    return p?.user_id || p?.sub || p?.username || 'guest';
  };

  const sanitizeBarcode = (code) => String(code || '').replace(/[^0-9]/g, '').trim();

  const todayKey = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const cashierId = useMemo(() => String(getCashierId()), []);

  // ---------- Storage Keys ----------
  const POS_STATE_KEY = useMemo(() => `pos_state_${cashierId}_${todayKey}`, [cashierId, todayKey]);
  const SUSPENDED_KEY = useMemo(() => `pos_suspended_${cashierId}_${todayKey}`, [cashierId, todayKey]);
  const PENDING_SALES_KEY = useMemo(() => `pos_pending_sales_${cashierId}_${todayKey}`, [cashierId, todayKey]);

  // ---------- Toast System ----------
  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(1);
  const soundOk = useRef(null);
  const soundAlert = useRef(null);

  useEffect(() => {
    soundOk.current = new Audio('/sounds/beep.wav');
    soundAlert.current = new Audio('/sounds/alert.wav');
  }, []);

  const playOk = useCallback(() => soundOk.current?.play?.().catch(() => {}), []);
  const playAlert = useCallback(() => soundAlert.current?.play?.().catch(() => {}), []);

  const playSound = useCallback((type) => {
    if (type === 'error') playAlert();
    else if (type === 'success') playOk();
    else if (type === 'warning') playAlert();
  }, [playAlert, playOk]);

  const pushToast = useCallback((type, text, opts = {}) => {
    const id = toastSeq.current++;
    const dismissible = !!opts.dismissible;
    const duration = opts.duration ?? (type === 'error' ? 5000 : type === 'warning' ? 4000 : 3000);

    setToasts((prev) => [...prev, { id, type, text, dismissible }]);

    if (type === 'success') playOk();
    if (type === 'error') playAlert();

    if (duration) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, [playAlert, playOk]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ---------- Focus lock ----------
  const [lockScanner, setLockScanner] = useState(true);
  const barcodeRef = useRef(null);
  const paidRef = useRef(null);

  // ---------- Tabs (multiple carts) ----------
  const [tabs, setTabs] = useState([{ id: 1, name: 'عملية 1', cart: [] }]);
  const [activeTabId, setActiveTabId] = useState(1);
  const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);
  const cart = activeTab?.cart || [];

  const setCartForActiveTab = useCallback((newCartOrUpdater) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId) return t;
        const nextCart = typeof newCartOrUpdater === 'function' ? newCartOrUpdater(t.cart) : newCartOrUpdater;
        return { ...t, cart: nextCart };
      })
    );
  }, [activeTabId]);

  const createNewTab = useCallback(() => {
    setTabs((prev) => {
      const nextId = Math.max(...prev.map((t) => t.id), 0) + 1;
      return [...prev, { id: nextId, name: `عملية ${nextId}`, cart: [] }];
    });
    setActiveTabId((prevId) => {
      const max = Math.max(...tabs.map((t) => t.id));
      return max + 1;
    });
  }, [tabs]);

  const closeTab = useCallback((tabId) => {
    setTabs((prev) => {
      if (prev.length === 1) return [{ ...prev[0], cart: [] }];
      const newTabs = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) setActiveTabId(newTabs[0].id);
      return newTabs;
    });
  }, [activeTabId]);

  // ---------- Cart helpers ----------
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [note, setNote] = useState('');

  const [lastAddedItemId, setLastAddedItemId] = useState(null);
  const lastItemRef = useRef(null);

  const scrollToLastItem = useCallback(() => {
    lastItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const getSubtotal = useCallback(() => {
    return cart.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
  }, [cart]);

  const getTotal = useCallback(() => {
    const subtotal = getSubtotal();
    const discountAmount = (subtotal * Number(discount || 0)) / 100;
    const taxAmount = ((subtotal - discountAmount) * Number(tax || 0)) / 100;
    return subtotal - discountAmount + taxAmount;
  }, [getSubtotal, discount, tax]);

  const getChange = useCallback(() => {
    return paidAmount ? (Number(paidAmount) - getTotal()).toFixed(2) : '0.00';
  }, [paidAmount, getTotal]);

  // ---------- Product cache (memory + IndexedDB) ----------
  const memCache = useRef(new Map());
  const idb = useRef(null);

  const idbOpen = () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open('pos_cache_v1', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'barcode' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  const idbGet = async (barcode) => {
    try {
      if (!idb.current) idb.current = await idbOpen();
      return await new Promise((resolve) => {
        const tx = idb.current.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const r = store.get(barcode);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  };

  const idbSet = async (barcode, product) => {
    try {
      if (!idb.current) idb.current = await idbOpen();
      await new Promise((resolve) => {
        const tx = idb.current.transaction('products', 'readwrite');
        tx.objectStore('products').put({ ...product, barcode });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch {
      // ignore
    }
  };

  // ---------- Barcode input ----------
  const [barcode, setBarcode] = useState('');
  const [manualQuery, setManualQuery] = useState('');
  const [manualResults, setManualResults] = useState([]);
  const [manualLoading, setManualLoading] = useState(false);

  const validateBarcode = useCallback((code) => {
    const clean = sanitizeBarcode(code);
    if (!clean) return '❌ الباركود فارغ';
    if (clean.length < 8 || clean.length > 14) return '❌ طول الباركود يجب أن يكون بين 8 و 14 رقم';
    return null;
  }, []);

  const validateSale = useCallback(() => {
    if (cart.length === 0) {
      pushToast('warning', '⚠️ السلة فارغة', { duration: 3000 });
      return false;
    }

    const insufficientStock = cart.find((i) =>
      typeof i.stock === 'number' &&
      i.stock >= 0 &&
      Number(i.quantity) > i.stock
    );
    if (insufficientStock) {
      pushToast('error', `❌ المخزون غير كافٍ: ${insufficientStock.name} (المتاح: ${insufficientStock.stock})`, {
        duration: 5000,
        dismissible: true,
      });
      playSound('error');
      return false;
    }

    if (paymentMethod === 'cash' && Number(paidAmount || 0) < getTotal()) {
      const missing = (getTotal() - Number(paidAmount || 0)).toFixed(2);
      pushToast('warning', `⚠️ المبلغ المدفوع أقل من الإجمالي بـ ${missing}`, { duration: 4000, dismissible: true });
      return false;
    }

    return true;
  }, [cart, paymentMethod, paidAmount, getTotal, pushToast, playSound]);

  const addToCart = useCallback(
    (product, scannedBarcode) => {
      setCartForActiveTab((prev) => {
        const exists = prev.find((i) => i.id === product.id);
        const currentQty = exists ? Number(exists.quantity || 0) : 0;
        const stock = typeof product.stock === 'number' ? product.stock : typeof exists?.stock === 'number' ? exists.stock : null;

        if (typeof stock === 'number' && stock >= 0 && currentQty + 1 > stock) {
          pushToast('error', `❌ المخزون غير كافٍ (${stock})`, { duration: 5000, dismissible: true });
          playSound('error');
          return prev;
        }

        if (exists) {
          return prev.map((i) =>
            i.id === product.id ? { ...i, quantity: Math.min(99, currentQty + 1), stock: stock ?? i.stock } : i
          );
        }

        return [
          ...prev,
          {
            id: product.id,
            name: product.name,
            barcode: scannedBarcode || product.barcode,
            price: Number(product.price),
            quantity: 1,
            stock: stock,
          },
        ];
      });

      setLastAddedItemId(product.id);
      setTimeout(scrollToLastItem, 50);

      if (typeof product.stock === 'number' && product.stock <= 10) {
        pushToast('warning', '⚠️ المخزون منخفض', { duration: 4000 });
      } else {
        pushToast('success', '✅ تمت إضافة المنتج بنجاح', { duration: 3000 });
      }

      if (lockScanner) setTimeout(() => barcodeRef.current?.focus?.(), 60);
    },
    [setCartForActiveTab, scrollToLastItem, lockScanner, pushToast, playSound]
  );

  const fetchByBarcodeCached = useCallback(async (code) => {
    if (memCache.current.has(code)) return memCache.current.get(code);

    const cached = await idbGet(code);
    if (cached) {
      memCache.current.set(code, cached);
      return cached;
    }

    const res = await productsAPI.getByBarcode(code);
    const product = res.data;
    memCache.current.set(code, product);
    idbSet(code, product);
    return product;
  }, []);

  const handleScanEnter = useCallback(async () => {
    const code = sanitizeBarcode(barcode);
    const err = validateBarcode(code);
    if (err) {
      pushToast('error', err, { duration: 5000, dismissible: true });
      setBarcode('');
      if (lockScanner) setTimeout(() => barcodeRef.current?.focus?.(), 80);
      return;
    }

    try {
      const product = await fetchByBarcodeCached(code);
      addToCart(product, code);
      setBarcode('');
    } catch (e) {
      console.error('Barcode scan error:', e);
      pushToast('error', '❌ المنتج غير موجود', { duration: 5000, dismissible: true });
      setBarcode('');
      if (lockScanner) setTimeout(() => barcodeRef.current?.focus?.(), 80);
    }
  }, [barcode, validateBarcode, lockScanner, fetchByBarcodeCached, addToCart, pushToast]);

  const removeFromCart = useCallback((productId) => {
    setCartForActiveTab((prev) => prev.filter((i) => i.id !== productId));
  }, [setCartForActiveTab]);

  const updateQuantity = useCallback(
    (productId, newQuantity) => {
      const qty = Math.max(1, Math.min(99, parseInt(newQuantity) || 1));
      setCartForActiveTab((prev) =>
        prev.map((i) => (i.id === productId ? { ...i, quantity: qty } : i))
      );
    },
    [setCartForActiveTab]
  );

  const clearActiveCart = useCallback(() => {
    setCartForActiveTab([]);
    pushToast('info', 'ℹ️ تم تفريغ السلة', { duration: 3000 });
    if (lockScanner) setTimeout(() => barcodeRef.current?.focus?.(), 80);
  }, [setCartForActiveTab, lockScanner, pushToast]);

  // ---------- Invoice generation ----------
  const generateInvoiceNumber = useCallback(() => {
    const date = new Date();
    const timestamp = date.getTime().toString().slice(-6);
    const cashierCode = String(cashierId).slice(-3).padStart(3, '0');
    return `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${cashierCode}-${timestamp}`;
  }, [cashierId]);

  // ---------- Receipt printing ----------
  const printReceipt = useCallback((saleData) => {
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>فاتورة</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; width: 80mm; margin: 0; }
          .receipt { padding: 10mm; }
          h2 { text-align: center; margin: 5mm 0; font-size: 16px; }
          p { text-align: center; margin: 2mm 0; font-size: 11px; }
          table { width: 100%; margin: 5mm 0; font-size: 11px; border-collapse: collapse; }
          th { padding: 3mm; border-bottom: 2px solid #000; text-align: right; font-weight: bold; }
          td { padding: 2mm; border-bottom: 1px dotted #000; text-align: right; }
          .divider { border-bottom: 2px solid #000; margin: 3mm 0; }
          .total-row { font-weight: bold; font-size: 13px; margin: 3mm 0; padding: 3mm 0; text-align: right; }
          .footer { text-align: center; font-size: 10px; color: #666; margin-top: 10mm; }
          @media print { body { width: 100%; } }
        </style>
      </head>
      <body>
        <div class="receipt">
          <h2>🧾 الفاتورة</h2>
          <p><strong>#${saleData.invoice_number}</strong></p>
          <p>${new Date().toLocaleString('ar-EG')}</p>
          <p>كاشير: ${saleData.cashier_id || 'guest'}</p>
          
          <div class="divider"></div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 40%;">المنتج</th>
                <th style="width: 15%;">السعر</th>
                <th style="width: 15%;">الكمية</th>
                <th style="width: 30%;">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${saleData.items
                .map(
                  (i) => `
                <tr>
                  <td>${i.product_name}</td>
                  <td>${Number(i.price).toFixed(2)}</td>
                  <td>${i.quantity}</td>
                  <td>${(Number(i.quantity) * Number(i.price)).toFixed(2)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
          
          <div class="divider"></div>
          
          <div class="total-row">الإجمالي قبل الضريبة: ${saleData.subtotal}</div>
          ${Number(saleData.discount) > 0 ? `<div class="total-row">الخصم: -${saleData.discount}</div>` : ''}
          ${Number(saleData.tax) > 0 ? `<div class="total-row">الضريبة: +${saleData.tax}</div>` : ''}
          <div class="total-row" style="font-size: 16px; margin: 5mm 0;">الإجمالي النهائي: ${saleData.total}</div>
          
          ${saleData.payment_method === 'cash' && saleData.paid_amount ? `
            <div class="total-row">المبلغ المدفوع: ${saleData.paid_amount}</div>
            <div class="total-row" style="color: green;">الباقي: ${(Number(saleData.paid_amount) - Number(saleData.total)).toFixed(2)}</div>
          ` : ''}
          
          ${saleData.note ? `<div class="total-row">ملاحظات: ${saleData.note}</div>` : ''}
          
          <div class="footer">
            <p>شكراً لك على تعاملك معنا!</p>
            <p>تاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const win = window.open('', 'PRINT', 'height=600,width=800');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 100);
  }, []);

  // ---------- Suspend invoices ----------
  const [suspendedOpen, setSuspendedOpen] = useState(false);
  const [suspendedList, setSuspendedList] = useState([]);

  const loadSuspended = useCallback(() => {
    try {
      const raw = localStorage.getItem(SUSPENDED_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      setSuspendedList(Array.isArray(arr) ? arr : []);
    } catch {
      setSuspendedList([]);
    }
  }, [SUSPENDED_KEY]);

  const saveSuspended = useCallback(
    (arr) => {
      try {
        localStorage.setItem(SUSPENDED_KEY, JSON.stringify(arr));
        setSuspendedList(arr);
      } catch {
        // ignore
      }
    },
    [SUSPENDED_KEY]
  );

  const suspendActiveInvoice = useCallback(() => {
    if (cart.length === 0) {
      pushToast('warning', '⚠️ لا يمكن تعليق فاتورة فارغة', { duration: 3000 });
      return;
    }
    const sid = Date.now();
    const snapshot = {
      tab: activeTab,
      discount,
      tax,
      paymentMethod,
      paidAmount,
      note,
    };
    const next = [
      { sid, title: activeTab?.name || 'فاتورة', savedAt: new Date().toISOString(), snapshot },
      ...suspendedList,
    ].slice(0, 50);

    saveSuspended(next);
    pushToast('info', `ℹ️ تم حفظ الفاتورة #${sid}`, { duration: 3000 });

    setCartForActiveTab([]);
    setPaidAmount('');
    setNote('');
    createNewTab();
    if (lockScanner) setTimeout(() => barcodeRef.current?.focus?.(), 120);
  }, [cart, activeTab, discount, tax, paymentMethod, paidAmount, note, suspendedList, saveSuspended, setCartForActiveTab, createNewTab, lockScanner, pushToast]);

  const restoreSuspended = useCallback(
    (sid) => {
      const item = suspendedList.find((x) => x.sid === sid);
      if (!item) return;

      const restored = item.snapshot;
      const newTabId = Date.now();
      setTabs((prev) => [...prev, { id: newTabId, name: `${restored.tab?.name || 'عملية'} (مسترجعة)`, cart: restored.tab?.cart || [] }]);
      setActiveTabId(newTabId);

      setDiscount(Number(restored.discount || 0));
      setTax(Number(restored.tax || 0));
      setPaymentMethod(restored.paymentMethod || 'cash');
      setPaidAmount(restored.paidAmount || '');
      setNote(restored.note || '');

      const next = suspendedList.filter((x) => x.sid !== sid);
      saveSuspended(next);
      setSuspendedOpen(false);
      pushToast('success', '✅ تم استرجاع الفاتورة', { duration: 3000 });
      if (lockScanner) setTimeout(() => barcodeRef.current?.focus?.(), 120);
    },
    [suspendedList, saveSuspended, lockScanner, pushToast]
  );

  const deleteSuspended = useCallback(
    (sid) => {
      const next = suspendedList.filter((x) => x.sid !== sid);
      saveSuspended(next);
      pushToast('info', 'ℹ️ تم حذف الفاتورة المعلقة', { duration: 2500 });
    },
    [suspendedList, saveSuspended, pushToast]
  );

  // ---------- Offline sales queue + sync ----------
  const loadPendingSales = useCallback(() => {
    try {
      const raw = localStorage.getItem(PENDING_SALES_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, [PENDING_SALES_KEY]);

  const savePendingSales = useCallback(
    (arr) => {
      try {
        localStorage.setItem(PENDING_SALES_KEY, JSON.stringify(arr));
      } catch {
        // ignore
      }
    },
    [PENDING_SALES_KEY]
  );

  const queueSaleOffline = useCallback(
    (salePayload) => {
      const pending = loadPendingSales();
      const id = Date.now();
      const next = [{ id, payload: salePayload, queuedAt: new Date().toISOString() }, ...pending].slice(0, 200);
      savePendingSales(next);
      pushToast('info', `ℹ️ تم حفظ عملية للبيع Offline #${id}`, { duration: 3000 });
    },
    [loadPendingSales, savePendingSales, pushToast]
  );

  const syncPendingSales = useCallback(async () => {
    const pending = loadPendingSales();
    if (!pending.length) return;

    const ordered = [...pending].reverse();
    const keep = [];
    for (const it of ordered) {
      try {
        await salesAPI.create(it.payload);
      } catch {
        keep.push(it);
      }
    }
    const remaining = keep.reverse();
    savePendingSales(remaining);

    const sentCount = pending.length - remaining.length;
    if (sentCount > 0) pushToast('success', `✅ تمت مزامنة ${sentCount} عملية`, { duration: 3000 });
  }, [loadPendingSales, savePendingSales, pushToast]);

  useEffect(() => {
    const onOnline = () => {
      pushToast('info', 'ℹ️ تم استعادة الاتصال — جاري المزامنة...', { duration: 2500 });
      syncPendingSales();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [syncPendingSales, pushToast]);

  useEffect(() => {
    const t = setInterval(() => {
      if (navigator.onLine) syncPendingSales();
    }, 12000);
    return () => clearInterval(t);
  }, [syncPendingSales]);

  // ---------- Finalize sale ----------
  const finalizeSale = useCallback(async () => {
    if (!validateSale()) return;

    const subtotal = getSubtotal();
    const discountAmount = (subtotal * Number(discount || 0)) / 100;
    const taxAmount = ((subtotal - discountAmount) * Number(tax || 0)) / 100;
    const total = getTotal();
    const invoiceNumber = generateInvoiceNumber();

    const saleData = {
      invoice_number: invoiceNumber,
      subtotal: subtotal.toFixed(2),
      discount: discountAmount.toFixed(2),
      tax: taxAmount.toFixed(2),
      total: total.toFixed(2),
      payment_method: paymentMethod,
      status: 'completed',
      note: note || '',
      paid_amount: paidAmount || null,
      cashier_id: cashierId,
      items: cart.map((i) => ({
        product_id: i.id,
        product_name: i.name,
        quantity: i.quantity,
        price: i.price,
      })),
    };

    try {
      await salesAPI.create(saleData);
      pushToast('success', '✅ تم تسجيل العملية بنجاح', { duration: 3000 });
      
      // Print receipt
      setTimeout(() => printReceipt(saleData), 500);

      // Clear active
      setCartForActiveTab([]);
      setDiscount(0);
      setTax(0);
      setPaymentMethod('cash');
      setPaidAmount('');
      setNote('');
      if (lockScanner) setTimeout(() => barcodeRef.current?.focus?.(), 80);

      // Clear persisted state
      try {
        const st = JSON.parse(localStorage.getItem(POS_STATE_KEY) || '{}');
        if (st?.tabs) {
          st.tabs = st.tabs.map((t) => (t.id === activeTabId ? { ...t, cart: [] } : t));
          localStorage.setItem(POS_STATE_KEY, JSON.stringify(st));
        }
      } catch {}
    } catch (e) {
      console.error('Sale error:', e);
      // offline fallback
      queueSaleOffline(saleData);
      
      pushToast('info', '⚠️ تم حفظ العملية offline - سيتم المزامنة عند عودة الاتصال', { duration: 4000 });
      
      // Clear cart locally
      setCartForActiveTab([]);
      setPaidAmount('');
      setNote('');
      if (lockScanner) setTimeout(() => barcodeRef.current?.focus?.(), 80);
    }
  }, [
    validateSale,
    getSubtotal,
    discount,
    tax,
    getTotal,
    paymentMethod,
    note,
    cashierId,
    cart,
    generateInvoiceNumber,
    queueSaleOffline,
    setCartForActiveTab,
    lockScanner,
    activeTabId,
    POS_STATE_KEY,
    pushToast,
    printReceipt,
  ]);

  // ---------- Manual search (products) ----------
  useEffect(() => {
    const q = manualQuery.trim();
    if (!q) {
      setManualResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setManualLoading(true);
      try {
        const res = await productsAPI.getAll({ search: q, page_size: 10 });
        const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setManualResults(arr);
      } catch {
        setManualResults([]);
      } finally {
        setManualLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [manualQuery]);

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    const onKeyDown = (e) => {
      // F2 toggle focus lock
      if (e.key === 'F2') {
        e.preventDefault();
        setLockScanner((v) => {
          const next = !v;
          pushToast('info', next ? 'ℹ️ قفل التركيز على الباركود: ON' : 'ℹ️ قفل التركيز: OFF', { duration: 2000 });
          if (next) setTimeout(() => barcodeRef.current?.focus?.(), 80);
          return next;
        });
        return;
      }

      // F4 finalize
      if (e.key === 'F4' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        finalizeSale();
        return;
      }

      // Delete removes last item
      if (e.key === 'Delete') {
        if (cart.length > 0) {
          const last = cart[cart.length - 1];
          removeFromCart(last.id);
          pushToast('info', 'ℹ️ تم حذف آخر سطر', { duration: 2000 });
        }
      }

      // Ctrl+Z undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (cart.length > 0) {
          const last = cart[cart.length - 1];
          removeFromCart(last.id);
          pushToast('info', 'ℹ️ تم التراجع عن آخر إضافة', { duration: 2000 });
        }
      }

      // Escape clears current field
      if (e.key === 'Escape') {
        const el = document.activeElement;
        if (el === barcodeRef.current) setBarcode('');
        if (el === paidRef.current) setPaidAmount('');
      }

      // Enter behavior
      if (e.key === 'Enter') {
        const el = document.activeElement;
        if (el === barcodeRef.current) {
          e.preventDefault();
          handleScanEnter();
          return;
        }
        if (el === paidRef.current) {
          e.preventDefault();
          finalizeSale();
          return;
        }
      }

      // Tab navigation (when lockScanner is ON)
      if (e.key === 'Tab' && lockScanner) {
        const el = document.activeElement;
        if (el === barcodeRef.current) {
          e.preventDefault();
          paidRef.current?.focus?.();
          return;
        }
        if (el === paidRef.current) {
          e.preventDefault();
          barcodeRef.current?.focus?.();
          return;
        }
      }

      // Shift+Tab back navigation
      if (e.key === 'Tab' && e.shiftKey && lockScanner) {
        e.preventDefault();
        const el = document.activeElement;
        if (el === paidRef.current) {
          barcodeRef.current?.focus?.();
        } else if (el === barcodeRef.current) {
          paidRef.current?.focus?.();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cart, lockScanner, barcode, paidAmount, handleScanEnter, finalizeSale, removeFromCart, pushToast]);

  // ---------- Persistence (tabs + form) ----------
  const saveTimer = useRef(null);

  const saveStateNow = useCallback(() => {
    try {
      const payload = {
        tabs,
        activeTabId,
        discount,
        tax,
        paymentMethod,
        paidAmount,
        note,
        savedAt: Date.now(),
      };
      localStorage.setItem(POS_STATE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [tabs, activeTabId, discount, tax, paymentMethod, paidAmount, note, POS_STATE_KEY]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) return;
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveStateNow();
    }, 5000);
  }, [saveStateNow]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(POS_STATE_KEY);
      if (raw) {
        const st = JSON.parse(raw);
        if (Array.isArray(st?.tabs) && st.tabs.length) setTabs(st.tabs);
        if (st?.activeTabId) setActiveTabId(st.activeTabId);
        if (st?.discount !== undefined) setDiscount(Number(st.discount || 0));
        if (st?.tax !== undefined) setTax(Number(st.tax || 0));
        if (st?.paymentMethod) setPaymentMethod(st.paymentMethod);
        if (st?.paidAmount !== undefined) setPaidAmount(st.paidAmount || '');
        if (st?.note !== undefined) setNote(st.note || '');
      }
    } catch {
      // ignore
    }
    loadSuspended();
    setTimeout(() => barcodeRef.current?.focus?.(), 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scheduleSave();
    const onUnload = () => saveStateNow();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [tabs, activeTabId, discount, tax, paymentMethod, paidAmount, note, scheduleSave, saveStateNow]);

  // ---------- RENDER ----------
  const subtotal = getSubtotal();
  const discountAmount = (subtotal * Number(discount || 0)) / 100;
  const taxAmount = ((subtotal - discountAmount) * Number(tax || 0)) / 100;
  const total = getTotal();
  const change = getChange();
  const pendingSalesCount = loadPendingSales().length;

  return (
    <div dir="rtl" lang="ar" className="barcode-page">
      <style>{`
        :root{
          --bg:#f4f6f9;
          --card:#ffffff;
          --text:#0f172a;
          --muted:#64748b;
          --line:#e5e7eb;
          --primary:#2563eb;
          --primary-2:#1d4ed8;
          --danger:#dc2626;
          --success:#16a34a;
          --warning:#f59e0b;
          --shadow: 0 10px 30px rgba(2,6,23,.08);
          --radius:14px;
          --radius-sm:10px;
          --font: system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Kufi Arabic", "Noto Sans Arabic", sans-serif;
        }
        .barcode-page *{box-sizing:border-box}
        .barcode-page{min-height:100vh;background:var(--bg);color:var(--text);font-family:var(--font);padding:22px 16px 26px}
        .page-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px;flex-wrap:wrap}
        .title{display:flex;align-items:center;gap:10px}
        .title h1{margin:0;font-size:22px;font-weight:800;letter-spacing:.2px}
        .title .sub{color:var(--muted);font-size:13px;margin-top:3px}
        .badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;background:#eff6ff;color:var(--primary);border:1px solid #dbeafe;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
        .head-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-start}
        .btn{border:1px solid var(--line);background:var(--card);color:var(--text);padding:10px 12px;border-radius:12px;font-weight:700;font-size:13px;cursor:pointer;transition:.15s}
        .btn:hover{transform:translateY(-1px)}
        .btn.primary{background:var(--primary);border-color:var(--primary);color:#fff}
        .btn.primary:hover{background:var(--primary-2)}
        .btn.danger{background:#fef2f2;border-color:#fecaca;color:var(--danger)}
        .btn.warning{background:#fffbeb;border-color:#fde68a;color:#92400e}
        .btn.success{background:#ecfdf5;border-color:#bbf7d0;color:var(--success)}
        .btn.ghost{background:transparent}
        .grid{display:grid;grid-template-columns:1.55fr .95fr;gap:14px}
        @media (max-width:1020px){.grid{grid-template-columns:1fr}}
        .card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden}
        .hd{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}
        .hd h2{margin:0;font-size:16px;font-weight:900}
        .hint{color:var(--muted);font-size:13px}
        .bd{padding:16px}
        .tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
        .tab{display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 10px;font-weight:900;font-size:12px;cursor:pointer;transition:.2s}
        .tab:hover{background:#f8fafc}
        .tab.active{border-color:#bfdbfe;background:#eff6ff;color:#1d4ed8}
        .tab .x{border:0;background:transparent;cursor:pointer;font-weight:900;color:inherit;opacity:.6;transition:.2s}
        .tab .x:hover{opacity:1}
        .scan-row{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap}
        .field{flex:1;min-width:260px}
        .field label{display:block;font-size:12px;color:var(--muted);margin-bottom:6px;font-weight:700}
        .input{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:#fff;display:flex;align-items:center;gap:10px;transition:.2s}
        .input:focus-within{border-color:var(--primary);box-shadow:0 0 0 3px rgba(37,99,235,.12)}
        .input input{border:0;outline:0;font-size:14px;width:100%;background:transparent}
        .field.select select{width:100%;border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-weight:700;outline:0;background:#fff;transition:.2s}
        .field.select select:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(37,99,235,.12)}
        .focus-pill{margin-top:8px;font-size:12px;font-weight:800;color:#0b3b8f;background:#eff6ff;border:1px solid #dbeafe;border-radius:999px;padding:8px 10px;display:inline-flex;gap:6px;align-items:center}
        table{width:100%;border-collapse:collapse;font-size:13px}
        thead th{text-align:right;color:var(--muted);font-size:12px;font-weight:900;padding:10px 8px;border-bottom:1px solid var(--line)}
        tbody td{padding:12px 8px;border-bottom:1px dashed var(--line);vertical-align:top}
        tbody tr:hover{background:#f8fafc}
        .muted{color:var(--muted);font-size:12px}
        .qty-control{display:flex;align-items:center;gap:6px;background:#f8fafc;padding:4px;border-radius:8px;width:fit-content}
        .qty-btn{width:28px;height:28px;border:1px solid var(--line);background:#fff;border-radius:6px;cursor:pointer;font-weight:900;color:var(--primary);transition:.2s;display:flex;align-items:center;justify-content:center}
        .qty-btn:hover{background:var(--primary);color:#fff}
        .qty-input{width:40px;text-align:center;border:1px solid var(--line);border-radius:6px;padding:4px;font-weight:900}
        .row-actions{display:flex;gap:8px;justify-content:flex-start}
        .icon-btn{border:1px solid var(--line);background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;font-weight:900;transition:.2s}
        .icon-btn:hover{background:#f8fafc;transform:scale(1.05)}
        .icon-btn.danger{background:#fef2f2;border-color:#fecaca;color:var(--danger)}
        .icon-btn.danger:hover{background:#ffcdd2}
        .totals{display:flex;flex-direction:column;gap:10px}
        .tot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff}
        .tot .k{color:var(--muted);font-size:12px;font-weight:900}
        .tot .v{font-weight:900;font-size:14px}
        .tot.big{background:#eff6ff;border-color:#bfdbfe}
        .tot.big .v{font-size:18px;color:var(--primary)}
        .tot.warning{background:#fffbeb;border-color:#fde68a}
        .tot.warning .v{color:#92400e}
        .tot.success{background:#ecfdf5;border-color:#bbf7d0}
        .tot.success .v{color:var(--success)}
        .tot.danger{background:#fef2f2;border-color:#fecaca}
        .tot.danger .v{color:var(--danger)}
        .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        @media (max-width:540px){.two{grid-template-columns:1fr}}
        .kbd{display:inline-flex;align-items:center;justify-content:center;min-width:34px;padding:2px 8px;border:1px solid var(--line);border-radius:8px;background:#fff;font-weight:900;margin:0 4px;font-size:11px}
        /* Toasts */
        .toast-wrap{position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;gap:10px;z-index:9999;max-width:420px}
        .toast{border:1px solid var(--line);background:#fff;border-radius:14px;padding:12px 14px;box-shadow:var(--shadow);font-weight:900;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;font-size:13px;animation:slideIn .3s ease}
        @keyframes slideIn{from{transform:translateX(420px);opacity:0}to{transform:translateX(0);opacity:1}}
        .toast.success{border-color:#bbf7d0;background:#ecfdf5;color:var(--success)}
        .toast.error{border-color:#fecaca;background:#fef2f2;color:var(--danger)}
        .toast.warning{border-color:#fde68a;background:#fffbeb;color:#92400e}
        .toast.info{border-color:#dbeafe;background:#eff6ff;color:#1d4ed8}
        .toast .close{border:0;background:transparent;cursor:pointer;font-weight:900;color:inherit;opacity:.6;transition:.2s}
        .toast .close:hover{opacity:1}
        /* Modal */
        .modal-backdrop{position:fixed;inset:0;background:rgba(2,6,23,.45);z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn .2s ease}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .modal{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);width:min(860px,100%);max-height:85vh;overflow:auto;animation:slideUp .3s ease}
        @keyframes slideUp{from{transform:translateY(100px);opacity:0}to{transform:translateY(0);opacity:1}}
        .modal .mh{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:10px}
        .modal .mb{padding:16px}
        .modal .mh h3{margin:0;font-size:16px;font-weight:900}
        .modal .list{display:flex;flex-direction:column;gap:10px}
        .s-item{border:1px solid var(--line);border-radius:14px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;transition:.2s}
        .s-item:hover{background:#f8fafc;border-color:var(--primary)}
        .s-item .meta{display:flex;flex-direction:column;gap:3px;flex:1}
        .s-item .meta .t{font-weight:900}
        .s-item .meta .d{color:var(--muted);font-size:12px}
        @media print{body{margin:0;padding:0}}
      `}</style>

      <div className="page-head">
        <div className="title">
          <div className="badge">🧾 Barcode POS</div>
          <div>
            <h1>نظام نقاط البيع</h1>
            <div className="sub">
              {lockScanner ? '🔒 قفل التركيز على الباركود (F2 لإلغاء)' : '🔓 تركيز حر (F2 لتفعيل القفل)'} — كاشير: {cashierId}
            </div>
          </div>
        </div>

        <div className="head-actions">
          <button className="btn ghost" onClick={() => window.location.reload()}>↻ تحديث</button>
          <button className="btn warning" onClick={suspendActiveInvoice}>⏸ تعليق فاتورة</button>
          <button className="btn" onClick={() => { loadSuspended(); setSuspendedOpen(true); }}>
            📂 معلقة ({suspendedList.length})
          </button>
          <button className="btn danger" onClick={clearActiveCart}>🗑 تفريغ</button>
          <button className="btn primary" onClick={createNewTab}>+ عملية</button>
          <button className={`btn ${pendingSalesCount > 0 ? 'warning' : ''}`} onClick={syncPendingSales}>
            🔄 Offline ({pendingSalesCount})
          </button>
        </div>
      </div>

      <div className="grid">
        {/* LEFT */}
        <section className="card">
          <div className="hd">
            <h2>العمليات</h2>
            <div className="hint">
              <span className="kbd">Enter</span> إضافة — <span className="kbd">Tab</span> للمدفوع — <span className="kbd">F4</span> إنهاء
            </div>
          </div>

          <div className="bd">
            <div className="tabs">
              {tabs.map((t) => (
                <div key={t.id} className={`tab ${t.id === activeTabId ? 'active' : ''}`} onClick={() => setActiveTabId(t.id)}>
                  {t.name}
                  <button className="x" onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}>×</button>
                </div>
              ))}
            </div>

            <div className="scan-row">
              <div className="field">
                <label>باركود المنتج</label>
                <div className="input">
                  <input
                    ref={barcodeRef}
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scan هنا... (مثال: 733739018397)"
                  />
                </div>
                <div className="focus-pill">
                  🔎 Enter للإضافة — Tab للمدفوع — F2 قفل/فتح
                </div>
              </div>

              <button className="btn primary" onClick={handleScanEnter}>إضافة</button>
            </div>

            <div style={{ height: 14 }} />

            <table>
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>المنتج</th>
                  <th style={{ width: '12%' }}>السعر</th>
                  <th style={{ width: '18%' }}>الكمية</th>
                  <th style={{ width: '18%' }}>الإجمالي</th>
                  <th style={{ width: '17%' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ color: 'var(--muted)', padding: 14, textAlign: 'center' }}>
                      لا توجد عناصر — امسح باركود لإضافة منتج
                    </td>
                  </tr>
                ) : (
                  cart.map((i) => (
                    <tr key={i.id} ref={i.id === lastAddedItemId ? lastItemRef : null}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ fontWeight: 900 }}>{i.name}</div>
                          <div className="muted">Barcode: {i.barcode}</div>
                          {typeof i.stock === 'number' && i.stock <= 10 ? (
                            <div className="muted" style={{ color: i.stock <= 0 ? 'var(--danger)' : '#92400e' }}>
                              {i.stock <= 0 ? '❌ نفذ المخزون' : `⚠️ منخفض: ${i.stock}`}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td>{Number(i.price).toFixed(2)}</td>
                      <td>
                        <div className="qty-control">
                          <button className="qty-btn" onClick={() => updateQuantity(i.id, i.quantity - 1)}>−</button>
                          <input
                            type="number"
                            className="qty-input"
                            value={i.quantity}
                            onChange={(e) => updateQuantity(i.id, e.target.value)}
                            min="1"
                            max="99"
                          />
                          <button className="qty-btn" onClick={() => updateQuantity(i.id, i.quantity + 1)}>+</button>
                        </div>
                      </td>
                      <td style={{ fontWeight: 900 }}>{(Number(i.price) * Number(i.quantity)).toFixed(2)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-btn danger" onClick={() => removeFromCart(i.id)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div style={{ height: 14 }} />

            <div className="card" style={{ boxShadow: 'none' }}>
              <div className="hd" style={{ borderBottom: 'none', padding: '0 0 10px' }}>
                <h2 style={{ fontSize: 15 }}>🔍 بحث سريع</h2>
                <div className="hint">ابحث باسم المنتج أو جزء من الباركود</div>
              </div>
              <div className="bd" style={{ padding: 0 }}>
                <div className="input">
                  <input
                    value={manualQuery}
                    onChange={(e) => setManualQuery(e.target.value)}
                    placeholder="ابحث باسم المنتج أو جزء من الباركود..."
                  />
                </div>

                <div style={{ height: 10 }} />
                {manualLoading ? (
                  <div className="muted">جاري البحث...</div>
                ) : manualResults.length === 0 ? (
                  <div className="muted">{manualQuery ? 'لا توجد نتائج' : 'ابدأ البحث...'}</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>المنتج</th>
                        <th>السعر</th>
                        <th>إضافة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualResults.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontWeight: 900 }}>{p.name}</div>
                            <div className="muted">Barcode: {p.barcode}</div>
                          </td>
                          <td>{Number(p.price).toFixed(2)}</td>
                          <td>
                            <button className="btn primary" style={{ fontSize: 12 }} onClick={() => addToCart(p, p.barcode)}>+ إضافة</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT */}
        <aside className="card">
          <div className="hd">
            <h2>💳 الدفع</h2>
            <div className="hint">أدخل المدفوع ثم Enter أو F4</div>
          </div>

          <div className="bd">
            <div className="totals">
              <div className="tot">
                <div className="k">الإجمالي قبل الضريبة</div>
                <div className="v">{subtotal.toFixed(2)}</div>
              </div>
              {Number(discount) > 0 && (
                <div className="tot warning">
                  <div className="k">خصم ({discount}%)</div>
                  <div className="v">-{discountAmount.toFixed(2)}</div>
                </div>
              )}
              {Number(tax) > 0 && (
                <div className="tot">
                  <div className="k">ضريبة ({tax}%)</div>
                  <div className="v">+{taxAmount.toFixed(2)}</div>
                </div>
              )}
              <div className="tot big">
                <div className="k">الإجمالي النهائي</div>
                <div className="v">{total.toFixed(2)}</div>
              </div>
              {paidAmount && (
                <div className={`tot ${Number(change) < 0 ? 'danger' : 'success'}`}>
                  <div className="k">الباقي</div>
                  <div className="v">{Number(change) < 0 ? `❌ ناقص ${Math.abs(change)}` : `✅ ${change}`}</div>
                </div>
              )}
            </div>

            <div style={{ height: 12 }} />

            <div className="two">
              <div className="field select">
                <label>طريقة الدفع</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="cash">💵 نقدي</option>
                  <option value="card">💳 بطاقة</option>
                  <option value="mixed">📊 مختلط</option>
                </select>
              </div>

              <div className="field">
                <label>المبلغ المدفوع</label>
                <div className="input">
                  <input
                    ref={paidRef}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="مثال: 400"
                    inputMode="decimal"
                  />
                </div>
              </div>
            </div>

            <div className="two">
              <div className="field">
                <label>خصم (%)</label>
                <div className="input">
                  <input
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    placeholder="0"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="field">
                <label>ضريبة (%)</label>
                <div className="input">
                  <input
                    value={tax}
                    onChange={(e) => setTax(Number(e.target.value))}
                    placeholder="0"
                    inputMode="numeric"
                  />
                </div>
              </div>
            </div>

            <div className="field">
              <label>ملاحظات (اختياري)</label>
              <div className="input">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="مثال: تم الدفع جزئياً / ملاحظة للفاتورة..."
                />
              </div>
            </div>

            <div style={{ height: 12 }} />

            <button className="btn success" style={{ width: '100%', padding: '12px 14px' }} onClick={finalizeSale}>
              ✅ إنهاء البيع (F4)
            </button>

            <div style={{ height: 10 }} />

            <div className="muted" style={{ textAlign: 'center' }}>
              عمليات معلقة: {suspendedList.length} | Offline: {pendingSalesCount}
            </div>
          </div>
        </aside>
      </div>

      {/* Suspended modal */}
      {suspendedOpen && (
        <div className="modal-backdrop" onMouseDown={() => setSuspendedOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mh">
              <h3>📂 الفواتير المعلقة</h3>
              <button className="btn" onClick={() => setSuspendedOpen(false)}>إغلاق</button>
            </div>
            <div className="mb">
              {suspendedList.length === 0 ? (
                <div className="muted">لا توجد فواتير معلقة</div>
              ) : (
                <div className="list">
                  {suspendedList.map((x) => (
                    <div key={x.sid} className="s-item">
                      <div className="meta">
                        <div className="t">{x.title} — #{x.sid}</div>
                        <div className="d">حُفظت: {new Date(x.savedAt).toLocaleString('ar-EG')}</div>
                        <div className="d">عدد الأصناف: {x.snapshot?.tab?.cart?.length || 0}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn primary" style={{ fontSize: 12 }} onClick={() => restoreSuspended(x.sid)}>استرجاع</button>
                        <button className="btn danger" style={{ fontSize: 12 }} onClick={() => deleteSuspended(x.sid)}>حذف</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast container */}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <div>{t.text}</div>
            {t.dismissible && <button className="close" onClick={() => dismissToast(t.id)}>×</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
