import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import apiClient from '../../api/client';
import {
  Pill,
  Calendar,
  User,
  ShieldCheck,
  AlertCircle,
  Clock,
  Printer,
  ShoppingBag,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';

export const PatientPrescriptionsPage = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const fetchPrescriptions = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/medical/prescriptions');
      if (res.data?.success) {
        setPrescriptions(res.data.data || []);
        if (res.data.data?.length > 0) {
          setExpandedId(res.data.data[0]._id);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load prescriptions.');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <DashboardLayout title="My Prescriptions">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Pill className="w-5 h-5 text-teal-600" />
              <span>Digital Clinical Prescriptions</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified clinical medications, dosage guidelines, and recommended diagnostics issued by your doctors.
            </p>
          </div>
          <Link
            to="/patient/doctors"
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition"
          >
            Consult a Specialist
          </Link>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2].map((n) => (
              <div key={n} className="h-44 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Pill className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No prescriptions on record</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Your digital prescriptions will appear here automatically following an authorized doctor consultation.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {prescriptions.map((p) => {
              const isExpanded = expandedId === p._id;
              const doc = p.doctor || {};

              return (
                <div
                  key={p._id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition"
                >
                  {/* Summary Bar */}
                  <div
                    onClick={() => toggleExpand(p._id)}
                    className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 transition"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center text-lg font-bold shrink-0">
                        {doc.fullName?.charAt(0) || 'D'}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-black text-slate-900">
                            Dr. {doc.fullName || 'Physician'}
                          </h3>
                          <span className="inline-flex items-center gap-1 text-[11px] text-teal-700 font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                            Verified Prescription
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-700">
                          {p.clinicalAssessment}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span>• {p.medications?.length || 0} Medication(s)</span>
                          {p.testsRecommended?.length > 0 && (
                            <span>• {p.testsRecommended.length} Test(s) Recommended</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to="/patient/orders"
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 text-xs font-bold flex items-center gap-1.5 border border-teal-200 shadow-2xs"
                        title="Order Medicines for Delivery"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{p.orderedForDelivery ? 'Track / Re-order' : 'Order Meds'}</span>
                      </Link>
                      <button
                        onClick={(e) => { e.stopPropagation(); window.print(); }}
                        className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1"
                        title="Print Prescription"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Print</span>
                      </button>
                      <div className="text-slate-400">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Prescription Details */}
                  {isExpanded && (
                    <div className="p-6 border-t border-slate-100 bg-slate-50/40 space-y-6">
                      {/* Medications Table */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Pill className="w-4 h-4 text-teal-600" />
                          <span>Prescribed Medications & Dosages</span>
                        </h4>

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-600 uppercase font-bold text-[10px] border-b border-slate-200">
                              <tr>
                                <th className="p-3">Medicine Name</th>
                                <th className="p-3">Dosage</th>
                                <th className="p-3">Frequency</th>
                                <th className="p-3">Duration</th>
                                <th className="p-3">Instructions</th>
                                <th className="p-3 text-right">Est. Price</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {p.medications?.map((m, mIdx) => (
                                <tr key={mIdx} className="hover:bg-slate-50/60">
                                  <td className="p-3 font-bold text-slate-900">{m.name}</td>
                                  <td className="p-3 font-semibold text-slate-700">{m.dosage}</td>
                                  <td className="p-3 text-slate-600">{m.frequency}</td>
                                  <td className="p-3 text-slate-600">{m.duration}</td>
                                  <td className="p-3 text-slate-500 italic">{m.instructions || 'After meals'}</td>
                                  <td className="p-3 font-bold text-slate-800 text-right">₹{m.price || 50}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Recommended Tests & Clinical Advice */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        {p.testsRecommended?.length > 0 && (
                          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Recommended Diagnostic Tests
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {p.testsRecommended.map((test, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="px-2.5 py-1 rounded-md bg-sky-50 text-sky-800 border border-sky-200 font-semibold text-xs"
                                >
                                  {test}
                                </span>
                              ))}
                            </div>
                            <Link
                              to="/patient/reports"
                              className="text-[11px] text-sky-600 font-bold hover:underline inline-block pt-1"
                            >
                              Upload test reports →
                            </Link>
                          </div>
                        )}

                        {p.advice && (
                          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Doctor Advice & Lifestyle Instructions
                            </span>
                            <p className="text-slate-700 leading-relaxed">{p.advice}</p>
                          </div>
                        )}
                      </div>

                      {/* Follow-up Note */}
                      {p.followUpDate && (
                        <div className="text-xs text-slate-600 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>
                            Recommended Follow-up Date:{' '}
                            <span className="font-bold text-slate-900">
                              {new Date(p.followUpDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientPrescriptionsPage;
