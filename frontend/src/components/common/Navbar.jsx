import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Menu, X, LogOut, User as UserIcon, LayoutDashboard, Search } from 'lucide-react';
import NotificationCenter from './NotificationCenter';

export const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'doctor': return '/doctor';
      case 'shipping': return '/shipping';
      case 'admin': return '/admin';
      case 'patient':
      default: return '/patient';
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logo & Name */}
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/logo.png"
              alt="VitaLink Logo"
              className="h-12 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tight text-slate-900 leading-none">
                Vita<span className="text-sky-600">Link</span>
              </span>
              <span className="text-[10px] font-bold tracking-widest text-teal-600 uppercase mt-0.5">
                Smarter Healthcare. Connected.
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7">
            <Link to="/" className="text-sm font-semibold text-slate-700 hover:text-teal-600 transition">
              Home
            </Link>
            <a href="/#services" className="text-sm font-semibold text-slate-700 hover:text-teal-600 transition">
              Services
            </a>
            <Link to="/doctors" className="text-sm font-semibold text-slate-700 hover:text-teal-600 transition">
              Doctors
            </Link>
            <Link to="/patient/orders" className="text-sm font-semibold text-slate-700 hover:text-teal-600 transition">
              Medicines
            </Link>
            <a href="/#about" className="text-sm font-semibold text-slate-700 hover:text-teal-600 transition">
              About
            </a>
            <a href="/#contact" className="text-sm font-semibold text-slate-700 hover:text-teal-600 transition">
              Contact
            </a>
          </nav>

          {/* Desktop Account / Auth CTA (NO ADMIN LINK EVER) */}
          <div className="hidden md:flex items-center gap-3">
            {/* Search Icon */}
            <Link
              to="/doctors"
              title="Search Doctors & Specialists"
              className="p-2 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-full transition"
            >
              <Search className="w-4 h-4" />
            </Link>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <NotificationCenter />
                <Link
                  to={getDashboardPath()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 transition"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                  <span className="text-[11px] uppercase tracking-wider bg-teal-200/80 px-2 py-0.5 rounded text-teal-900 font-bold">
                    {user.role}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-sm font-semibold text-slate-700 hover:text-teal-700 px-3 py-2 rounded-lg transition"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-lg text-white bg-teal-600 hover:bg-teal-700 shadow-sm hover:shadow transition"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu toggle button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-6 space-y-3">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50 rounded-md"
          >
            Home
          </Link>
          <a
            href="/#services"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50 rounded-md"
          >
            Services
          </a>
          <Link
            to="/doctors"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50 rounded-md"
          >
            Doctors
          </Link>
          <Link
            to="/patient/orders"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50 rounded-md"
          >
            Medicines
          </Link>
          <a
            href="/#about"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50 rounded-md"
          >
            About
          </a>
          <a
            href="/#contact"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50 rounded-md"
          >
            Contact
          </a>

          <div className="pt-4 border-t border-slate-100">
            {isAuthenticated && user ? (
              <div className="space-y-2">
                <Link
                  to={getDashboardPath()}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3 py-2 text-base font-semibold text-sky-700 bg-sky-50 rounded-md"
                >
                  <span>Dashboard ({user.role})</span>
                  <LayoutDashboard className="w-5 h-5" />
                </Link>
                <button
                  onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                  className="flex items-center justify-between w-full px-3 py-2 text-base font-semibold text-rose-600 hover:bg-rose-50 rounded-md"
                >
                  <span>Log out</span>
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center px-4 py-2.5 text-sm font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-700 shadow-sm"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
