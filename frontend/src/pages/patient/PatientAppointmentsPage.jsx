import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import apiClient from '../../api/client';
import {
  Calendar,
  Clock,
  Video,
  MessageSquare,
  Building,
  User,
  AlertCircle,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Filter,
  ShieldCheck,
  Stethoscope,
  ChevronRight,
  Star,
  Loader2,
  Sparkles
} from 'lucide-react';

export const PatientAppointmentsPage = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming', 'past', 'all'
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingLoading, setCancellingLoading] = useState(false);

  // Doctor Suggested Time response states
  const [acceptingId, setAcceptingId] = useState(null);
  const [decliningModal, setDecliningModal] = useState({
    isOpen: false,
    appointment: null,
    reason: ''
  });
  const [decliningLoading, setDecliningLoading] = useState(false);

  // Review states
  const [reviewingApt, setReviewingApt] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [reviewedMap, setReviewedMap] = useState({});

  useEffect(() => {
    fetchAppointments();
  }, [activeTab]);

  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (activeTab === 'upcoming') params.upcoming = 'true';
      if (activeTab === 'past') params.upcoming = 'false';

      const res = await apiClient.get('/appointments/my', { params });
      if (res.data?.success) {
        const apts = res.data.data || [];
        setAppointments(apts);

        // Fetch review status for completed appointments
        const completed = apts.filter((a) => a.status === 'completed');
        if (completed.length > 0) {
          completed.forEach(async (apt) => {
            try {
              const rRes = await apiClient.get(`/reviews/appointment/${apt._id}`);
              if (rRes.data?.success && rRes.data.data) {
                setReviewedMap((prev) => ({ ...prev, [apt._id]: rRes.data.data }));
              }
            } catch (e) {
              // Ignore not found
            }
          });
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewingApt) return;

    setReviewLoading(true);
    setReviewError(null);
    try {
      const res = await apiClient.post('/reviews', {
        appointmentId: reviewingApt._id,
        rating: reviewRating,
        comment: reviewComment.trim()
      });

      if (res.data?.success) {
        setReviewedMap((prev) => ({
          ...prev,
          [reviewingApt._id]: res.data.data
        }));
        setReviewingApt(null);
        setReviewComment('');
        setReviewRating(5);
      }
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Failed to submit review.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId) => {
    if (!cancelReason.trim()) {
      alert('Please provide a reason for cancellation.');
      return;
    }

    setCancellingLoading(true);
    try {
      const res = await apiClient.patch(`/appointments/${appointmentId}/cancel`, {
        reason: cancelReason.trim()
      });

      if (res.data?.success) {
        setCancellingId(null);
        setCancelReason('');
        fetchAppointments();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel appointment.');
    } finally {
      setCancellingLoading(false);
    }
  };

  const handleAcceptSuggestedTime = async (appointmentId) => {
    setAcceptingId(appointmentId);
    setError(null);
    try {
      const res = await apiClient.patch(`/appointments/${appointmentId}/patient-accept`);
      if (res.data?.success) {
        setActionSuccess('You accepted the doctor\'s proposed time! Your appointment is now confirmed.');
        fetchAppointments();
        setTimeout(() => setActionSuccess(null), 5000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept suggested time.');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDeclineSuggestedTime = async (e) => {
    e?.preventDefault();
    if (!decliningModal.appointment) return;

    setDecliningLoading(true);
    try {
      const res = await apiClient.patch(`/appointments/${decliningModal.appointment._id}/patient-decline`, {
        reason: decliningModal.reason.trim() || 'Declined by patient'
      });
      if (res.data?.success) {
        setDecliningModal({ isOpen: false, appointment: null, reason: '' });
        setActionSuccess('You declined the suggested consultation time.');
        fetchAppointments();
        setTimeout(() => setActionSuccess(null), 5000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to decline suggested time.');
    } finally {
      setDecliningLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'pending':
        return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
      case 'suggested_time':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold';
      case 'completed':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'rejected':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'declined':
      case 'cancelled':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <DashboardLayout title="My Consultations">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header with CTA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-600" />
              <span>Doctor Appointments</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Review upcoming medical visits, join video consultations, or reschedule.
            </p>
          </div>
          <Link
            to="/doctors"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Book New Appointment</span>
          </Link>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          {[
            { id: 'upcoming', label: 'Upcoming Consultations' },
            { id: 'past', label: 'Past & Completed' },
            { id: 'all', label: 'All History' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

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

        {/* Appointments List */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-36 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No appointments found</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              You do not have any {activeTab === 'upcoming' ? 'scheduled upcoming' : ''} consultations at this time.
            </p>
            <Link
              to="/doctors"
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700"
            >
              <span>Explore Verified Doctors</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((apt) => {
              const docUser = apt.doctor || {};
              const profile = apt.doctorProfile || {};
              const isUpcoming = apt.status === 'confirmed' || apt.status === 'pending' || apt.status === 'suggested_time';

              return (
                <div
                  key={apt._id}
                  className={`bg-white rounded-2xl border p-6 shadow-xs hover:border-sky-300 transition flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                    apt.status === 'suggested_time' ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center text-xl font-bold shrink-0">
                      {docUser.fullName?.charAt(0) || 'D'}
                    </div>

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-sm">
                          Dr. {docUser.fullName}
                        </h3>
                        <span className="text-xs text-teal-700 font-semibold">• {profile.specialization || 'General Physician'}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${getStatusBadge(apt.status)}`}>
                          {apt.status === 'pending' ? 'Pending Doctor Review' : apt.status === 'suggested_time' ? 'Doctor Suggested New Time' : apt.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-0.5">
                        <span className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Calendar className="w-3.5 h-3.5 text-sky-600" />
                          {new Date(apt.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Clock className="w-3.5 h-3.5 text-sky-600" />
                          {apt.timeSlot?.start} — {apt.timeSlot?.end}
                        </span>
                        <span className="flex items-center gap-1.5 capitalize font-medium text-slate-800">
                          {apt.consultationType === 'video' ? <Video className="w-3.5 h-3.5 text-sky-600" /> : <MessageSquare className="w-3.5 h-3.5 text-teal-600" />}
                          {apt.consultationType} Call
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 pt-1">
                        <span className="font-semibold text-slate-700">Reason: </span>
                        <span>{apt.reason}</span>
                      </div>

                      {/* Pending Review Callout */}
                      {apt.status === 'pending' && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2 mt-2">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Your consultation request is awaiting review by Dr. {docUser.fullName}. Your slot is held.</span>
                        </div>
                      )}

                      {/* Doctor Suggested New Time Callout with Actions */}
                      {apt.status === 'suggested_time' && (
                        <div className="p-4 bg-indigo-50/80 border-2 border-indigo-300 rounded-2xl text-xs text-indigo-950 space-y-3 mt-3">
                          <div className="flex items-center gap-2 font-black text-indigo-900">
                            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>Dr. {docUser.fullName} proposed an alternative consultation time:</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white/90 p-3 rounded-xl border border-indigo-100 text-[11px]">
                            <div>
                              <span className="text-slate-400 block font-bold uppercase text-[9px]">Original Requested Time</span>
                              <span className="font-semibold text-slate-600 line-through">
                                {new Date(apt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} &bull; {apt.timeSlot?.start} - {apt.timeSlot?.end}
                              </span>
                            </div>
                            <div>
                              <span className="text-indigo-600 block font-bold uppercase text-[9px]">Doctor's Proposed Time</span>
                              <span className="font-black text-indigo-950">
                                {new Date(apt.suggestedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} &bull; {apt.suggestedTimeSlot?.start} - {apt.suggestedTimeSlot?.end}
                              </span>
                            </div>
                          </div>
                          {apt.suggestionReason && (
                            <p className="text-[11px] text-indigo-800 italic">
                              <span className="font-bold not-italic">Doctor's Note: </span>
                              "{apt.suggestionReason}"
                            </p>
                          )}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => handleAcceptSuggestedTime(apt._id)}
                              disabled={acceptingId === apt._id}
                              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
                            >
                              {acceptingId === apt._id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Accept Proposed Time</span>
                            </button>
                            <button
                              onClick={() => setDecliningModal({ isOpen: true, appointment: apt, reason: '' })}
                              className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Rejection Note */}
                      {apt.rejectionReason && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-0.5 mt-2">
                          <span className="font-bold">Consultation Request Declined by Doctor:</span>
                          <p className="italic">{apt.rejectionReason}</p>
                        </div>
                      )}

                      {/* Decline Note */}
                      {apt.status === 'declined' && apt.declineReason && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-0.5 mt-2">
                          <span className="font-semibold">Proposed Time Declined:</span>
                          <p className="italic">{apt.declineReason}</p>
                        </div>
                      )}

                      {apt.cancellationReason && (
                        <div className="text-xs text-rose-700 pt-1">
                          <span className="font-semibold">Cancellation Note: </span>
                          <span>{apt.cancellationReason}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                    {apt.status === 'pending' && (
                      <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200">
                        Awaiting Review
                      </span>
                    )}

                    {apt.status === 'confirmed' && apt.consultationType === 'video' && (
                      <Link
                        to={`/consultations/video/${apt._id}`}
                        className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 flex items-center gap-1.5 shadow-xs transition"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join Video Call</span>
                      </Link>
                    )}

                    {apt.status === 'confirmed' && apt.consultationType === 'chat' && (
                      <Link
                        to={`/consultations/chat/${apt._id}`}
                        className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 flex items-center gap-1.5 shadow-xs transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Open Chat</span>
                      </Link>
                    )}

                    {apt.consultationType === 'physical' && (
                      <Link
                        to={`/consultations/physical/${apt._id}`}
                        className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 flex items-center gap-1.5 shadow-xs transition"
                      >
                        <Building className="w-3.5 h-3.5" />
                        <span>Clinic Pass</span>
                      </Link>
                    )}

                    {isUpcoming && (
                      <button
                        onClick={() => setCancellingId(apt._id)}
                        className="px-3.5 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition"
                      >
                        Cancel
                      </button>
                    )}

                    {apt.status === 'completed' && (
                      reviewedMap[apt._id] ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                          <span>Rated {reviewedMap[apt._id].rating}★</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setReviewingApt(apt);
                            setReviewRating(5);
                            setReviewHover(0);
                            setReviewComment('');
                            setReviewError(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition"
                        >
                          <Star className="w-3.5 h-3.5 fill-white" />
                          <span>Leave Review</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Cancellation Modal */}
        {cancellingId && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <h3 className="text-base font-bold text-slate-900">Cancel Appointment</h3>
              <p className="text-xs text-slate-600">
                Are you sure you want to cancel this consultation? This will free the slot for other patients.
              </p>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Reason for Cancellation
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Schedule conflict, feeling better, rescheduled..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setCancellingId(null); setCancelReason(''); }}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
                >
                  Keep Appointment
                </button>
                <button
                  type="button"
                  disabled={cancellingLoading}
                  onClick={() => handleCancelAppointment(cancellingId)}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50"
                >
                  {cancellingLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Leave Review Modal */}
        {reviewingApt && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                  <span>Rate Your Consultation</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Dr. {reviewingApt.doctor?.fullName || 'Doctor'} &bull; {reviewingApt.consultationType} consultation
                </p>
              </div>

              {reviewError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{reviewError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-2">
                    Overall Rating
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setReviewRating(star)}
                        onMouseEnter={() => setReviewHover(star)}
                        onMouseLeave={() => setReviewHover(0)}
                        className="p-1 hover:scale-110 transition focus:outline-none"
                      >
                        <Star
                          className={`w-7 h-7 transition ${
                            (reviewHover || reviewRating) >= star
                              ? 'text-amber-500 fill-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-sm font-bold text-amber-700 ml-2">
                      {reviewHover || reviewRating} / 5
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Feedback & Comments (Optional)
                  </label>
                  <textarea
                    rows={4}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Describe your experience, bedside manner, helpfulness, and promptness..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => { setReviewingApt(null); setReviewError(null); }}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reviewLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:opacity-50 shadow-xs transition"
                  >
                    {reviewLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Submit Review</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Decline Doctor Suggestion Modal */}
        {decliningModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Decline Proposed Time</h3>
              <p className="text-xs text-slate-600">
                Are you sure you want to decline Dr. {decliningModal.appointment?.doctor?.fullName || 'the doctor'}'s proposed consultation time?
              </p>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Reason for Declining (Optional)
                </label>
                <textarea
                  rows={3}
                  value={decliningModal.reason}
                  onChange={(e) => setDecliningModal({ ...decliningModal, reason: e.target.value })}
                  placeholder="e.g. Inconvenient hour, busy with work, seeking another specialist..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setDecliningModal({ isOpen: false, appointment: null, reason: '' })}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={decliningLoading}
                  onClick={handleDeclineSuggestedTime}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {decliningLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Declining...</span>
                    </>
                  ) : (
                    <span>Confirm Decline</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientAppointmentsPage;
