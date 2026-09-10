import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  Search,
  User,
  Calendar,
  Clock,
  Pill,
  FileText,
  Activity,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Phone,
  Mail,
  Printer,
  X,
  Plus
} from 'lucide-react';

export const DoctorPatientsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected patient state for profile view
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('prescriptions'); // 'prescriptions' | 'appointments' | 'records'
  const [patientPrescriptions, setPatientPrescriptions] = useState([]);
  const [patientRecords, setPatientRecords] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // View single prescription modal
  const [viewingRx, setViewingRx] = useState(null);

  useEffect(() => {
    fetchDoctorPatients();
  }, []);

  const fetchDoctorPatients = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/appointments/my');
      if (res.data?.success) {
        const apts = res.data.data || [];
        setAppointments(apts);

        // Group unique patients
        const patientMap = new Map();
        apts.forEach((apt) => {
          if (apt.patient && apt.patient._id) {
            const pId = apt.patient._id.toString();
            if (!patientMap.has(pId)) {
              patientMap.set(pId, {
                ...apt.patient,
                appointmentsCount: 1,
                lastAppointment: apt
              });
            } else {
              const existing = patientMap.get(pId);
              existing.appointmentsCount += 1;
              if (new Date(apt.date) > new Date(existing.lastAppointment.date)) {
                existing.lastAppointment = apt;
              }
            }
          }
        });

        const uniquePatients = Array.from(patientMap.values());
        setPatients(uniquePatients);

        // If URL query has patientId, auto-select
        const queryPatientId = new URLSearchParams(location.search).get('patientId');
        if (queryPatientId) {
          const match = uniquePatients.find((p) => p._id.toString() === queryPatientId);
          if (match) {
            handleSelectPatient(match);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load doctor patients:', err);
      setError(err.response?.data?.message || 'Failed to load patient roster.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = async (patient) => {
    setSelectedPatient(patient);
    setActiveTab('prescriptions');
    setDetailLoading(true);
    setDetailError(null);

    try {
      const [rxRes, recRes] = await Promise.all([
        apiClient.get(`/medical/prescriptions?patientId=${patient._id}`),
        apiClient.get(`/medical/records?patientId=${patient._id}`)
      ]);

      if (rxRes.data?.success) {
        setPatientPrescriptions(rxRes.data.data || []);
      }
      if (recRes.data?.success) {
        setPatientRecords(recRes.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load patient clinical history:', err);
      setDetailError(err.response?.data?.message || 'Failed to load clinical details for this patient.');
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredPatients = patients.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (p.fullName && p.fullName.toLowerCase().includes(term)) ||
      (p.email && p.email.toLowerCase().includes(term)) ||
      (p.phone && p.phone.includes(term))
    );
  });

  const getPatientAppointments = (patientId) => {
    return appointments.filter((a) => a.patient?._id?.toString() === patientId.toString());
  };

  const getEligibleApt = (patientId) => {
    return appointments.find(
      (a) =>
        a.patient?._id?.toString() === patientId.toString() &&
        (a.status === 'confirmed' || a.status === 'completed')
    );
  };

  const formatDate = (dateVal) => {
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

  return (
    <DashboardLayout title="My Patients">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Top Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-600" />
              <span>Patient Medical History & Profiles</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Access verified consultation records, past prescriptions, and clinical assessments for your patients.
            </p>
          </div>

          {selectedPatient && (
            <button
              onClick={() => setSelectedPatient(null)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shadow-xs transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Patient List
            </button>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* MAIN CONTENT AREA */}
        {!selectedPatient ? (
          /* ================= Patient Directory View ================= */
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search patient by name, email, or phone number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs outline-none bg-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-32 bg-slate-200 rounded-2xl" />
                ))}
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {searchTerm ? 'No matching patients found' : 'No patients on record'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  {searchTerm
                    ? 'Try searching with a different name, email, or phone.'
                    : 'Patients who book consultations with you will automatically appear here.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPatients.map((pat) => {
                  const eligibleApt = getEligibleApt(pat._id);
                  return (
                    <div
                      key={pat._id}
                      className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-teal-300 shadow-xs transition flex flex-col justify-between space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center text-base font-bold shrink-0">
                            {pat.fullName?.charAt(0) || 'P'}
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                              <span>{pat.fullName || 'Patient'}</span>
                              {pat.gender && (
                                <span className="text-[11px] text-slate-400 font-normal capitalize">
                                  ({pat.gender})
                                </span>
                              )}
                            </h3>
                            <div className="text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                              {pat.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {pat.phone}
                                </span>
                              )}
                              {pat.email && (
                                <span className="flex items-center gap-1 truncate max-w-[200px]">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  {pat.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                          {pat.appointmentsCount} Consultation(s)
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div className="text-[11px] text-slate-500">
                          Last Visit: <span className="font-semibold text-slate-700">{formatDate(pat.lastAppointment?.date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {eligibleApt && (
                            <Link
                              to={`/doctor/prescriptions?appointmentId=${eligibleApt._id}`}
                              className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                              title="Issue Prescription"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Issue Rx</span>
                            </Link>
                          )}
                          <button
                            onClick={() => handleSelectPatient(pat)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                          >
                            <span>Clinical History</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ================= Patient Clinical Profile View ================= */
          <div className="space-y-6">
            {/* Patient Header Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center text-xl font-black shrink-0">
                  {selectedPatient.fullName?.charAt(0) || 'P'}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-black text-slate-900">
                      {selectedPatient.fullName || 'Patient Profile'}
                    </h2>
                    <span className="inline-flex items-center gap-1 text-[11px] text-teal-700 font-semibold bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                      Verified Patient
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3 pt-0.5">
                    {selectedPatient.gender && (
                      <span className="capitalize font-semibold text-slate-600">
                        Gender: {selectedPatient.gender}
                      </span>
                    )}
                    {selectedPatient.phone && (
                      <span>Phone: {selectedPatient.phone}</span>
                    )}
                    {selectedPatient.email && (
                      <span>Email: {selectedPatient.email}</span>
                    )}
                    {selectedPatient.city && (
                      <span>City: {selectedPatient.city}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action */}
              <div>
                {(() => {
                  const eligibleApt = getEligibleApt(selectedPatient._id);
                  if (eligibleApt) {
                    return (
                      <Link
                        to={`/doctor/prescriptions?appointmentId=${eligibleApt._id}`}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Issue Prescription</span>
                      </Link>
                    );
                  }
                  return (
                    <Link
                      to="/doctor/prescriptions"
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <span>Prescriptions View</span>
                    </Link>
                  );
                })()}
              </div>
            </div>

            {/* Profile Tabs Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-200">
              <button
                onClick={() => setActiveTab('prescriptions')}
                className={`pb-3 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 ${
                  activeTab === 'prescriptions'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Pill className="w-4 h-4" />
                <span>Prescriptions ({patientPrescriptions.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('appointments')}
                className={`pb-3 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 ${
                  activeTab === 'appointments'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Consultations ({getPatientAppointments(selectedPatient._id).length})</span>
              </button>

              <button
                onClick={() => setActiveTab('records')}
                className={`pb-3 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 ${
                  activeTab === 'records'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Medical Records ({patientRecords.length})</span>
              </button>
            </div>

            {detailError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{detailError}</span>
              </div>
            )}

            {detailLoading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-28 bg-slate-200 rounded-2xl" />
                ))}
              </div>
            ) : (
              <>
                {/* TAB 1: PRESCRIPTIONS */}
                {activeTab === 'prescriptions' && (
                  <div className="space-y-4">
                    {patientPrescriptions.length === 0 ? (
                      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-2">
                        <Pill className="w-8 h-8 text-slate-300" />
                        <h4 className="text-sm font-bold text-slate-800">No prescriptions on record for this patient</h4>
                        <p className="text-xs text-slate-500">
                          Digital prescriptions issued to this patient will be tracked here immutably.
                        </p>
                      </div>
                    ) : (
                      patientPrescriptions.map((rx) => {
                        const issuerName = rx.doctor?.fullName || 'Physician';
                        const isMyRx = rx.doctor?._id?.toString() === user?._id?.toString();
                        return (
                          <div
                            key={rx._id}
                            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-teal-300 transition"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                  RX #{rx._id.slice(-6).toUpperCase()}
                                </span>
                                <span className="text-xs text-slate-500 font-semibold">
                                  {formatDate(rx.createdAt)}
                                </span>
                                <span className="text-xs text-slate-400">•</span>
                                <span className="text-xs font-bold text-slate-700">
                                  Dr. {issuerName} {isMyRx && <span className="text-teal-600 font-bold">(You)</span>}
                                </span>
                              </div>

                              <div className="text-xs font-bold text-slate-900">
                                Diagnosis: <span className="font-semibold text-slate-700">{rx.clinicalAssessment}</span>
                              </div>

                              <div className="flex flex-wrap gap-2 text-[11px]">
                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                                  💊 {rx.medications?.length || 0} Medicine(s)
                                </span>
                                {rx.followUpDate && (
                                  <span className="bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded font-semibold">
                                    📅 Follow-up: {formatDate(rx.followUpDate)}
                                  </span>
                                )}
                                {rx.testsRecommended?.length > 0 && (
                                  <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-semibold">
                                    🧪 {rx.testsRecommended.length} Test(s) Ordered
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => setViewingRx(rx)}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shrink-0"
                            >
                              View Details
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* TAB 2: CONSULTATIONS / APPOINTMENTS */}
                {activeTab === 'appointments' && (
                  <div className="space-y-3">
                    {getPatientAppointments(selectedPatient._id).map((apt) => (
                      <div
                        key={apt._id}
                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-teal-600" />
                            <span className="font-bold text-slate-900">{formatDate(apt.date)}</span>
                            <span className="text-slate-400">•</span>
                            <Clock className="w-3.5 h-3.5 text-teal-600" />
                            <span className="text-slate-700">{formatTimeSlot(apt.timeSlot)}</span>
                          </div>
                          <div className="text-slate-600">
                            Mode: <span className="font-semibold capitalize">{apt.consultationType} Consultation</span>
                            {apt.reason && <span> — Reason: {apt.reason}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                              apt.status === 'completed'
                                ? 'bg-blue-100 text-blue-800'
                                : apt.status === 'confirmed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {apt.status}
                          </span>
                          {(apt.status === 'confirmed' || apt.status === 'completed') && (
                            <Link
                              to={`/doctor/prescriptions?appointmentId=${apt._id}`}
                              className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-[11px] font-bold transition"
                            >
                              Issue Rx
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB 3: MEDICAL RECORDS */}
                {activeTab === 'records' && (
                  <div className="space-y-3">
                    {patientRecords.length === 0 ? (
                      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs text-xs text-slate-500">
                        No general medical records uploaded yet for this patient.
                      </div>
                    ) : (
                      patientRecords.map((rec) => (
                        <div
                          key={rec._id}
                          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{rec.title}</span>
                            <span className="text-slate-400 text-[11px]">{formatDate(rec.createdAt || rec.date)}</span>
                          </div>
                          <p className="text-slate-600">{rec.summary}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Prescription Details View Modal */}
        {viewingRx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <span className="text-[10px] font-mono font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded border border-teal-200">
                    RX #{viewingRx._id.slice(-6).toUpperCase()}
                  </span>
                  <h3 className="text-base font-black text-slate-900 mt-1">Prescription Summary</h3>
                </div>
                <button
                  onClick={() => setViewingRx(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 space-y-6">
                {/* Patient & Doctor Meta */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Patient</p>
                    <p className="font-bold text-slate-800">{viewingRx.patient?.fullName || selectedPatient?.fullName}</p>
                    <p className="text-slate-500">{viewingRx.patient?.email || selectedPatient?.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Prescription Date</p>
                    <p className="font-semibold text-slate-800">{formatDate(viewingRx.createdAt)}</p>
                    <p className="text-slate-500">Dr. {viewingRx.doctor?.fullName || user?.fullName}</p>
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

                {/* Medications */}
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
                            <td className="p-3">{m.dosage}</td>
                            <td className="p-3">{m.frequency}</td>
                            <td className="p-3">{m.duration}</td>
                            <td className="p-3 text-slate-500">{m.instructions || 'After meals'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tests */}
                {viewingRx.testsRecommended?.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Recommended Diagnostic Tests
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {viewingRx.testsRecommended.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold"
                        >
                          🧪 {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Advice */}
                {viewingRx.advice && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Doctor Advice & Guidelines
                    </h4>
                    <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 whitespace-pre-line">
                      {viewingRx.advice}
                    </p>
                  </div>
                )}

                {/* Follow-up Date */}
                {viewingRx.followUpDate && (
                  <div className="text-xs text-slate-600 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>
                      Recommended Follow-up Date:{' '}
                      <span className="font-bold text-slate-900">{formatDate(viewingRx.followUpDate)}</span>
                    </span>
                  </div>
                )}
              </div>

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
      </div>
    </DashboardLayout>
  );
};

export default DoctorPatientsPage;
