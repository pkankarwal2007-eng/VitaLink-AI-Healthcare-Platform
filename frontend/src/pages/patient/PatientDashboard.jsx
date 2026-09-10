import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import {
  Sparkles,
  Stethoscope,
  Calendar,
  Pill,
  FileText,
  Activity,
  ShieldAlert,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const PatientDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (authLoading || loading) {
    return (
      <DashboardLayout title="Patient Health Hub">
        <div className="space-y-6 max-w-6xl animate-pulse">
          <div className="h-44 bg-slate-200 rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="h-28 bg-slate-200 rounded-xl" />
            <div className="h-28 bg-slate-200 rounded-xl" />
            <div className="h-28 bg-slate-200 rounded-xl" />
            <div className="h-28 bg-slate-200 rounded-xl" />
          </div>
          <div className="h-64 bg-slate-200 rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Patient Health Hub">
      <div className="space-y-6 max-w-6xl">
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-teal-900 rounded-2xl p-8 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-1">
              Active Patient Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">
              Welcome, {user?.fullName || 'Patient'}
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              Access AI symptom assistance, verified doctor appointments, digital prescriptions, and medicine orders in one unified place.
            </p>
          </div>
          <Link
            to="/patient/ai-assistant"
            className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs uppercase tracking-wider shadow-md transition flex items-center gap-2 shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>Launch AI Assistant</span>
          </Link>
        </div>

        {/* Quick Action Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Link
            to="/patient/ai-assistant"
            className="p-5 rounded-xl bg-white border border-slate-200 hover:border-sky-300 shadow-sm hover:shadow transition group"
          >
            <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">AI Health Assistant</h3>
            <p className="text-xs text-slate-500 mt-1">Free-form symptom understanding & guidance.</p>
          </Link>

          <Link
            to="/patient/doctors"
            className="p-5 rounded-xl bg-white border border-slate-200 hover:border-teal-300 shadow-sm hover:shadow transition group"
          >
            <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Stethoscope className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Find Specialists</h3>
            <p className="text-xs text-slate-500 mt-1">Search vetted, verified medical clinicians.</p>
          </Link>

          <Link
            to="/patient/appointments"
            className="p-5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow transition group"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Appointments</h3>
            <p className="text-xs text-slate-500 mt-1">Manage scheduled chat, video, or clinic visits.</p>
          </Link>

          <Link
            to="/patient/prescriptions"
            className="p-5 rounded-xl bg-white border border-slate-200 hover:border-cyan-300 shadow-sm hover:shadow transition group"
          >
            <div className="w-10 h-10 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Pill className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Prescriptions</h3>
            <p className="text-xs text-slate-500 mt-1">View dosages & order door-to-door medicines.</p>
          </Link>
        </div>

        {/* Clinical History & Appointments Status Areas (with elegant empty states) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Consultations */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  <span>Upcoming Consultations</span>
                </h2>
              </div>

              {/* Empty state */}
              <div className="py-10 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <Clock className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">No appointments scheduled</h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  You have no active visits scheduled today. Explore verified doctors to book your next consultation.
                </p>
                <Link
                  to="/patient/doctors"
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 font-bold text-xs hover:bg-sky-100 transition"
                >
                  <span>Find a Doctor</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Prescriptions & Pharmacy Orders */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Pill className="w-4 h-4 text-teal-600" />
                  <span>Active Prescriptions</span>
                </h2>
              </div>

              {/* Empty state */}
              <div className="py-10 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">No active prescriptions</h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Once a doctor issues a digital prescription during consultation, it will appear here for instant pharmacy dispatch.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Health Profile Snapshot */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Health Coordinates & Account Profile
            </h2>
            <Link to="/patient/profile" className="text-xs font-bold text-sky-600 hover:underline">
              Edit Details →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block">Full Name</span>
              <span className="font-semibold text-slate-800">{user?.fullName || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Registered Email</span>
              <span className="font-semibold text-slate-800">{user?.email || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Mobile</span>
              <span className="font-semibold text-slate-800">{user?.phone || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">City / State</span>
              <span className="font-semibold text-slate-800">{user?.city ? `${user.city}, ${user.state}` : 'Not configured'}</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientDashboard;
