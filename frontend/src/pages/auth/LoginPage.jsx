import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/common/Navbar';
import { Footer } from '../../components/common/Footer';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const redirectParam = searchParams.get('redirect');
  const from = location.state?.from?.pathname || redirectParam || null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setUnverifiedEmail(null);

    const cleanEmail = email ? email.trim() : '';
    const cleanPassword = password || '';

    if (!cleanEmail || !cleanPassword) {
      return setError('Please enter both your email and password.');
    }

    setLoading(true);
    const result = await login(cleanEmail, cleanPassword);
    setLoading(false);

    if (result.success) {
      const userRole = result.user?.role;

      // Only redirect to 'from' if the destination route is compatible with the logged-in user's role
      const isCompatibleDestination = from && (
        (from.startsWith('/doctor') && userRole === 'doctor') ||
        (from.startsWith('/shipping') && userRole === 'shipping') ||
        (from.startsWith('/admin') && userRole === 'admin') ||
        (from.startsWith('/patient') && userRole === 'patient') ||
        (from.startsWith('/doctors') && userRole === 'patient') ||
        (from.startsWith('/consultations') && (userRole === 'doctor' || userRole === 'patient' || userRole === 'admin')) ||
        (!from.startsWith('/doctor') && !from.startsWith('/shipping') && !from.startsWith('/admin') && !from.startsWith('/patient'))
      );

      if (isCompatibleDestination) {
        navigate(from, { replace: true });
        return;
      }

      switch (userRole) {
        case 'doctor':
          navigate('/doctor', { replace: true });
          break;
        case 'shipping':
          navigate('/shipping', { replace: true });
          break;
        case 'admin':
          navigate('/admin', { replace: true });
          break;
        case 'patient':
        default:
          navigate('/patient', { replace: true });
          break;
      }
    } else {
      if (result.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(result.email || cleanEmail);
      }
      setError(result.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-14 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-teal-900 p-8 text-white text-center">
            <img src="/logo.png" alt="VitaLink" className="h-12 w-auto mx-auto mb-3 object-contain" />
            <h1 className="text-2xl font-bold tracking-tight">Welcome Back</h1>
            <p className="text-sky-200 text-sm mt-1">Sign in to your VitaLink account</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            {error && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm space-y-2">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="flex-1">{error}</span>
                </div>
                {unverifiedEmail && (
                  <div className="pt-2 border-t border-rose-200/80 flex justify-end">
                    <Link
                      to={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-800 hover:text-rose-950 underline"
                    >
                      <span>Verify Email Address Now</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                Don't have an account yet?{' '}
                <Link to="/register" className="text-sky-600 font-bold hover:underline">
                  Create account
                </Link>
              </p>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default LoginPage;
