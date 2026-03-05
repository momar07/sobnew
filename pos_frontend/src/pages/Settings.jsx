import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const Settings = () => {
  // NOTE:
  // UI visibility is controlled by UI Builder (required_groups/required_permissions).
  // Inside the page we should NOT rely on any "fake" frontend permissions.
  // Allow Admins (group/superuser/staff) and otherwise fall back to real Django auth perms.
  const { isAdmin, hasAnyPermission } = useAuth();
  const { language, changeLanguage, t, isRTL } = useLanguage();
  
  // State للإعدادات
  const [storeSettings, setStoreSettings] = useState({
    name: 'متجري',
    phone: '0500000000',
    address: 'الرياض، المملكة العربية السعودية'
  });

  const [taxSettings, setTaxSettings] = useState({
    defaultTax: 15,
    maxDiscount: 50,
    autoTax: true
  });

  const [receiptSettings, setReceiptSettings] = useState({
    message: 'شكراً لتسوقكم معنا. نتمنى لكم يوماً سعيداً!',
    autoPrint: false,
    showBarcode: true
  });

  const [systemSettings, setSystemSettings] = useState({
    language: language || 'ar',
    currency: 'SAR',
    notifications: true
  });

  // تحميل الإعدادات من localStorage
  useEffect(() => {
    const savedStoreSettings = localStorage.getItem('storeSettings');
    const savedTaxSettings = localStorage.getItem('taxSettings');
    const savedReceiptSettings = localStorage.getItem('receiptSettings');
    const savedSystemSettings = localStorage.getItem('systemSettings');

    if (savedStoreSettings) setStoreSettings(JSON.parse(savedStoreSettings));
    if (savedTaxSettings) setTaxSettings(JSON.parse(savedTaxSettings));
    if (savedReceiptSettings) setReceiptSettings(JSON.parse(savedReceiptSettings));
    if (savedSystemSettings) {
      const settings = JSON.parse(savedSystemSettings);
      setSystemSettings(settings);
    }
  }, []);

  // حفظ إعدادات المتجر
  const handleSaveStore = () => {
    localStorage.setItem('storeSettings', JSON.stringify(storeSettings));
    alert(`✅ ${t.settings.saveSuccess}`);
  };

  // حفظ إعدادات الضريبة
  const handleSaveTax = () => {
    localStorage.setItem('taxSettings', JSON.stringify(taxSettings));
    alert(`✅ ${t.settings.saveSuccess}`);
  };

  // حفظ إعدادات الفاتورة
  const handleSaveReceipt = () => {
    localStorage.setItem('receiptSettings', JSON.stringify(receiptSettings));
    alert(`✅ ${t.settings.saveSuccess}`);
  };

  // حفظ إعدادات النظام
  const handleSaveSystem = () => {
    localStorage.setItem('systemSettings', JSON.stringify(systemSettings));
    // تغيير اللغة فعلياً
    changeLanguage(systemSettings.language);
    alert(`✅ ${t.settings.saveSuccess}`);
  };

  // تصدير البيانات
  const handleExportData = () => {
    const data = {
      storeSettings,
      taxSettings,
      receiptSettings,
      systemSettings,
      exportDate: new Date().toISOString()
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pos-settings-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    alert(`✅ ${t.settings.exportSuccess}`);
  };

  // استيراد البيانات
  const handleImportData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (data.storeSettings) {
          setStoreSettings(data.storeSettings);
          localStorage.setItem('storeSettings', JSON.stringify(data.storeSettings));
        }
        if (data.taxSettings) {
          setTaxSettings(data.taxSettings);
          localStorage.setItem('taxSettings', JSON.stringify(data.taxSettings));
        }
        if (data.receiptSettings) {
          setReceiptSettings(data.receiptSettings);
          localStorage.setItem('receiptSettings', JSON.stringify(data.receiptSettings));
        }
        if (data.systemSettings) {
          setSystemSettings(data.systemSettings);
          localStorage.setItem('systemSettings', JSON.stringify(data.systemSettings));
          if (data.systemSettings.language) {
            changeLanguage(data.systemSettings.language);
          }
        }

        alert(`✅ ${t.settings.importSuccess}`);
      } catch (error) {
        alert(`❌ ${t.common.error}`);
      }
    };
    reader.readAsText(file);
  };

  // حذف جميع البيانات
  const handleDeleteAllData = () => {
    if (!confirm(`⚠️ ${t.settings.deleteConfirm}`)) {
      return;
    }

    if (!confirm(`⚠️ ${t.settings.deleteWarning}`)) {
      return;
    }

    localStorage.removeItem('storeSettings');
    localStorage.removeItem('taxSettings');
    localStorage.removeItem('receiptSettings');
    localStorage.removeItem('systemSettings');

    // إعادة تعيين القيم الافتراضية
    setStoreSettings({ name: 'متجري', phone: '0500000000', address: 'الرياض، المملكة العربية السعودية' });
    setTaxSettings({ defaultTax: 15, maxDiscount: 50, autoTax: true });
    setReceiptSettings({ message: 'شكراً لتسوقكم معنا. نتمنى لكم يوماً سعيداً!', autoPrint: false, showBarcode: true });
    setSystemSettings({ language: 'ar', currency: 'SAR', notifications: true });

    alert(`✅ ${t.settings.deleteSuccess}`);
  };

  // التحقق من الصلاحيات
  // Admins can access settings. Non-admins (if ever allowed via UI Builder) must have
  // real Django auth permissions.
  const canEditSettings =
    (typeof isAdmin === 'function' ? isAdmin() : !!isAdmin) ||
    hasAnyPermission([
      'auth.change_group',
      'auth.change_permission',
      'auth.change_user',
      'auth.add_user',
      'auth.delete_user',
    ]);

  if (!canEditSettings) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
          <h2 className="text-xl font-bold text-red-700 mb-2">{t.userPerformance.unauthorized}</h2>
          <p className="text-red-600">{t.userPerformance.unauthorizedMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className={`text-3xl font-bold mb-6 text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>
        <i className={`fas fa-cog ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
        {t.settings.title}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Store Settings */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className={`text-xl font-bold mb-4 text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>
            <i className={`fas fa-store ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
            {t.settings.storeSettings}
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-semibold text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.settings.storeName}
              </label>
              <input
                type="text"
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
                value={storeSettings.name}
                onChange={(e) => setStoreSettings({ ...storeSettings, name: e.target.value })}
              />
            </div>

            <div>
              <label className={`block text-sm font-semibold text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.settings.storePhone}
              </label>
              <input
                type="tel"
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
                value={storeSettings.phone}
                onChange={(e) => setStoreSettings({ ...storeSettings, phone: e.target.value })}
              />
            </div>

            <div>
              <label className={`block text-sm font-semibold text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.settings.storeAddress}
              </label>
              <textarea
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
                rows="3"
                value={storeSettings.address}
                onChange={(e) => setStoreSettings({ ...storeSettings, address: e.target.value })}
              ></textarea>
            </div>

            <button
              onClick={handleSaveStore}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              <i className={`fas fa-save ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
              {t.common.save}
            </button>
          </div>
        </div>

        {/* Tax & Discount Settings */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className={`text-xl font-bold mb-4 text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>
            <i className={`fas fa-percentage ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
            {t.settings.taxSettings}
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-semibold text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.settings.defaultTax} (%)
              </label>
              <input
                type="number"
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
                value={taxSettings.defaultTax}
                onChange={(e) => setTaxSettings({ ...taxSettings, defaultTax: parseFloat(e.target.value) })}
              />
            </div>

            <div>
              <label className={`block text-sm font-semibold text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.settings.maxDiscount} (%)
              </label>
              <input
                type="number"
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
                value={taxSettings.maxDiscount}
                onChange={(e) => setTaxSettings({ ...taxSettings, maxDiscount: parseFloat(e.target.value) })}
              />
            </div>

            <div className={`flex items-center ${isRTL ? 'justify-end' : 'justify-start'}`}>
              <input
                type="checkbox"
                id="auto_tax"
                checked={taxSettings.autoTax}
                onChange={(e) => setTaxSettings({ ...taxSettings, autoTax: e.target.checked})}
                className={isRTL ? 'ml-2' : 'mr-2'}
              />
              <label htmlFor="auto_tax" className="text-sm text-gray-700">
                {t.settings.autoTax}
              </label>
            </div>

            <button
              onClick={handleSaveTax}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              <i className={`fas fa-save ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
              {t.common.save}
            </button>
          </div>
        </div>

        {/* Receipt Settings */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className={`text-xl font-bold mb-4 text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>
            <i className={`fas fa-receipt ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
            {t.settings.receiptSettings}
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-semibold text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.settings.receiptMessage}
              </label>
              <textarea
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
                rows="3"
                value={receiptSettings.message}
                onChange={(e) => setReceiptSettings({ ...receiptSettings, message: e.target.value })}
              ></textarea>
            </div>

            <div className={`flex items-center ${isRTL ? 'justify-end' : 'justify-start'}`}>
              <input
                type="checkbox"
                id="auto_print"
                checked={receiptSettings.autoPrint}
                onChange={(e) => setReceiptSettings({ ...receiptSettings, autoPrint: e.target.checked })}
                className={isRTL ? 'ml-2' : 'mr-2'}
              />
              <label htmlFor="auto_print" className="text-sm text-gray-700">
                {t.settings.autoPrint}
              </label>
            </div>

            <div className={`flex items-center ${isRTL ? 'justify-end' : 'justify-start'}`}>
              <input
                type="checkbox"
                id="show_barcode"
                checked={receiptSettings.showBarcode}
                onChange={(e) => setReceiptSettings({ ...receiptSettings, showBarcode: e.target.checked })}
                className={isRTL ? 'ml-2' : 'mr-2'}
              />
              <label htmlFor="show_barcode" className="text-sm text-gray-700">
                {t.settings.showBarcode}
              </label>
            </div>

            <button
              onClick={handleSaveReceipt}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              <i className={`fas fa-save ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
              {t.common.save}
            </button>
          </div>
        </div>

        {/* System Settings */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className={`text-xl font-bold mb-4 text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>
            <i className={`fas fa-sliders-h ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
            {t.settings.systemSettings}
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-semibold text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.settings.language}
              </label>
              <select
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
                value={systemSettings.language}
                onChange={(e) => setSystemSettings({ ...systemSettings, language: e.target.value })}
              >
                <option value="ar">{t.settings.arabic}</option>
                <option value="en">{t.settings.english}</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-semibold text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.settings.currency}
              </label>
              <select
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
                value={systemSettings.currency}
                onChange={(e) => setSystemSettings({ ...systemSettings, currency: e.target.value })}
              >
                <option value="SAR">SAR - {isRTL ? 'ريال سعودي' : 'Saudi Riyal'}</option>
                <option value="EGP">EGP - {isRTL ? 'جنيه مصري' : 'Egyptian Pound'}</option>
                <option value="USD">USD - {isRTL ? 'دولار أمريكي' : 'US Dollar'}</option>
                <option value="EUR">EUR - {isRTL ? 'يورو' : 'Euro'}</option>
              </select>
            </div>

            <div className={`flex items-center ${isRTL ? 'justify-end' : 'justify-start'}`}>
              <input
                type="checkbox"
                id="notifications"
                checked={systemSettings.notifications}
                onChange={(e) => setSystemSettings({ ...systemSettings, notifications: e.target.checked })}
                className={isRTL ? 'ml-2' : 'mr-2'}
              />
              <label htmlFor="notifications" className="text-sm text-gray-700">
                {t.settings.notifications}
              </label>
            </div>

            <button
              onClick={handleSaveSystem}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              <i className={`fas fa-save ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
              {t.common.save}
            </button>
          </div>
        </div>

        {/* Backup & Data */}
        <div className="bg-white rounded-xl shadow-md p-6 md:col-span-2">
          <h2 className={`text-xl font-bold mb-4 text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>
            <i className={`fas fa-database ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
            {t.settings.backupData}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleExportData}
              className="bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              <i className={`fas fa-download ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
              {t.settings.exportData}
            </button>
            
            <label className="bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition cursor-pointer text-center">
              <i className={`fas fa-upload ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
              {t.settings.importData}
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
            </label>
            
            <button
              onClick={handleDeleteAllData}
              className="bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition"
            >
              <i className={`fas fa-trash-alt ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
              {t.settings.deleteAllData}
            </button>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className={`text-sm text-yellow-800 ${isRTL ? 'text-right' : 'text-left'}`}>
              <i className={`fas fa-exclamation-triangle ${isRTL ? 'ml-1' : 'mr-1'}`}></i>
              <strong>{isRTL ? 'تحذير:' : 'Warning:'}</strong> {t.settings.deleteWarning}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
