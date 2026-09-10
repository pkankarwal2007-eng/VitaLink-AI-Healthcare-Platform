import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import {
  Calendar,
  Clock,
  Video,
  MessageSquare,
  Building,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Phone,
  Mail,
  Check,
  ChevronRight,
  ShieldCheck,
  Loader2,
  Send,
  Coffee,
  CalendarDays,
  Sparkles,
  Info
} from 'lucide-react';

export const DoctorAppointmentsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Role safeguard: ensure non-doctor users are immediately redirected away
  useEffect(() => {
    if (user && user.role !== 'doctor') {
      navigate(user.role === 'admin' ? '/admin' : user.role === 'shipping' ? '/shipping' : '/patient/appointments', { replace: true });
    }
  }, [user, navigate]);

  // Navigation Tabs: 'pending' | 'today' | 'slots' | 'all'
  const [activeTab, setActiveTab] = useState('pending');

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Doctor Day Schedule state for Calendar / Slots View
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [daySchedule, setDaySchedule] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Suggest Another Time Modal state
  const [suggestModal, setSuggestModal] = useState({
    isOpen: false,
    appointment: null,
    date: '',
    startTime: '10:00',
    endTime: '10:30',
    reason: ''
  });

  // Reject Modal state
  const [rejectModal, setRejectModal] = useState({
    isOpen: false,
    appointment: null,
    reasonOption: 'Doctor unavailable at requested time',
    notes: ''
  });

  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    fetchAppointments();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'slots') {
      fetchDaySchedule(selectedScheduleDate);
    }
  }, [activeTab, selectedScheduleDate]);

  const fetchAppointments = async () => {
    if (user && user.role !== 'doctor') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (activeTab === 'pending') {
        params.status = 'pending';
      } else if (activeTab === 'today') {
        params.upcoming = 'true';
      } else if (activeTab === 'all') {
        params.status = 'all';
      }

      const res = await apiClient.get('/appointments/my', { params });
      if (res.data?.success) {
        setAppointments(res.data.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDaySchedule = async (dateStr) => {
    setScheduleLoading(true);
    try {
      const res = await apiClient.get('/appointments/schedule/view', {
        params: { date: dateStr }
      });
      if (res.data?.success) {
        setDaySchedule(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load day schedule:', err);
    } finally {
      setScheduleLoading(false);
    }
  };

  // Doctor Action 1: Accept
  const handleAcceptAppointment = async (appointmentId) => {
    if (user && user.role !== 'doctor') {
      alert('Only authenticated doctors can accept appointment requests.');
      return;
    }
    setUpdatingId(appointmentId);
    setError(null);
    try {
      const res = await apiClient.patch(`/appointments/${appointmentId}/accept`);
      if (res.data?.success) {
        setActionSuccess('Appointment confirmed successfully! Patient has been notified.');
        fetchAppointments();
        if (activeTab === 'slots') fetchDaySchedule(selectedScheduleDate);
        setTimeout(() => setActionSuccess(null), 5000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept appointment.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Doctor Action 2: Open Suggest Modal
  const openSuggestModal = (apt) => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 1);
    const dateStr = defaultDate.toISOString().split('T')[0];

    setSuggestModal({
      isOpen: true,
      appointment: apt,
      date: dateStr,
      startTime: apt.timeSlot?.start || '10:00',
      endTime: apt.timeSlot?.end || '10:30',
      reason: ''
    });
    setModalError(null);
  };

  // Doctor Action 2: Submit Suggest
  const handleSubmitSuggest = async (e) => {
    e.preventDefault();
    if (!suggestModal.appointment) return;

    if (user && user.role !== 'doctor') {
      setModalError('Only authenticated doctors can propose alternative consultation times.');
      return;
    }

    setModalLoading(true);
    setModalError(null);
    try {
      const res = await apiClient.patch(`/appointments/${suggestModal.appointment._id}/suggest-time`, {
        date: suggestModal.date,
        timeSlot: {
          start: suggestModal.startTime,
          end: suggestModal.endTime
        },
        reason: suggestModal.reason.trim()
      });

      if (res.data?.success) {
        setSuggestModal({ isOpen: false, appointment: null, date: '', startTime: '', endTime: '', reason: '' });
        setActionSuccess('Proposed new consultation time sent to patient for review.');
        fetchAppointments();
        if (activeTab === 'slots') fetchDaySchedule(selectedScheduleDate);
        setTimeout(() => setActionSuccess(null), 5000);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to propose alternative time.');
    } finally {
      setModalLoading(false);
    }
  };

  // Doctor Action 3: Open Reject Modal
  const openRejectModal = (apt) => {
    setRejectModal({
      isOpen: true,
      appointment: apt,
      reasonOption: 'Doctor unavailable at requested time',
      notes: ''
    });
    setModalError(null);
  };

  // Doctor Action 3: Submit Reject
  const handleSubmitReject = async (e) => {
    e.preventDefault();
    if (!rejectModal.appointment) return;

    if (user && user.role !== 'doctor') {
      setModalError('Only authenticated doctors can decline appointment requests.');
      return;
    }

    const finalReason = rejectModal.notes.trim()
      ? `${rejectModal.reasonOption}: ${rejectModal.notes.trim()}`
      : rejectModal.reasonOption;

    if (finalReason.length < 3) {
      setModalError('Please specify a rejection reason.');
      return;
    }

    setModalLoading(true);
    setModalError(null);
    try {
      const res = await apiClient.patch(`/appointments/${rejectModal.appointment._id}/reject`, {
        reason: finalReason
      });

      if (res.data?.success) {
        setRejectModal({ isOpen: false, appointment: null, reasonOption: '', notes: '' });
        setActionSuccess('Appointment request rejected. The time slot has been freed.');
        fetchAppointments();
        if (activeTab === 'slots') fetchDaySchedule(selectedScheduleDate);
        setTimeout(() => setActionSuccess(null), 5000);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to reject appointment.');
    } finally {
      setModalLoading(false);
    }
  };

  // Update status directly (complete, no-show)
  const handleUpdateStatus = async (appointmentId, newStatus) => {
    setUpdatingId(appointmentId);
    try {
      const res = await apiClient.patch(`/appointments/${appointmentId}/status`, {
        status: newStatus
      });

      if (res.data?.success) {
        fetchAppointments();
        if (activeTab === 'slots') fetchDaySchedule(selectedScheduleDate);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Helper date pills for Calendar / Slots View
  const getNextDays = () => {
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days.push({ iso, dayName, monthDay, isToday: i === 0 });
    }
    return days;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'pending':
        return 'bg-amber-50 text-amber-800 border-amber-300 font-black';
      case 'suggested_time':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'completed':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'cancelled':
      case 'rejected':
      case 'declined':
      case 'no-show':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Filter today's consultations when on 'today' tab
  const todayStr = new Date().toISOString().split('T')[0];
  const displayedAppointments = activeTab === 'today'
    ? appointments.filter((apt) => {
        const aptDateStr = new Date(apt.date).toISOString().split('T')[0];
        return aptDateStr === todayStr && (apt.status === 'confirmed' || apt.status === 'pending');
      })
    : appointments;

  const pendingCount = activeTab === 'pending'
    ? appointments.length
    : appointments.filter((a) => a.status === 'pending').length;

  return (
    <DashboardLayout title="Clinical Consultations">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header with Title */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />
              <span>Doctor Consultation Center</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Review pending patient requests, manage schedule slots, and launch teleconsultation sessions.
            </p>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {actionSuccess && (
          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="font-semibold">{actionSuccess}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto scrollbar-none">
          {[
            { id: 'pending', label: 'Pending Requests', count: pendingCount },
            { id: 'today', label: "Today's Schedule" },
            { id: 'slots', label: 'Calendar / Slots View' },
            { id: 'all', label: 'All Consultations' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-teal-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full text-[10px] font-black">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ========================================================= */}
        {/* VIEW 1: CALENDAR / SLOTS VIEW */}
        {/* ========================================================= */}
        {activeTab === 'slots' ? (
          <div className="space-y-6">
            {/* Quick Date Selector */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-teal-600" />
                    <span>Select Schedule Date</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    View booked appointments, pending requests, and available time slots.
                  </p>
                </div>
                <input
                  type="date"
                  value={selectedScheduleDate}
                  onChange={(e) => setSelectedScheduleDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Date Pills */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {getNextDays().map((d) => {
                  const isSelected = selectedScheduleDate === d.iso;
                  return (
                    <button
                      type="button"
                      key={d.iso}
                      onClick={() => setSelectedScheduleDate(d.iso)}
                      className={`p-2.5 px-3 rounded-xl flex flex-col items-center min-w-[72px] transition border text-xs ${
                        isSelected
                          ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase">{d.dayName}</span>
                      <span className="text-xs font-bold mt-0.5">{d.monthDay}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Schedule Slot Grid */}
            {scheduleLoading ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center py-16 animate-pulse">
                <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500 font-semibold">Generating clinical schedule...</p>
              </div>
            ) : !daySchedule ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center py-12">
                <p className="text-xs text-slate-400">Select a date to view your schedule.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Stats Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Total Slots</span>
                    <div className="text-xl font-black text-slate-900 mt-1">{daySchedule.stats?.totalSlots || 0}</div>
                  </div>
                  <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 shadow-xs">
                    <span className="text-[10px] font-bold uppercase text-emerald-700">Available</span>
                    <div className="text-xl font-black text-emerald-800 mt-1">{daySchedule.stats?.availableCount || 0}</div>
                  </div>
                  <div className="bg-sky-50 rounded-2xl p-4 border border-sky-200 shadow-xs">
                    <span className="text-[10px] font-bold uppercase text-sky-700">Confirmed Bookings</span>
                    <div className="text-xl font-black text-sky-800 mt-1">{daySchedule.stats?.bookedCount || 0}</div>
                  </div>
                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 shadow-xs">
                    <span className="text-[10px] font-bold uppercase text-amber-700">Pending Requests</span>
                    <div className="text-xl font-black text-amber-800 mt-1">{daySchedule.stats?.pendingCount || 0}</div>
                  </div>
                </div>

                {/* Day Notice */}
                {!daySchedule.isWorkingDay && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>You are not scheduled for regular practice on {daySchedule.dayName}s.</span>
                  </div>
                )}

                {/* Slot Grid Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {daySchedule.slots?.map((slot, idx) => {
                    const apt = slot.appointment;

                    if (slot.state === 'BREAK') {
                      return (
                        <div
                          key={idx}
                          className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-4 flex items-center justify-between text-slate-400"
                        >
                          <div className="flex items-center gap-2">
                            <Coffee className="w-4 h-4" />
                            <span className="text-xs font-bold">{slot.start} — {slot.end}</span>
                          </div>
                          <span className="text-[10px] uppercase font-bold tracking-wider">Break Time</span>
                        </div>
                      );
                    }

                    if (slot.state === 'BOOKED' && apt) {
                      return (
                        <div
                          key={idx}
                          className="bg-white border-2 border-teal-500 rounded-2xl p-4 shadow-xs space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md">
                              {slot.start} — {slot.end}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-teal-50 text-teal-700 border border-teal-200">
                              Confirmed
                            </span>
                          </div>

                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {apt.patient?.fullName || 'Patient'}
                            </div>
                            <div className="text-[11px] text-slate-500 capitalize">
                              {apt.consultationType} Consultation &bull; {apt.patient?.phone || 'No phone'}
                            </div>
                            {apt.reason && (
                              <p className="text-[11px] text-slate-600 italic mt-1 line-clamp-2">
                                "{apt.reason}"
                              </p>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                            {apt.consultationType === 'video' && (
                              <Link
                                to={`/consultations/video/${apt._id}`}
                                className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 flex items-center gap-1"
                              >
                                <Video className="w-3 h-3" />
                                <span>Join Video</span>
                              </Link>
                            )}
                            {apt.consultationType === 'chat' && (
                              <Link
                                to={`/consultations/chat/${apt._id}`}
                                className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 flex items-center gap-1"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>Open Chat</span>
                              </Link>
                            )}
                            <button
                              onClick={() => handleUpdateStatus(apt._id, 'completed')}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold ml-auto"
                            >
                              Complete
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (slot.state === 'PENDING' && apt) {
                      return (
                        <div
                          key={idx}
                          className="bg-amber-50/70 border-2 border-amber-400 rounded-2xl p-4 shadow-xs space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                              {slot.start} — {slot.end}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-black bg-amber-400 text-slate-950">
                              Needs Action
                            </span>
                          </div>

                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {apt.patient?.fullName || 'Patient'}
                            </div>
                            <div className="text-[11px] text-slate-600 capitalize">
                              {apt.consultationType} Consultation &bull; {apt.patient?.phone || ''}
                            </div>
                            {apt.reason && (
                              <p className="text-[11px] text-slate-700 italic mt-1 line-clamp-2">
                                "{apt.reason}"
                              </p>
                            )}
                          </div>

                          <div className="pt-2 border-t border-amber-200 flex flex-wrap items-center gap-1.5">
                            <button
                              onClick={() => handleAcceptAppointment(apt._id)}
                              disabled={updatingId === apt._id}
                              className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold transition flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>Accept</span>
                            </button>
                            <button
                              onClick={() => openSuggestModal(apt)}
                              className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-[11px] font-bold transition"
                            >
                              Suggest Time
                            </button>
                            <button
                              onClick={() => openRejectModal(apt)}
                              className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold transition"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (slot.state === 'SUGGESTED_TIME' && apt) {
                      return (
                        <div
                          key={idx}
                          className="bg-indigo-50/50 border border-indigo-200 rounded-2xl p-4 shadow-xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-indigo-900">
                              {slot.start} — {slot.end}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-indigo-100 text-indigo-800">
                              Proposed Time
                            </span>
                          </div>
                          <div className="text-xs text-slate-700">
                            Waiting for <span className="font-bold">{apt.patient?.fullName}</span> to respond.
                          </div>
                        </div>
                      );
                    }

                    if (slot.state === 'AVAILABLE') {
                      return (
                        <div
                          key={idx}
                          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center justify-between hover:border-teal-400 transition"
                        >
                          <div>
                            <span className="text-xs font-bold text-slate-800">{slot.start} — {slot.end}</span>
                            <span className="text-[11px] text-emerald-600 block font-semibold">Available for booking</span>
                          </div>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        </div>
                      );
                    }

                    // Past slot
                    return (
                      <div
                        key={idx}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between text-slate-400"
                      >
                        <span className="text-xs font-semibold">{slot.start} — {slot.end}</span>
                        <span className="text-[10px] uppercase font-bold">Past Slot</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================= */
          /* VIEW 2: APPOINTMENTS LIST (Pending / Today / All) */
          /* ========================================================= */
          <div className="space-y-4">
            {loading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-40 bg-slate-200 rounded-2xl" />
                ))}
              </div>
            ) : displayedAppointments.length === 0 ? (
              <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Calendar className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {activeTab === 'pending'
                    ? 'No Pending Consultation Requests'
                    : activeTab === 'today'
                    ? "No Consultations Scheduled for Today"
                    : 'No Appointments Found'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  {activeTab === 'pending'
                    ? 'When patients book an appointment, requests will appear here with options to Accept, Suggest Another Time, or Reject.'
                    : 'Your clinical schedule has no matching appointments for this filter.'}
                </p>
              </div>
            ) : (
              displayedAppointments.map((apt) => {
                const patient = apt.patient || {};
                const isUpdating = updatingId === apt._id;
                const isPending = apt.status === 'pending';

                return (
                  <div
                    key={apt._id}
                    className={`bg-white rounded-2xl border p-6 shadow-xs transition flex flex-col lg:flex-row lg:items-center justify-between gap-6 ${
                      isPending ? 'border-amber-300 ring-2 ring-amber-100 bg-amber-50/20' : 'border-slate-200 hover:border-teal-300'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center text-xl font-bold shrink-0">
                        {patient.fullName?.charAt(0) || 'P'}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-sm">
                            {patient.fullName || 'Patient'}
                          </h3>
                          {patient.gender && (
                            <span className="text-xs text-slate-500 capitalize">&bull; {patient.gender}</span>
                          )}
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${getStatusBadge(apt.status)}`}>
                            {apt.status === 'pending' ? 'Pending Doctor Action' : apt.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-0.5">
                          <span className="flex items-center gap-1.5 font-medium text-slate-800">
                            <Calendar className="w-3.5 h-3.5 text-teal-600" />
                            {new Date(apt.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span className="flex items-center gap-1.5 font-medium text-slate-800">
                            <Clock className="w-3.5 h-3.5 text-teal-600" />
                            {apt.timeSlot?.start} — {apt.timeSlot?.end}
                          </span>
                          <span className="flex items-center gap-1.5 capitalize font-medium text-slate-800">
                            {apt.consultationType === 'video' ? <Video className="w-3.5 h-3.5 text-sky-600" /> : <MessageSquare className="w-3.5 h-3.5 text-teal-600" />}
                            {apt.consultationType} Consultation
                          </span>
                          <span className="font-bold text-slate-900">
                            Fee: ₹{apt.fee}
                          </span>
                        </div>

                        <div className="text-xs text-slate-700 pt-1">
                          <span className="font-bold text-slate-900">Chief Complaint: </span>
                          <span>{apt.reason}</span>
                        </div>

                        {apt.suggestedDate && apt.status === 'suggested_time' && (
                          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 space-y-1">
                            <div className="font-bold">Proposed New Time (Awaiting Patient Confirmation):</div>
                            <div>
                              {new Date(apt.suggestedDate).toLocaleDateString()} at {apt.suggestedTimeSlot?.start} - {apt.suggestedTimeSlot?.end}
                            </div>
                            {apt.suggestionReason && (
                              <div className="italic text-[11px] text-indigo-700">Reason: "{apt.suggestionReason}"</div>
                            )}
                          </div>
                        )}

                        {apt.rejectionReason && (
                          <div className="text-xs text-rose-700 pt-1">
                            <span className="font-bold">Rejection Note: </span>
                            <span>{apt.rejectionReason}</span>
                          </div>
                        )}

                        {patient.phone && (
                          <div className="text-xs text-slate-500 flex items-center gap-3 pt-0.5">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" /> {patient.phone}
                            </span>
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" /> {patient.email}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* PENDING ACTIONS (3 PRIMARY OPTIONS) */}
                      {apt.status === 'pending' && (
                        <>
                          {/* 1. Accept */}
                          <button
                            disabled={isUpdating}
                            onClick={() => handleAcceptAppointment(apt._id)}
                            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </button>

                          {/* 2. Suggest Another Time */}
                          <button
                            disabled={isUpdating}
                            onClick={() => openSuggestModal(apt)}
                            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Suggest Another Time</span>
                          </button>

                          {/* 3. Reject */}
                          <button
                            disabled={isUpdating}
                            onClick={() => openRejectModal(apt)}
                            className="px-3.5 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition flex items-center gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}

                      {/* CONFIRMED ACTIONS */}
                      {apt.status === 'confirmed' && apt.consultationType === 'video' && (
                        <Link
                          to={`/consultations/video/${apt._id}`}
                          className="px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 flex items-center gap-1.5 shadow-xs transition"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Launch Video Call</span>
                        </Link>
                      )}

                      {apt.status === 'confirmed' && apt.consultationType === 'chat' && (
                        <Link
                          to={`/consultations/chat/${apt._id}`}
                          className="px-3.5 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 flex items-center gap-1.5 shadow-xs transition"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Open Chat</span>
                        </Link>
                      )}

                      {apt.status === 'confirmed' && (
                        <button
                          disabled={isUpdating}
                          onClick={() => handleUpdateStatus(apt._id, 'completed')}
                          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Completed</span>
                        </button>
                      )}

                      {apt.status === 'confirmed' && (
                        <button
                          disabled={isUpdating}
                          onClick={() => handleUpdateStatus(apt._id, 'no-show')}
                          className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold"
                        >
                          No-Show
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 1: SUGGEST ANOTHER TIME */}
        {/* ========================================================= */}
        {suggestModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <span>Suggest Alternative Consultation Time</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Propose a new date and time to{' '}
                  <span className="font-bold text-slate-800">
                    {suggestModal.appointment?.patient?.fullName || 'the patient'}
                  </span>.
                </p>
              </div>

              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitSuggest} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Proposed Date
                  </label>
                  <input
                    type="date"
                    required
                    value={suggestModal.date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setSuggestModal({ ...suggestModal, date: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      required
                      value={suggestModal.startTime}
                      onChange={(e) => setSuggestModal({ ...suggestModal, startTime: e.target.value })}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      required
                      value={suggestModal.endTime}
                      onChange={(e) => setSuggestModal({ ...suggestModal, endTime: e.target.value })}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Reason / Note for Patient (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={suggestModal.reason}
                    onChange={(e) => setSuggestModal({ ...suggestModal, reason: e.target.value })}
                    placeholder="e.g. Schedule conflict during requested hour, available in the afternoon..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setSuggestModal({ isOpen: false, appointment: null, date: '', startTime: '', endTime: '', reason: '' })}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {modalLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Proposal...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Proposal to Patient</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 2: REJECT APPOINTMENT */}
        {/* ========================================================= */}
        {rejectModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-600" />
                  <span>Decline Appointment Request</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Please provide a reason so the patient understands why the request cannot be accommodated.
                </p>
              </div>

              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitReject} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Primary Reason
                  </label>
                  <select
                    value={rejectModal.reasonOption}
                    onChange={(e) => setRejectModal({ ...rejectModal, reasonOption: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="Doctor unavailable at requested time">Doctor unavailable at requested time</option>
                    <option value="Patient symptoms outside clinical specialty">Patient symptoms outside clinical specialty</option>
                    <option value="Schedule fully committed">Schedule fully committed</option>
                    <option value="Emergency clinic or hospital duties">Emergency clinic or hospital duties</option>
                    <option value="Other reason">Other reason</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Additional Details / Instructions for Patient
                  </label>
                  <textarea
                    rows={3}
                    value={rejectModal.notes}
                    onChange={(e) => setRejectModal({ ...rejectModal, notes: e.target.value })}
                    placeholder="Provide recommendations or alternate available days..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setRejectModal({ isOpen: false, appointment: null, reasonOption: '', notes: '' })}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {modalLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Declining Request...</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Confirm Rejection</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DoctorAppointmentsPage;

