import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import {
  ShieldCheck,
  Calendar,
  Users,
  Pill,
  Clock,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  Activity,
  Star,
  RefreshCw,
  Video,
  MessageSquare,
  Building,
  TrendingUp,
  FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';

export const DoctorDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [profile, setProfile] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDoctorAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/analytics/doctor');
      if (res.data?.success) {
        setAnalytics(res.data.data);
      }
    } catch (err) {
      console.error('[DoctorDashboard] Analytics error:', err.message);
      setError(err.response?.data?.message || 'Failed to load clinician metrics.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorProfile = async () => {
    try {
      const res = await apiClient.get('/doctors/profile/me');
      if (res.data?.data) {
        setProfile(res.data.data.profile);
        setVerification(res.data.data.verification);
      }
    } catch (err) {
      console.error('[DoctorDashboard] Profile error:', err.message);
    }
  };

  useEffect(() => {
    fetchDoctorAnalytics();
    fetchDoctorProfile();
  }, []);

  const overview = analytics?.overview || {};
  const appointmentsByType = analytics?.appointmentsByType || { video: 0, chat: 0, physical: 0 };
  const recentAppointments = analytics?.recentAppointments || [];

  if (authLoading) {
    return (
      <DashboardLayout title="Clinician Workspace">
        <div className="space-y-6 max-w-6xl animate-pulse">
          <div className="h-44 bg-slate-200 rounded-2xl" />
          <div className="h-20 bg-slate-200 rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="h-48 bg-slate-200 rounded-2xl" />
            <div className="h-48 bg-slate-200 rounded-2xl" />
            <div className="h-48 bg-slate-200 rounded-2xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Clinician Workspace">
      <div className="space-y-6 max-w-6xl">
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Clinician Welcome Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-2xl p-8 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-teal-400 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Medical Clinician Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">
              Dr. {user?.fullName || 'Clinician'}
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              Manage patient consultations, digital prescriptions, appointment schedules, and verification documents.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={fetchDoctorAnalytics}
              disabled={loading}
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-400' : ''}`} />
            </button>
            <Link
              to="/doctor/profile"
              className="px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs uppercase tracking-wider shadow-md transition flex items-center gap-2 shrink-0"
            >
              <span>Practice Profile</span>
            </Link>
          </div>
        </div>

        {/* Dynamic Verification Status Banner */}
        {profile?.isVerified || profile?.verificationStatus === 'approved' ? (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-emerald-800">Verified & Approved Clinician: </span>
                Your medical council license and credentials have been verified by VitaLink administration. Your profile is publicly discoverable and eligible for appointments.
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
              Verified
            </span>
          </div>
        ) : profile?.verificationStatus === 'pending' || profile?.verificationStatus === 'under_review' ? (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold text-amber-800">Verification Pending Administrative Review: </span>
                Your credentials and uploaded documents are currently in the compliance review queue. While pending, your profile remains hidden from public doctor discovery.
              </div>
            </div>
            <Link
              to="/doctor/verification"
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition shrink-0"
            >
              Inspect Status
            </Link>
          </div>
        ) : profile?.verificationStatus === 'changes_requested' ? (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <span className="font-bold text-blue-800">Changes Requested by Administrator: </span>
                {verification?.adminNotes || 'Please inspect your verification feedback and re-submit required documents.'}
              </div>
            </div>
            <Link
              to="/doctor/verification"
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition shrink-0"
            >
              Update Credentials
            </Link>
          </div>
        ) : profile?.verificationStatus === 'rejected' ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <span className="font-bold text-rose-800">Verification Not Approved: </span>
                {verification?.adminNotes || 'Your submitted credentials did not meet VitaLink medical compliance criteria.'}
              </div>
            </div>
            <Link
              to="/doctor/verification"
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition shrink-0"
            >
              Review Submission
            </Link>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold text-amber-800">Action Required — Complete Credential Verification: </span>
                You have registered as a doctor, but your medical council registration and degree certificates are not submitted yet. Complete verification to get listed publicly.
              </div>
            </div>
            <Link
              to="/doctor/verification"
              className="px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-500 shadow-sm transition shrink-0"
            >
              Complete Verification Now →
            </Link>
          </div>
        )}

        {/* Clinical KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Consultations */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                Upcoming: {overview.upcomingAppointments ?? 0}
              </span>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-black text-slate-900">
                {overview.totalAppointments ?? 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Total consultations booked ({overview.completedAppointments ?? 0} completed)
              </p>
            </div>
          </div>

          {/* Unique Patients */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">
                Active Registry
              </span>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-black text-slate-900">
                {overview.uniquePatients ?? 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">Unique patients cared for</p>
            </div>
          </div>

          {/* Prescriptions Issued */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Pill className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                Clinical
              </span>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-black text-slate-900">
                {overview.totalPrescriptions ?? 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">Digital prescriptions issued</p>
            </div>
          </div>

          {/* Patient Rating & Feedback */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                {overview.reviewCount ?? 0} {overview.reviewCount === 1 ? 'Review' : 'Reviews'}
              </span>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-black text-slate-900 flex items-center gap-1.5">
                <span>{overview.averageRating ? overview.averageRating.toFixed(1) : '5.0'}</span>
                <span className="text-amber-500 text-xl">★</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Average patient satisfaction</p>
            </div>
          </div>
        </div>

        {/* Breakdown by Modality & Earnings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Consultations by Modality</h3>
              <Link to="/doctor/appointments" className="text-xs font-bold text-teal-700 hover:underline">
                View all schedule →
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100">
                <Video className="w-5 h-5 text-sky-600 mx-auto mb-1" />
                <span className="text-slate-500 text-xs block">Video Calls</span>
                <span className="text-xl font-black text-slate-900 mt-0.5 block">
                  {appointmentsByType.video || 0}
                </span>
              </div>

              <div className="p-4 bg-teal-50 rounded-2xl border border-teal-100">
                <MessageSquare className="w-5 h-5 text-teal-600 mx-auto mb-1" />
                <span className="text-slate-500 text-xs block">Chat Consultations</span>
                <span className="text-xl font-black text-slate-900 mt-0.5 block">
                  {appointmentsByType.chat || 0}
                </span>
              </div>

              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <Building className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                <span className="text-slate-500 text-xs block">Clinic Visits</span>
                <span className="text-xl font-black text-slate-900 mt-0.5 block">
                  {appointmentsByType.physical || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Earnings card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900">Practice Revenue</h3>
                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider bg-teal-50 px-2 py-0.5 rounded-full">
                  Estimated
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Based on completed consultations and designated consultation fees.
              </p>
            </div>

            <div className="my-6">
              <div className="text-3xl font-black text-slate-900">
                ₹{overview.estimatedEarnings?.toLocaleString('en-IN') ?? 0}
              </div>
              <span className="text-xs text-emerald-600 font-semibold mt-1 block">
                ✓ From {overview.completedAppointments || 0} completed consultations
              </span>
            </div>

            <Link
              to="/doctor/appointments"
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold text-center block transition"
            >
              Consultation Records
            </Link>
          </div>
        </div>

        {/* Quick Navigation Shortcuts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/doctor/appointments"
            className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-teal-300 hover:shadow-sm transition flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Manage Appointments</h4>
                <p className="text-[11px] text-slate-500">Slot availability & calendar</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </Link>

          <Link
            to="/doctor/prescriptions"
            className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-teal-300 hover:shadow-sm transition flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
                <Pill className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Clinical Prescriptions</h4>
                <p className="text-[11px] text-slate-500">Issue medications & advice</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </Link>

          <Link
            to="/doctor/records"
            className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-teal-300 hover:shadow-sm transition flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-50 text-sky-700">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Medical Records</h4>
                <p className="text-[11px] text-slate-500">History & diagnostic notes</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;
