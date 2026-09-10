import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationCenter from '../components/common/NotificationCenter';
import {
  LayoutDashboard,
  Sparkles,
  Stethoscope,
  Calendar,
  FileText,
  Pill,
  Truck,
  Users,
  ShieldCheck,
  Bell,
  LogOut,
  Menu,
  X,
  User,
  Activity,
  ClipboardList,
  Building,
  Star
} from 'lucide-react';

export const DashboardLayout = ({ children, title = 'Dashboard' }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Build role-specific navigation items
  const getNavItems = () => {
    if (!user) return [];

    switch (user.role) {
      case 'patient':
        return [
          { label: 'Overview', path: '/patient', icon: LayoutDashboard },
          { label: 'AI Health Assistant', path: '/patient/ai-assistant', icon: Sparkles },
          { label: 'Find Doctors', path: '/patient/doctors', icon: Stethoscope },
          { label: 'Appointments', path: '/patient/appointments', icon: Calendar },
          { label: 'Prescriptions', path: '/patient/prescriptions', icon: Pill },
          { label: 'Medical Records', path: '/patient/records', icon: FileText },
          { label: 'Test Reports', path: '/patient/reports', icon: Activity },
          { label: 'Medicine Orders', path: '/patient/orders', icon: Truck },
          { label: 'Profile Settings', path: '/patient/profile', icon: User },
        ];
      case 'doctor':
        return [
          { label: 'Practice Overview', path: '/doctor', icon: LayoutDashboard },
          { label: 'Doctor Profile', path: '/doctor/profile', icon: User },
          { label: 'Verification Status', path: '/doctor/verification', icon: ShieldCheck },
          { label: 'Appointments', path: '/doctor/appointments', icon: Calendar },
          { label: 'Patients', path: '/doctor/patients', icon: Users },
          { label: 'Clinical Prescriptions', path: '/doctor/prescriptions', icon: Pill },
          { label: 'Medical Records', path: '/doctor/records', icon: FileText },
        ];
      case 'shipping':
        return [
          { label: 'Logistics Overview', path: '/shipping', icon: LayoutDashboard },
          { label: 'Assigned Orders', path: '/shipping/orders', icon: ClipboardList },
          { label: 'Active Deliveries', path: '/shipping/active', icon: Truck },
          { label: 'Delivery History', path: '/shipping/history', icon: FileText },
          { label: 'Partner Profile', path: '/shipping/profile', icon: User },
        ];
      case 'admin':
        return [
          { label: 'System Overview', path: '/admin?tab=overview', icon: LayoutDashboard },
          { label: 'Doctor Verification', path: '/admin?tab=verifications', icon: ShieldCheck },
          { label: 'User Directory', path: '/admin?tab=users', icon: Users },
          { label: 'Appointments', path: '/admin?tab=appointments', icon: Calendar },
          { label: 'Prescriptions', path: '/admin?tab=prescriptions', icon: Pill },
          { label: 'Medical Records', path: '/admin?tab=records', icon: FileText },
          { label: 'Test Reports', path: '/admin?tab=reports', icon: Activity },
          { label: 'Medicine Orders', path: '/admin?tab=orders', icon: Truck },
          { label: 'Shipping Partners', path: '/admin?tab=shipping', icon: Building },
          { label: 'Broadcast Alerts', path: '/admin?tab=notifications', icon: Bell },
          { label: 'Reviews Moderation', path: '/admin?tab=reviews', icon: Star },
          { label: 'Care Inquiries', path: '/admin?tab=contact', icon: ClipboardList },
          { label: 'Compliance Audit', path: '/admin?tab=audit', icon: FileText },
          { label: 'Security & Settings', path: '/admin?tab=settings', icon: ShieldCheck },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  const getRoleTheme = () => {
    switch (user?.role) {
      case 'admin':
        return { badge: 'bg-cyan-950 text-cyan-300 border-cyan-800', bar: 'bg-slate-900 border-slate-800' };
      case 'doctor':
        return { badge: 'bg-teal-50 text-teal-700 border-teal-200', bar: 'bg-teal-900 border-teal-800' };
      case 'shipping':
        return { badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', bar: 'bg-indigo-950 border-indigo-900' };
      case 'patient':
      default:
        return { badge: 'bg-sky-50 text-sky-700 border-sky-200', bar: 'bg-slate-900 border-slate-800' };
    }
  };

  const theme = getRoleTheme();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0">
        {/* Logo */}
        <div className="h-20 flex items-center px-6 border-b border-slate-200 gap-3">
          <img src="/logo.png" alt="VitaLink" className="h-10 w-auto object-contain" />
          <div>
            <div className="font-black text-slate-900 text-lg leading-tight">VitaLink</div>
            <div className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Connected Care</div>
          </div>
        </div>

        {/* User Badge */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 border border-slate-200">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-slate-900 truncate">{user?.fullName || 'User'}</div>
              <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
              <span className={`inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${theme.badge}`}>
                {user?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const currentFull = location.pathname + location.search;
            const isActive = location.pathname === item.path || currentFull === item.path || (item.path.startsWith('/admin?tab=overview') && location.pathname === '/admin' && (!location.search || location.search === '?tab=overview'));
            return (
              <Link
                key={idx}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {Icon && <Icon className="w-4 h-4 shrink-0" />}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="VitaLink" className="h-8 w-auto object-contain" />
          <span className="font-bold text-slate-900">VitaLink</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 p-4 space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Navigation ({user?.role})
          </div>
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const currentFull = location.pathname + location.search;
            const isActive = location.pathname === item.path || currentFull === item.path || (item.path.startsWith('/admin?tab=overview') && location.pathname === '/admin' && (!location.search || location.search === '?tab=overview'));
            return (
              <Link
                key={idx}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                  isActive ? 'bg-sky-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {Icon && <Icon className="w-4 h-4 shrink-0" />}
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => { setSidebarOpen(false); handleLogout(); }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 mt-4 border-t border-slate-100 pt-3"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">{title}</h2>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500 hidden sm:inline">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <NotificationCenter />
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
