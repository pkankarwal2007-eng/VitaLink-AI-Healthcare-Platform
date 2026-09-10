import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import {
  Building,
  MapPin,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Phone,
  Printer
} from 'lucide-react';

export const PhysicalConsultationPage = () => {
  const { appointmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchDetails();
  }, [appointmentId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/consultations/physical/${appointmentId}`);
      if (res.data?.success) {
        setDetails(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to retrieve physical consultation pass.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    const reason = prompt('Please enter the reason for cancelling this clinic appointment:');
    if (!reason || !reason.trim()) return;

    setCancelling(true);
    try {
      const res = await apiClient.patch(`/appointments/${appointmentId}/cancel`, {
        reason: reason.trim()
      });
      if (res.data?.success) {
        alert('Appointment cancelled successfully.');
        fetchDetails();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel appointment.');
    } finally {
      setCancelling(false);
    }
  };

  const backLink = user?.role === 'doctor' ? '/doctor/appointments' : '/patient/appointments';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mb-2" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Physical Visit Pass Error</h2>
          <p className="text-xs text-slate-500">{error}</p>
          <Link
            to={backLink}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 text-white font-bold text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Appointments</span>
          </Link>
        </div>
      </div>
    );
  }

  const isCancelled = details.status === 'cancelled' || details.status === 'rejected';

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="max-w-2xl w-full space-y-6">
        {/* Top Actions */}
        <div className="flex items-center justify-between">
          <Link
            to={backLink}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Appointments</span>
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Pass</span>
          </button>
        </div>

        {/* The Clinic Pass Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-teal-950 p-6 sm:p-8 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-bold uppercase tracking-wider mb-2">
                <Building className="w-3 h-3" />
                <span>In-Person Physical Visit Pass</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black">{details.clinic?.hospitalName}</h1>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>{details.clinic?.address}</span>
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
                isCancelled ? 'bg-rose-500/20 text-rose-300 border border-rose-400/30' : 'bg-teal-500/20 text-teal-300 border border-teal-400/30'
              }`}>
                {details.status}
              </span>
              <div className="text-[10px] text-slate-400 font-mono mt-1">
                Ref: {details.appointmentId?.slice(-8).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Appointment Schedule Coordinates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Consultation Doctor</span>
                <span className="font-bold text-slate-900 text-sm">Dr. {details.doctor?.name}</span>
                <span className="text-teal-700 block font-semibold">{details.doctor?.specialization}</span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Date & Time Slot</span>
                <span className="font-bold text-slate-900 text-sm">
                  {new Date(details.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-sky-700 block font-semibold">
                  {details.timeSlot?.start} — {details.timeSlot?.end}
                </span>
              </div>
            </div>

            {/* Patient & Financial Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Patient Details</span>
                <div className="font-bold text-slate-800">{details.patient?.name}</div>
                <div className="text-slate-500">Ph: {details.patient?.phone}</div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Consultation Fee</span>
                <div className="text-base font-black text-slate-900">₹{details.fee}</div>
                <div className="text-[11px] text-slate-500">Payable at clinic desk or prepaid</div>
              </div>
            </div>

            {/* Visit Instructions */}
            <div className="pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Patient Arrival Instructions
              </h3>
              <ul className="space-y-2 text-xs text-slate-600">
                {details.instructions?.map((inst, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                    <span>{inst}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cancellation Option if Active */}
            {!isCancelled && (
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Cannot attend this clinic session?
                </span>
                <button
                  disabled={cancelling}
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 transition"
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Clinic Appointment'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhysicalConsultationPage;
