import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = () => {
    if (confirm(t.navbar.logoutConfirm)) {
      logout();
      navigate('/login');
    }
  };

  const getUserBadge = () => {
    const groups = user?.groups || [];
    if (groups.includes('Admins') || user?.is_staff) {
      return { label: t.roles.admin, cls: 'bg-red-100 text-red-700' };
    }
    if (groups.includes('Managers')) {
      return { label: t.roles.manager, cls: 'bg-blue-100 text-blue-700' };
    }
    if (groups.includes('Cashier Plus')) {
      return { label: (t.roles.cashier || 'كاشير') + ' +', cls: 'bg-green-100 text-green-700' };
    }
    if (groups.includes('Cashiers')) {
      return { label: t.roles.cashier, cls: 'bg-green-100 text-green-700' };
    }
    return { label: 'User', cls: 'bg-gray-100 text-gray-700' };
  };


  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8 space-x-reverse">
            <Link to="/" className="text-xl font-bold text-blue-600">
              <i className="fas fa-cash-register ml-2"></i>
              نظام نقاط البيع
            </Link>
          </div>

          <div className="flex items-center space-x-4 space-x-reverse">
            {user && (
              <>
                {/* User Info */}
                <div className="flex items-center space-x-3 space-x-reverse border-l pl-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">
                      {user.profile?.full_name || user.username}
                    </p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getUserBadge().cls}`}>
                      {getUserBadge().label}
                    </span>
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    {user.first_name?.[0] || user.username[0].toUpperCase()}
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="text-red-600 hover:text-red-700 font-semibold transition-colors"
                  title="تسجيل الخروج"
                >
                  <i className="fas fa-sign-out-alt text-lg"></i>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
