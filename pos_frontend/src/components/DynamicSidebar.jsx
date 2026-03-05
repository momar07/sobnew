import { Link, useLocation } from 'react-router-dom';
import React from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Dynamic sidebar driven بالكامل من الـ UI schema القادم من السيرفر.
 * - يدعم Collapse/Expand مع حفظ الحالة في localStorage
 * - يدعم icons القادمة من السيرفر (FontAwesome class)
 */
export default function DynamicSidebar() {
  const location = useLocation();
  const { ui } = useAuth();

  const items = ui?.sidebar || [];

  const [collapsed, setCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem('pos_sidebar_collapsed_v2') === '1';
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('pos_sidebar_collapsed_v2', collapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [collapsed]);

  const isActive = (path) => location.pathname === path;

  // Fallback icons لو الـ DB icon فاضي/مش FontAwesome.
  // (ده مش تعريف صلاحيات يدوي—مجرد تحسين UI لو الادمن نسي يحط icon.)
  const fallbackIconByKeyOrPath = (item) => {
    const k = String(item?.key || '').toLowerCase();
    const p = String(item?.path || '').toLowerCase();

    if (k.includes('dashboard') || p.includes('dashboard')) return 'fas fa-chart-line';
    if (k.includes('pos') || p === '/' || p.includes('/pos')) return 'fas fa-cash-register';
    if (k.includes('products') || p.includes('products')) return 'fas fa-boxes-stacked';
    if (k.includes('customers') || p.includes('customers')) return 'fas fa-users';
    if (k.includes('operations') || p.includes('operations')) return 'fas fa-receipt';
    if (k.includes('reports') || p.includes('reports')) return 'fas fa-file-invoice';
    if (k.includes('cash') || p.includes('cash-register')) return 'fas fa-money-bill-wave';
    if (k.includes('users') || p.includes('/users')) return 'fas fa-user-cog';
    if (k.includes('performance') || p.includes('performance')) return 'fas fa-trophy';
    if (k.includes('settings') || p.includes('settings')) return 'fas fa-gear';
    return 'fas fa-circle';
  };

  return (
    <aside
      className={`bg-gray-800 text-white ${collapsed ? 'w-20' : 'w-64'} h-full p-4 overflow-y-auto flex flex-col transition-all duration-200`}
      aria-label="Sidebar"
    >
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className={`text-2xl font-bold ${collapsed ? 'text-center w-full' : ''}`}>
          <i className="fas fa-store ml-2"></i>
          {!collapsed && 'POS'}
        </div>

        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-gray-200 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
          title={collapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
          type="button"
        >
          <i className={`fas ${collapsed ? 'fa-angle-left' : 'fa-angle-right'}`}></i>
        </button>
      </div>

      {/* Menu */}
      <nav className="space-y-2 flex-1">
        {items.map((item) => {
          const active = isActive(item.path);
          const iconCls = (item.icon && String(item.icon).includes('fa'))
            ? item.icon
            : fallbackIconByKeyOrPath(item);

          return (
            <Link
              key={item.key || item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`flex items-center p-3 rounded-lg transition-colors ${
                active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <i className={`${iconCls} ${collapsed ? '' : 'ml-3'}`}></i>
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer hint */}
      <div className="pt-4 border-t border-gray-700 text-xs text-gray-400">
        {!collapsed ? 'Dynamic UI' : 'UI'}
      </div>
    </aside>
  );
}
