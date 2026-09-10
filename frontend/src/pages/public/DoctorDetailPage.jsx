import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/common/Navbar';
import { Footer } from '../../components/common/Footer';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import {
  ShieldCheck,
  Star,
  Building,
  GraduationCap,
  Clock,
  Calendar,
  MessageSquare,
  Video,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  User,
  Sparkles,
  ChevronRight,
  Phone,
  Mail,
  FileText
} from 'lucide-react';

export const DoctorDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Booking Flow State
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [slotsData, setSlotsData] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [consultationType, setConsultationType] = useState('video');
  const [reason, setReason] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // Reviews state
  const [reviewsData, setReviewsData] = useState(null);
  const [loadingReviews, setLoadingReviews] = useState(false);

  useEffect(() => {
    fetchDoctor();
  }, [id]);

  useEffect(() => {
    if (doctor && selectedDate) {
      fetchSlots(selectedDate);
    }
  }, [doctor, selectedDate]);

  const fetchReviews = async (docUserId) => {
    if (!docUserId) return;
    setLoadingReviews(true);
    try {
      const res = await apiClient.get(`/reviews/doctor/${docUserId}`);
      if (res.data?.success) {
        setReviewsData(res.data);
      }
    } catch (err) {
      console.error('Error fetching doctor reviews:', err.message);
    } finally {
      setLoadingReviews(false);
    }
  };

  const fetchDoctor = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/doctors/${id}`);
      if (res.data?.success) {
        const doc = res.data.data.doctor;
        setDoctor(doc);
        if (doc.consultationModes?.length > 0) {
          setConsultationType(doc.consultationModes[0]);
        }
        const docUserId = doc.user?._id || doc.user;
        fetchReviews(docUserId);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Doctor not found or not currently verified.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSlots = async (dateStr) => {
    setLoadingSlots(true);
    setBookingError(null);
    setSelectedSlot(null);
    try {
      const res = await apiClient.get(`/doctors/${id}/slots`, {
        params: { date: dateStr }
      });
      if (res.data?.success) {
        setSlotsData(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }

    // Proactively verify token and session consistency
    const currentToken = localStorage.getItem('vitalink_token');
    if (!currentToken) {
      navigate('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }

    // Inspect decoded token role to protect against stale/mismatched localStorage sessions
    let tokenRole = null;
    try {
      const payload = JSON.parse(atob(currentToken.split('.')[1]));
      tokenRole = payload.role;
    } catch {
      // ignore
    }

    if (user.role !== 'patient' || (tokenRole && tokenRole !== 'patient')) {
      if (user.role === 'doctor' || tokenRole === 'doctor') {
        setBookingError('You are currently signed in with a Doctor account. Consultations can only be scheduled by patient accounts. Please sign in to a patient account to book.');
      } else {
        setBookingError('Only patients can schedule appointments. Please sign in to a patient account.');
      }
      return;
    }

    if (!selectedSlot) {
      setBookingError('Please select an available time slot.');
      return;
    }

    if (!reason.trim()) {
      setBookingError('Please provide a brief reason or symptoms for the appointment.');
      return;
    }

    setBookingLoading(true);
    setBookingError(null);

    try {
      const res = await apiClient.post('/appointments', {
        doctorId: doctor._id,
        date: selectedDate,
        timeSlot: {
          start: selectedSlot.start,
          end: selectedSlot.end
        },
        consultationType,
        reason: reason.trim()
      });

      if (res.data?.success) {
        setBookingSuccess(res.data.data.appointment);
        fetchSlots(selectedDate);
      }
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'SLOT_ALREADY_BOOKED') {
        setBookingError('This time slot was just booked by another patient. Please choose a different slot.');
        fetchSlots(selectedDate);
      } else {
        setBookingError(err.response?.data?.message || 'Failed to schedule appointment. Please try again.');
      }
    } finally {
      setBookingLoading(false);
    }
  };

  // Generate next 10 dates for quick date selection
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-16 flex-1 w-full animate-pulse space-y-6">
          <div className="h-64 bg-slate-200 rounded-3xl" />
          <div className="h-96 bg-slate-200 rounded-3xl" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !doctor) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="max-w-md mx-auto px-4 py-20 flex-1 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Doctor Profile Unavailable</h2>
          <p className="text-xs text-slate-500">{error || 'The requested doctor is not currently verified on VitaLink.'}</p>
          <Link
            to="/doctors"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white font-bold text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Doctors Directory</span>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const u = doctor.user || {};

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-8">
        {/* Back Link */}
        <div>
          <Link
            to="/doctors"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Doctor Directory</span>
          </Link>
        </div>

        {/* Doctor Header Banner Card */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-6">
            {u.avatar ? (
              <img
                src={u.avatar}
                alt={u.fullName}
                className="w-24 h-24 rounded-3xl object-cover object-top border border-teal-200 shadow-md shrink-0"
              />
            ) : (
              <div className="w-24 h-24 rounded-3xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center text-3xl font-black shrink-0">
                {u.fullName?.charAt(0) || 'D'}
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                  Dr. {u.fullName?.replace(/^dr\.\s*/i, '')}
                </h1>
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold">
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                  Verified Doctor
                </span>
              </div>
              <p className="text-sm font-semibold text-teal-700">{doctor.specialization}</p>
              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-1">
                <span className="flex items-center gap-1 font-medium">
                  <GraduationCap className="w-4 h-4 text-slate-400" />
                  {doctor.highestDegree || 'Medical Practitioner'} ({doctor.college || 'Medical Council'})
                </span>
                <span className="flex items-center gap-1 font-medium">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {doctor.experienceYears || 0} Years Clinical Practice
                </span>
                <span className="flex items-center gap-1 font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {reviewsData?.averageRating?.toFixed(1) || doctor.rating?.toFixed(1) || '5.0'} Rating ({reviewsData?.total ?? doctor.reviewCount ?? 0})
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 shrink-0 text-left md:text-right w-full md:w-auto">
            <div className="text-[10px] uppercase font-bold text-slate-400">Consultation Fee</div>
            <div className="text-2xl font-black text-slate-900">₹{doctor.consultationFee || 500}</div>
            <div className="text-[11px] text-teal-700 font-medium mt-0.5">Per 30-min Consultation</div>
          </div>
        </div>

        {/* Two-Column Grid: Practice Details vs Interactive Booking Wizard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Doctor Biography & Credentials */}
          <div className="lg:col-span-5 space-y-6">
            {/* About & Bio */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Clinical Background</h2>
              <p className="text-xs leading-relaxed text-slate-600">
                {doctor.about || `Dr. ${u.fullName} is an experienced ${doctor.specialization} registered with the Medical Council. Specializes in comprehensive consultations, clinical diagnostics, and evidence-based treatment plans.`}
              </p>

              {doctor.skills?.length > 0 && (
                <div className="pt-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Clinical Focus Areas
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {doctor.skills.map((sk, i) => (
                      <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold">
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {doctor.languages?.length > 0 && (
                <div className="pt-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Languages Spoken
                  </span>
                  <span className="text-xs text-slate-700 font-medium">
                    {doctor.languages.join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Hospital & Location */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3 text-xs text-slate-700">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Hospital & Clinic Affiliation</h2>
              <div className="flex items-start gap-3">
                <Building className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{doctor.hospitalName || 'Affiliated Healthcare Centre'}</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>{doctor.hospitalAddress || `${u.city || 'National'}, India`}</span>
              </div>
            </div>

            {/* Available Days & Hours */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3 text-xs text-slate-700">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Regular Practice Schedule</h2>
              <div>
                <span className="text-slate-400 block font-bold mb-1">Working Days</span>
                <div className="flex flex-wrap gap-1.5">
                  {doctor.availableDays?.map((d, i) => (
                    <span key={i} className="px-2.5 py-1 bg-teal-50 text-teal-800 border border-teal-200 rounded-md font-bold text-[11px]">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <span className="text-slate-400 block font-bold mb-1">Consultation Hours</span>
                <span className="font-semibold text-slate-800">
                  {doctor.availableTime?.start || '09:00'} — {doctor.availableTime?.end || '17:00'} (Break: {doctor.breakTime?.start || '13:00'}-{doctor.breakTime?.end || '14:00'})
                </span>
              </div>
            </div>

            {/* Verified Patient Reviews & Rating Breakdown */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Patient Reviews
                </h2>
                {reviewsData && (
                  <span className="text-xs text-slate-500 font-semibold">
                    {reviewsData.total} {reviewsData.total === 1 ? 'Review' : 'Reviews'}
                  </span>
                )}
              </div>

              {/* Rating Overview */}
              <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-6">
                <div className="text-center shrink-0">
                  <div className="text-3xl font-black text-slate-900">
                    {reviewsData?.averageRating?.toFixed(1) || doctor.rating?.toFixed(1) || '5.0'}
                  </div>
                  <div className="flex items-center justify-center gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                          star <= Math.round(reviewsData?.averageRating || doctor.rating || 5)
                            ? 'text-amber-500 fill-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block font-medium">
                    out of 5 stars
                  </span>
                </div>

                {/* Rating Breakdown Bars */}
                <div className="flex-1 space-y-1 text-[11px]">
                  {[5, 4, 3, 2, 1].map((ratingNum) => {
                    const count = reviewsData?.breakdown?.[ratingNum] || 0;
                    const total = reviewsData?.total || 1;
                    const pct = reviewsData?.total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={ratingNum} className="flex items-center gap-2">
                        <span className="w-3 font-bold text-slate-500">{ratingNum}</span>
                        <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-6 text-right text-[10px] text-slate-400 font-medium">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Individual Reviews List */}
              <div className="space-y-3 pt-2">
                {loadingReviews ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Loading patient reviews...</p>
                ) : !reviewsData?.data || reviewsData.data.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No verified reviews yet. Consultations with Dr. {u.fullName} can be reviewed after completion.
                  </p>
                ) : (
                  reviewsData.data.map((rev) => (
                    <div key={rev._id} className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                            {rev.patient?.fullName?.charAt(0) || 'P'}
                          </div>
                          <span className="text-xs font-bold text-slate-800">
                            {rev.patient?.fullName || 'Verified Patient'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3 h-3 ${
                              s <= rev.rating ? 'text-amber-500 fill-amber-400' : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>

                      {rev.comment && (
                        <p className="text-xs text-slate-600 leading-relaxed italic">
                          "{rev.comment}"
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Interactive 5-Step Appointment Booking Engine */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-sky-600" />
                  <span>Book Consultation Appointment</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct appointment scheduling with automated slot availability and double-booking guard.
                </p>
              </div>

              {bookingSuccess ? (
                <div className="p-8 text-center bg-teal-50 border border-teal-200 rounded-2xl space-y-4">
                  <div className="w-14 h-14 bg-teal-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Appointment Confirmed!</h3>
                    <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                      Your appointment with Dr. {u.fullName} is scheduled for{' '}
                      <span className="font-bold text-slate-900">
                        {new Date(bookingSuccess.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {bookingSuccess.timeSlot?.start} - {bookingSuccess.timeSlot?.end}
                      </span>.
                    </p>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-teal-100 text-xs space-y-2 max-w-sm mx-auto text-left">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Consultation Type:</span>
                      <span className="font-bold uppercase text-slate-800">{bookingSuccess.consultationType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Consultation Fee:</span>
                      <span className="font-bold text-slate-800">₹{bookingSuccess.fee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status:</span>
                      <span className="font-bold uppercase text-teal-600">{bookingSuccess.status}</span>
                    </div>
                    {bookingSuccess.videoRoomId && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Video Room:</span>
                        <code className="text-[11px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded block truncate">
                          {bookingSuccess.videoRoomId}
                        </code>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <Link
                      to="/patient/appointments"
                      className="px-6 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 transition"
                    >
                      View in My Appointments
                    </Link>
                    <button
                      onClick={() => { setBookingSuccess(null); setSelectedSlot(null); setReason(''); }}
                      className="px-6 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
                    >
                      Book Another Slot
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleBookingSubmit} className="space-y-6">
                  {user && user.role !== 'patient' && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold">Signed in as {user.role?.toUpperCase()}</p>
                        <p className="text-amber-700 leading-relaxed">
                          Consultation appointments on VitaLink are booked by patient accounts. To schedule an appointment with Dr. {u.fullName || 'this doctor'}, please sign in to a patient account.
                        </p>
                      </div>
                    </div>
                  )}

                  {bookingError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{bookingError}</span>
                    </div>
                  )}

                  {/* Step 1: Date Selector */}
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-2">
                      Step 1: Choose Date
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                      {getNextDays().map((d) => {
                        const isSelected = selectedDate === d.iso;
                        return (
                          <button
                            type="button"
                            key={d.iso}
                            onClick={() => setSelectedDate(d.iso)}
                            className={`p-2.5 px-3 rounded-xl flex flex-col items-center min-w-[70px] transition border text-xs ${
                              isSelected
                                ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
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

                  {/* Step 2: Time Slots */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-800">
                        Step 2: Choose Available Slot
                      </label>
                      {slotsData?.availableSlotsCount !== undefined && (
                        <span className="text-[11px] text-teal-700 font-semibold">
                          {slotsData.availableSlotsCount} slot(s) available
                        </span>
                      )}
                    </div>

                    {loadingSlots ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 animate-pulse">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                          <div key={n} className="h-10 bg-slate-100 rounded-xl" />
                        ))}
                      </div>
                    ) : !slotsData?.isWorkingDay ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs text-center">
                        {slotsData?.message || 'Doctor does not practice on this day. Please select another date.'}
                      </div>
                    ) : slotsData?.slots?.length === 0 ? (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs text-center">
                        No slots available for this date.
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {slotsData.slots.map((slot, idx) => {
                          const isSelected = selectedSlot?.start === slot.start;
                          const disabled = !slot.isAvailable;

                          return (
                            <button
                              type="button"
                              key={idx}
                              disabled={disabled}
                              onClick={() => setSelectedSlot(slot)}
                              className={`p-2.5 rounded-xl text-xs font-semibold border transition text-center ${
                                isSelected
                                  ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                                  : disabled
                                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through'
                                  : 'bg-white text-slate-800 border-slate-200 hover:border-teal-500 hover:bg-teal-50/50'
                              }`}
                            >
                              <div>{slot.start}</div>
                              {slot.isBooked && (
                                <span className="text-[9px] text-rose-500 font-bold block no-underline">Booked</span>
                              )}
                              {slot.isPast && (
                                <span className="text-[9px] text-slate-400 block no-underline">Past</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Step 3: Consultation Type */}
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-2">
                      Step 3: Consultation Mode
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(doctor.consultationModes || ['chat', 'video', 'physical']).map((mode) => {
                        const isSelected = consultationType === mode;
                        const icons = {
                          video: Video,
                          chat: MessageSquare,
                          physical: Building
                        };
                        const labels = {
                          video: 'Video Call',
                          chat: 'Live Chat',
                          physical: 'In-Person Visit'
                        };
                        const Icon = icons[mode] || Video;

                        return (
                          <button
                            type="button"
                            key={mode}
                            onClick={() => setConsultationType(mode)}
                            className={`p-3 rounded-xl border flex items-center gap-3 transition text-left ${
                              isSelected
                                ? 'border-sky-600 bg-sky-50 text-sky-900 font-bold shadow-2xs'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-sky-600' : 'text-slate-400'}`} />
                            <span className="text-xs">{labels[mode] || mode}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 4: Medical Reason */}
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-2">
                      Step 4: Symptoms or Consultation Reason
                    </label>
                    <textarea
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Briefly describe your symptoms, questions, or medical concerns for Dr. to prepare..."
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  {/* Step 5: Submit Button */}
                  <div className="pt-2">
                    {user && user.role !== 'patient' ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled
                          className="w-full py-3.5 px-6 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs uppercase tracking-wider cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <AlertCircle className="w-4 h-4" />
                          <span>Patient Account Required to Book</span>
                        </button>
                        <p className="text-[11px] text-center text-slate-500">
                          You are currently signed in as a <span className="font-bold capitalize">{user.role}</span>. Please sign in to a patient account to schedule an appointment.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={bookingLoading || !selectedSlot}
                        className="w-full py-3.5 px-6 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase tracking-wider shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {bookingLoading ? (
                          <span>Reserving Appointment Slot...</span>
                        ) : (
                          <>
                            <span>Confirm & Book Appointment (₹{doctor.consultationFee || 500})</span>
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default DoctorDetailPage;
