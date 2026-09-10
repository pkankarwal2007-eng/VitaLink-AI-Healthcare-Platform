import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.png" alt="VitaLink Logo" className="h-16 w-auto animate-pulse" />
          <p className="text-slate-600 font-medium">Securing session...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role authorization if specific roles were supplied
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Role-based redirect to their dedicated home
    switch (user.role) {
      case 'doctor':
        return <Navigate to="/doctor" replace />;
      case 'shipping':
        return <Navigate to="/shipping" replace />;
      case 'admin':
        return <Navigate to="/admin" replace />;
      case 'patient':
      default:
        return <Navigate to="/patient" replace />;
    }
  }

  return children;
};

export const PatientRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={['patient']}>{children}</ProtectedRoute>
);

export const DoctorRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={['doctor']}>{children}</ProtectedRoute>
);

export const ShippingRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={['shipping']}>{children}</ProtectedRoute>
);

export const AdminRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={['admin']}>{children}</ProtectedRoute>
);
