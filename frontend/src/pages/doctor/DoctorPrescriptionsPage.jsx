import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Pill,
  Calendar,
  Clock,
  User,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  Printer,
  X
} from 'lucide-react';

export const DoctorPrescriptionsPage = () => {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Issue prescription modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState('');
  const [clinicalAssessment, setClinicalAssessment] = useState('');
  const [medications, setMedications] = useState([
    { name: '', dosage: '', frequency: '1-0-1', duration: '5 days', instructions: 'After meals', price: 50 }
  ]);
  const [testInput, setTestInput] = useState('');
  const [testsRecommended, setTestsRecommended] = useState([]);
  const [advice, setAdvice] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // View prescription modal
  const [viewingRx, setViewingRx] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const formatAppointmentDate = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTimeSlot = (slot) => {
    if (!slot) return '';
    if (typeof slot === 'string') return slot;
    if (slot.start && slot.end) return `${slot.start} - ${slot.end}`;
    if (slot.start) return slot.start;
    return '';
  };

  const formatConsultationType = (type) => {
    if (!type) return 'Consultation';
    if (type === 'video') return 'Video Consultation';
    if (type === 'chat') return 'Live Chat';
    if (type === 'physical') return 'In-Person Consultation';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rxRes, aptRes] = await Promise.all([
        apiClient.get('/medical/prescriptions'),
        apiClient.get('/appointments?limit=50')
      ]);

      if (rxRes.data?.success) {
        setPrescriptions(rxRes.data.data || []);
      }
      if (aptRes.data?.success) {
        const rawApts = aptRes.data.data?.appointments || aptRes.data.data || [];
        // Strictly filter for eligible consultations involving this doctor (confirmed or completed)
        const eligible = rawApts.filter(
          (apt) => apt.status === 'confirmed' || apt.status === 'completed'
        );
        setAppointments(eligible);
        if (eligible.length > 0) {
          const searchParams = new URLSearchParams(window.location.search);
          const urlAptId = searchParams.get('appointmentId');
          if (urlAptId && eligible.some((a) => a._id === urlAptId)) {
            handleOpenCreateModal(urlAptId);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load prescriptions:', err);
      setError(err.response?.data?.message || 'Failed to load doctor prescriptions.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedication = () => {
    setMedications([
      ...medications,
      { name: '', dosage: '', frequency: '1-0-1', duration: '5 days', instructions: 'After meals', price: 50 }
    ]);
  };

  const handleRemoveMedication = (index) => {
    if (medications.length <= 1) return;
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleMedChange = (index, field, value) => {
    const updated = [...medications];
    updated[index][field] = value;
    setMedications(updated);
  };

  const handleAddTest = () => {
    if (!testInput.trim()) return;
    if (!testsRecommended.includes(testInput.trim())) {
      setTestsRecommended([...testsRecommended, testInput.trim()]);
    }
    setTestInput('');
  };

  const handleRemoveTest = (test) => {
    setTestsRecommended(testsRecommended.filter((t) => t !== test));
  };

  const handleOpenCreateModal = (preselectedAptId = null) => {
    const initialAptId = preselectedAptId || (appointments.length > 0 ? appointments[0]._id : '');
    setSelectedAppointment(initialAptId);
    setClinicalAssessment('');
    setMedications([
      { name: '', dosage: '', frequency: '1-0-1', duration: '5 days', instructions: 'After meals', price: 50 }
    ]);
    setTestsRecommended([]);
    setTestInput('');
    setAdvice('');
    setFollowUpDate('');
    setSubmitError(null);
    setModalOpen(true);
  };

  const handleSubmitPrescription = async (e) => {
    e.preventDefault();
    if (!selectedAppointment) {
      setSubmitError('Please select a valid patient appointment.');
      return;
    }
    if (!clinicalAssessment.trim()) {
      setSubmitError('Clinical Diagnosis / Assessment is required.');
      return;
    }
    const validMeds = medications.filter(m => m.name.trim().length > 0);
    if (validMeds.length === 0) {
      setSubmitError('Please add at least one valid medication item.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const payload = {
        appointmentId: selectedAppointment,
        clinicalAssessment: clinicalAssessment.trim(),
        medications: validMeds,
        testsRecommended,
        advice: advice.trim(),
        followUpDate: followUpDate || undefined
      };

      const res = await apiClient.post('/medical/prescriptions', payload);
      if (res.data?.success) {
        setSuccessMsg(`Prescription issued successfully for ${res.data.data?.patient?.fullName || 'patient'}!`);
        setModalOpen(false);
        fetchData();
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (err) {
      console.error('Failed to issue prescription:', err);
      setSubmitError(err.response?.data?.message || 'Failed to issue prescription.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Clinical Prescriptions">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Pill className="w-5 h-5 text-teal-600" />
              <span>Clinical Prescriptions Management</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Issue digital prescriptions with dosage regimens, diagnostic orders, and follow-up schedules.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shadow-xs transition"
            >
              Refresh
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Issue Prescription
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">✕</button>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Prescription List */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2].map(n => (
              <div key={n} className="h-44 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Pill className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No prescriptions issued yet</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Issue digital prescriptions to patients following completed or active consultations.
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition shadow-xs"
            >
              Issue First Prescription
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {prescriptions.map((rx) => (
              <div
                key={rx._id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 hover:border-teal-300 transition flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                      RX #{rx._id.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(rx.createdAt).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-black text-slate-900">
                      Patient: {rx.patient?.fullName || 'Patient'}
                    </h3>
                    <span className="text-xs text-slate-400">({rx.patient?.email})</span>
                  </div>

                  <p className="text-xs font-semibold text-slate-700">
                    <span className="text-slate-400 font-normal">Diagnosis: </span>
                    {rx.clinicalAssessment}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="inline-flex items-center text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                      💊 {rx.medications?.length || 0} Medications
                    </span>
                    {rx.testsRecommended?.length > 0 && (
                      <span className="inline-flex items-center text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        🧪 {rx.testsRecommended.length} Tests Ordered
                      </span>
                    )}
                    {rx.followUpDate && (
                      <span className="inline-flex items-center text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                        📅 Follow-up: {new Date(rx.followUpDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setViewingRx(rx)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* View Prescription Modal */}
        {viewingRx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <span className="text-[10px] font-mono font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded border border-teal-200">
                    RX #{viewingRx._id.slice(-6).toUpperCase()}
                  </span>
                  <h3 className="text-base font-black text-slate-900 mt-1">
                    Prescription Summary
                  </h3>
                </div>
                <button
                  onClick={() => setViewingRx(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 space-y-6">
                {/* Patient Info */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Patient</p>
                    <p className="font-bold text-slate-800">{viewingRx.patient?.fullName}</p>
                    <p className="text-slate-500">{viewingRx.patient?.phone || viewingRx.patient?.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Issued Date</p>
                    <p className="font-semibold text-slate-800">
                      {new Date(viewingRx.createdAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                {/* Diagnosis */}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Clinical Diagnosis & Assessment
                  </h4>
                  <p className="text-xs font-bold text-slate-900 bg-teal-50/50 p-3 rounded-xl border border-teal-100">
                    {viewingRx.clinicalAssessment}
                  </p>
                </div>

                {/* Medications Table */}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Prescribed Medications
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Medicine</th>
                          <th className="p-3">Dosage</th>
                          <th className="p-3">Frequency</th>
                          <th className="p-3">Duration</th>
                          <th className="p-3">Instructions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                        {viewingRx.medications?.map((m, idx) => (
                          <tr key={idx}>
                            <td className="p-3 font-bold text-slate-900">{m.name}</td>
                            <td className="p-3">{m.dosage || '-'}</td>
                            <td className="p-3">{m.frequency}</td>
                            <td className="p-3">{m.duration}</td>
                            <td className="p-3 text-slate-500">{m.instructions || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tests Recommended */}
                {viewingRx.testsRecommended?.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Diagnostic Tests Ordered
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {viewingRx.testsRecommended.map((t, idx) => (
                        <span key={idx} className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold">
                          🧪 {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* General Advice */}
                {viewingRx.advice && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Doctor Advice & Dietary Guidelines
                    </h4>
                    <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 whitespace-pre-line">
                      {viewingRx.advice}
                    </p>
                  </div>
                )}
              </div>

              {/* Follow-up Note */}
              {viewingRx.followUpDate && (
                <div className="text-xs text-slate-600 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>
                    Recommended Follow-up Date:{' '}
                    <span className="font-bold text-slate-900">
                      {new Date(viewingRx.followUpDate).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </span>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  title="Print Clinical Prescription"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Prescription</span>
                </button>
                <button
                  onClick={() => setViewingRx(null)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Issue Prescription Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Pill className="w-5 h-5 text-teal-600" />
                  Issue Clinical Prescription
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitPrescription} className="mt-6 space-y-6">
                {/* Select Appointment */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Select Patient Consultation *
                  </label>
                  {appointments.length === 0 ? (
                    <div className="text-xs text-amber-800 bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-1">
                      <p className="font-bold">No eligible consultations found.</p>
                      <p className="text-[11px] text-amber-700">
                        Prescriptions can only be issued for confirmed or completed consultations assigned to you.
                      </p>
                    </div>
                  ) : (
                    <>
                      <select
                        value={selectedAppointment}
                        onChange={(e) => setSelectedAppointment(e.target.value)}
                        className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none bg-white font-medium text-slate-800"
                        required
                      >
                        <option value="">-- Choose Eligible Patient Consultation --</option>
                        {appointments.map((apt) => (
                          <option key={apt._id} value={apt._id}>
                            {apt.patient?.fullName || 'Patient'} • {formatAppointmentDate(apt.date)} • {formatTimeSlot(apt.timeSlot)} • {formatConsultationType(apt.consultationType)} • {apt.status === 'confirmed' ? 'Confirmed' : 'Completed'}
                          </option>
                        ))}
                      </select>

                      {/* Selected Consultation Summary Card */}
                      {(() => {
                        const chosen = appointments.find((a) => a._id === selectedAppointment);
                        if (!chosen) return null;
                        const patientPastRxs = prescriptions.filter(
                          (p) => (p.patient?._id || p.patient) === (chosen.patient?._id || chosen.patient)
                        );
                        return (
                          <div className="mt-3 p-4 bg-teal-50/70 border border-teal-200 rounded-xl space-y-2.5 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-teal-600 text-white font-bold flex items-center justify-center text-xs">
                                  {chosen.patient?.fullName?.charAt(0) || 'P'}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 text-sm">
                                    {chosen.patient?.fullName || 'Patient'}
                                  </span>
                                  {chosen.patient?.gender && (
                                    <span className="text-slate-500 text-xs ml-1.5 capitalize">
                                      ({chosen.patient.gender})
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                                  chosen.status === 'completed'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {chosen.status === 'completed' ? 'Completed Consultation' : 'Confirmed Consultation'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600 pt-1 border-t border-teal-100/80 text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                <span>{formatAppointmentDate(chosen.date)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                <span>{formatTimeSlot(chosen.timeSlot)}</span>
                              </div>
                              <div className="font-semibold text-teal-900">
                                {formatConsultationType(chosen.consultationType)}
                              </div>
                            </div>

                            {chosen.reason && (
                              <p className="text-[11px] text-slate-600 italic">
                                <span className="font-semibold not-italic text-slate-700">Reason: </span>
                                {chosen.reason}
                              </p>
                            )}

                            {patientPastRxs.length > 0 && (
                              <div className="text-[11px] text-teal-800 bg-white/70 px-2.5 py-1 rounded-lg border border-teal-100 flex items-center justify-between">
                                <span>
                                  📋 Patient has <span className="font-bold">{patientPastRxs.length}</span> previous prescription(s) on record.
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>

                {/* Clinical Assessment */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Clinical Diagnosis / Assessment *
                  </label>
                  <input
                    type="text"
                    value={clinicalAssessment}
                    onChange={(e) => setClinicalAssessment(e.target.value)}
                    placeholder="e.g. Acute Upper Respiratory Tract Infection"
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                    required
                  />
                </div>

                {/* Dynamic Medications List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                      Prescribed Medications *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddMedication}
                      className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Medication
                    </button>
                  </div>

                  {medications.map((med, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Medicine Name *</span>
                          <input
                            type="text"
                            value={med.name}
                            onChange={(e) => handleMedChange(idx, 'name', e.target.value)}
                            placeholder="e.g. Amoxicillin"
                            className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none bg-white"
                            required
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Dosage *</span>
                          <input
                            type="text"
                            value={med.dosage}
                            onChange={(e) => handleMedChange(idx, 'dosage', e.target.value)}
                            placeholder="e.g. 500mg"
                            className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none bg-white"
                            required
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Frequency *</span>
                          <select
                            value={med.frequency}
                            onChange={(e) => handleMedChange(idx, 'frequency', e.target.value)}
                            className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none bg-white"
                          >
                            <option value="1-0-1">1-0-1 (Morning & Night)</option>
                            <option value="1-1-1">1-1-1 (Thrice daily)</option>
                            <option value="1-0-0">1-0-0 (Morning only)</option>
                            <option value="0-0-1">0-0-1 (Night only)</option>
                            <option value="SOS">SOS (As needed)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Duration *</span>
                          <input
                            type="text"
                            value={med.duration}
                            onChange={(e) => handleMedChange(idx, 'duration', e.target.value)}
                            placeholder="e.g. 5 days"
                            className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none bg-white"
                            required
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Instructions</span>
                          <input
                            type="text"
                            value={med.instructions}
                            onChange={(e) => handleMedChange(idx, 'instructions', e.target.value)}
                            placeholder="e.g. After meals"
                            className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none bg-white"
                          />
                        </div>
                        <div className="flex items-end justify-end pt-2 sm:pt-4">
                          {medications.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMedication(idx)}
                              className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Diagnostic Tests Recommendation */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Recommend Diagnostic Tests (Auto-creates lab investigation requests)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      placeholder="e.g. Complete Blood Count, Chest X-Ray"
                      className="flex-1 p-2 text-xs border border-slate-300 rounded-xl outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddTest}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                    >
                      + Add Test
                    </button>
                  </div>
                  {testsRecommended.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      {testsRecommended.map((t, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full font-semibold">
                          🧪 {t}
                          <button
                            type="button"
                            onClick={() => handleRemoveTest(t)}
                            className="text-amber-800 hover:text-rose-600 font-bold ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* General Advice */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Doctor Advice & Lifestyle Guidelines
                  </label>
                  <textarea
                    rows="2"
                    value={advice}
                    onChange={(e) => setAdvice(e.target.value)}
                    placeholder="e.g. Drink plenty of warm fluids, rest for 48 hours."
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-500"
                  ></textarea>
                </div>

                {/* Follow-up date */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Recommended Follow-up Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="p-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {submitError && (
                  <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 hover:bg-slate-50 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {submitting && (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    Issue Prescription
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

export default DoctorPrescriptionsPage;
