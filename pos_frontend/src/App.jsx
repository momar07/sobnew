import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { LanguageProvider } from './context/LanguageContext';
import Navbar from './components/Navbar';
import DynamicSidebar from './components/DynamicSidebar';
import DynamicRoutes from './components/DynamicRoutes';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';

import React from 'react';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <i className="fas fa-spinner fa-spin text-6xl text-blue-600"></i>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Protected Route for POS - يتحقق من وجود وردية مفتوحة للكاشير
const POSProtectedRoute = ({ children }) => {
  const { user, loading, isCashier } = useAuth();
  const [currentShift, setCurrentShift] = React.useState(null);
  const [shiftLoading, setShiftLoading] = React.useState(true);

  React.useEffect(() => {
    if (user && isCashier()) {
      fetchCurrentShift();
    } else {
      setShiftLoading(false);
    }
  }, [user]);

  const fetchCurrentShift = async () => {
    try {
      const { cashRegisterAPI } = await import('./services/api');
      const response = await cashRegisterAPI.getCurrent();
      setCurrentShift(response.data);
    } catch (error) {
      setCurrentShift(null);
    } finally {
      setShiftLoading(false);
    }
  };

  if (loading || shiftLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <i className="fas fa-spinner fa-spin text-6xl text-blue-600"></i>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // إذا كان الكاشير ولا توجد وردية مفتوحة، وجهه إلى الخزنة
  if (isCashier() && !currentShift) {
    return <Navigate to="/cash-register" replace />;
  }

  return children;
};

// Main Layout Component - يتم تحميله مرة واحدة فقط
const MainLayout = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <i className="fas fa-spinner fa-spin text-6xl text-blue-600"></i>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <DynamicSidebar />
        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary>
            <DynamicRoutes ProtectedRoute={ProtectedRoute} POSProtectedRoute={POSProtectedRoute} />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <CartProvider>
          <Router>
            <Routes>
  <Route path="/login" element={<Login />} />
  <Route
    path="/*"
    element={
      <MainLayout />
    }
  />
</Routes>

          </Router>
        </CartProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
