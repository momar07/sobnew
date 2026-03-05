import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { lazyPage } from "../ui/componentLoader";
import { useAuth } from "../context/AuthContext";

// These wrappers are passed from App.jsx (to avoid circular deps)
export default function DynamicRoutes({ ProtectedRoute, POSProtectedRoute }) {
  const { ui } = useAuth();

  const routes = ui?.routes || [];

  // If UI not loaded yet
  if (!ui) return null;

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[60vh]">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
        </div>
      }
    >
      <Routes>
        {routes.map((r) => {
          const Page = lazyPage(r.component);

          const element = (() => {
            if (r.wrapper === "public") return <Page />;
            if (r.wrapper === "pos_shift") {
              return (
                <POSProtectedRoute>
                  <Page />
                </POSProtectedRoute>
              );
            }
            // default: auth
            return (
              <ProtectedRoute>
                <Page />
              </ProtectedRoute>
            );
          })();

          return <Route key={r.key || r.path} path={r.path} element={element} />;
        })}

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
