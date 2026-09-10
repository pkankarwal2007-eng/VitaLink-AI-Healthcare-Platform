import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/common/Navbar';
import { Footer } from '../../components/common/Footer';
import { Mail, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, ShieldCheck } from 'lucide-react';

/**
 * Mask an email address for privacy (e.g., kankarwalp2007@gmail.com -> k***7@gmail.com)
 */
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  const first = local[0];
  const last = local[local.length - 1];
  const masked = first + '*'.repeat(Math.min(local.length - 2, 5)) + last;
  return `${masked}@${domain}`;
};

export const EmailVerificationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail, resendVerification } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const emailParam = searchParams.get('email') || location.state?.email || '';

  const [email, setEmail] = useState(emailParam);
  const [isEditingEmail, setIsEditingEmail] = useState(!emailParam);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(location.state?.error || null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef([]);

  // Live countdown timer for resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Focus the first empty digit box on load
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleDigitChange = (index, value) => {
    setError(null);
    const cleanVal = value.replace(/\D/g, '');

    // Handle single digit entry
    if (cleanVal.length <= 1) {
      const newDigits = [...otpDigits];
      newDigits[index] = cleanVal;
      setOtpDigits(newDigits);

      // Auto-advance to next input
      if (cleanVal && index < 5 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1].focus();
      }
    }
  };

  const handleKeyDown = (index, e) => {
    // Navigate backwards on Backspace if current box is empty
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/\D/g, '');
    if (!pastedData) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pastedData[i] || '';
    }
    setOtpDigits(newDigits);

    // Focus last filled box or next empty box
    const focusIndex = Math.min(pastedData.length, 5);
    if (inputRefs.current[focusIndex]) {
      inputRefs.current[focusIndex].focus();
    }
  };

  const fullOtp = otpDigits.join('');

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return setError('Please enter your email address.');
    }

    if (fullOtp.length !== 6) {
      return setError('Please enter the complete 6-digit verification code.');
    }

    setLoading(true);
    const result = await verifyEmail(cleanEmail, fullOtp);
    setLoading(false);

    if (result.success) {
      setSuccessMessage(result.message || 'Email verified successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } else {
      setError(result.message);
      if (typeof result.attemptsRemaining === 'number') {
        setAttemptsRemaining(result.attemptsRemaining);
      }
      // If code was invalid, select the first input
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return setError('Please provide your email address to resend the code.');
    }

    setError(null);
    setResending(true);
    const result = await resendVerification(cleanEmail);
    setResending(false);

    if (result.success) {
      setSuccessMessage('A fresh verification code has been dispatched to your email.');
      setCooldown(result.cooldownSeconds || 60);
      setOtpDigits(['', '', '', '', '', '']);
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    } else {
      setError(result.message);
      if (result.secondsRemaining) {
        setCooldown(result.secondsRemaining);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-14 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-teal-900 p-8 text-white text-center">
            <img src="/logo.png" alt="VitaLink" className="h-12 w-auto mx-auto mb-3 object-contain" />
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800/60 text-sky-300 text-xs font-semibold mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              <span>Email Authentication</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Verify Your Email</h1>
            <p className="text-sky-200 text-sm mt-1">Enter the 6-digit code sent to your inbox</p>
          </div>

          <div className="p-8 space-y-6">
            {/* Email Display / Edit */}
            <div className="bg-sky-50/60 border border-sky-100 rounded-xl p-4 text-center">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">
                Verification Code Sent To
              </div>
              {isEditingEmail ? (
                <div className="mt-2 flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="flex-1 text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingEmail(false)}
                    className="px-3 py-2 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700"
                  >
                    Set
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span className="font-semibold text-slate-800 text-sm font-mono">
                    {maskEmail(email)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingEmail(true)}
                    className="text-xs text-sky-600 hover:text-sky-800 font-medium underline ml-1"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Error Notification */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span>{error}</span>
                  {attemptsRemaining !== null && attemptsRemaining > 0 && (
                    <div className="text-xs font-semibold mt-1 text-rose-800">
                      {attemptsRemaining} attempt{attemptsRemaining > 1 ? 's' : ''} remaining before code lockout.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Success Notification */}
            {successMessage && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
                <div className="flex-1">
                  <span>{successMessage}</span>
                </div>
              </div>
            )}

            {/* OTP Form */}
            <form onSubmit={handleVerify} className="space-y-6">
              <div>
                <label className="block text-center text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
                  6-Digit Verification Code
                </label>
                <div className="flex justify-between gap-2 sm:gap-3" onPaste={handlePaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (inputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      aria-label={`Digit ${idx + 1}`}
                      className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold font-mono rounded-xl border transition ${
                        digit
                          ? 'border-sky-600 bg-sky-50 text-sky-900 ring-2 ring-sky-500/20'
                          : 'border-slate-300 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-center text-slate-400 mt-2">
                  Code expires in 10 minutes &bull; You can paste the complete 6-digit code
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || fullOtp.length !== 6}
                className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold text-sm shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Email Address</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Resend Section with Cooldown */}
            <div className="pt-4 border-t border-slate-100 text-center space-y-2">
              <div className="text-xs text-slate-500">Didn't receive the verification code?</div>
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || resending}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-800 disabled:text-slate-400 disabled:cursor-not-allowed transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                <span>
                  {cooldown > 0
                    ? `Resend code in ${cooldown}s`
                    : resending
                    ? 'Sending new code...'
                    : 'Resend Verification Code'}
                </span>
              </button>
            </div>

            {/* Navigation back to login */}
            <div className="text-center pt-2">
              <Link
                to="/login"
                className="text-xs text-slate-500 hover:text-slate-800 font-medium transition"
              >
                &larr; Return to Sign In
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default EmailVerificationPage;
