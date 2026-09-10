import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import apiClient from '../../api/client';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Clock,
  User,
  Building,
  GraduationCap,
  Ban,
  Search,
  ExternalLink
} from 'lucide-react';

export const AdminDoctorReviewPage = () => {
  const { user } = useAuth();
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchPendingVerifications();
  }, []);

  const fetchPendingVerifications = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/doctors/pending');
      if (res.data && res.data.success) {
        setVerifications(res.data.data.verifications || []);
      }
    } catch (err) {
      setStatusMessage({ text: 'Failed to load verification queue.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (doctorId) => {
    setActionLoading(doctorId);
    setStatusMessage({ text: '', type: '' });

    try {
      const res = await apiClient.patch(`/admin/doctors/${doctorId}/approve`, {
        adminNotes: adminNotes || 'Approved by administrator'
      });
      if (res.data?.success) {
        setStatusMessage({ text: 'Doctor approved successfully. Status set to Verified.', type: 'success' });
        setAdminNotes('');
        setSelectedVerification(null);
        await fetchPendingVerifications();
      }
    } catch (err) {
      setStatusMessage({ text: err.response?.data?.message || 'Approval failed.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (doctorId) => {
    if (!adminNotes.trim()) {
      return alert('Please enter a rejection reason in the notes field before rejecting.');
    }

    setActionLoading(doctorId);
    try {
      const res = await apiClient.patch(`/admin/doctors/${doctorId}/reject`, {
        reason: adminNotes
      });
      if (res.data?.success) {
        setStatusMessage({ text: 'Doctor verification rejected.', type: 'success' });
        setAdminNotes('');
        setSelectedVerification(null);
        await fetchPendingVerifications();
      }
    } catch (err) {
      setStatusMessage({ text: err.response?.data?.message || 'Rejection failed.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestChanges = async (doctorId) => {
    if (!adminNotes.trim()) {
      return alert('Please enter the required changes in the notes field.');
    }

    setActionLoading(doctorId);
    try {
      const res = await apiClient.patch(`/admin/doctors/${doctorId}/request-changes`, {
        notes: adminNotes
      });
      if (res.data?.success) {
        setStatusMessage({ text: 'Changes requested from practitioner.', type: 'success' });
        setAdminNotes('');
        setSelectedVerification(null);
        await fetchPendingVerifications();
      }
    } catch (err) {
      setStatusMessage({ text: err.response?.data?.message || 'Failed to request changes.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <DashboardLayout title="Doctor Credential Verification Queue">
      <div className="max-w-6xl space-y-6">
        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 mb-1">
              Regulatory Review Console
            </div>
            <h1 className="text-xl font-black">Doctor Verification Requests</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Review degrees, council registration numbers, and identity documents before public listing.
            </p>
          </div>
          <button
            onClick={fetchPendingVerifications}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition"
          >
            Refresh Queue
          </button>
        </div>

        {statusMessage.text && (
          <div
            className={`flex items-center gap-2.5 p-4 rounded-xl text-xs font-semibold ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Verification Queue Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Pending Submissions ({verifications.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
              Loading credential submissions from MongoDB Atlas...
            </div>
          ) : verifications.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Verification Queue Clear</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                There are currently no doctor credential submissions pending administrative review.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {verifications.map((item) => {
                const doctorUser = item.doctor || {};
                const profile = item.doctorProfile || {};
                const isSelected = selectedVerification?._id === item._id;

                return (
                  <div key={item._id} className="p-6 hover:bg-slate-50/60 transition">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <h3 className="text-base font-bold text-slate-900">
                            Dr. {doctorUser.fullName || 'Unknown Practitioner'}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                            {item.status}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                          <span className="font-semibold text-teal-700">
                            Reg #: {profile.medicalRegistrationNumber || 'Not provided'}
                          </span>
                          <span>•</span>
                          <span>Specialty: {profile.specialization || 'General'}</span>
                          <span>•</span>
                          <span>Degree: {profile.highestDegree || 'MBBS'}</span>
                          <span>•</span>
                          <span>Hospital: {profile.hospitalName || 'Independent'}</span>
                        </div>

                        <div className="text-[11px] text-slate-400">
                          Submitted: {new Date(item.submittedAt).toLocaleString()} • {item.documents?.length || 0} document(s) attached
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedVerification(isSelected ? null : item)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          {isSelected ? 'Close Details' : 'Inspect Credentials'}
                        </button>
                      </div>
                    </div>

                    {/* Detailed Document Inspection Box */}
                    {isSelected && (
                      <div className="mt-5 p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">University</span>
                            <span className="font-bold text-slate-800">{profile.college || '—'}</span>
                          </div>
                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Experience</span>
                            <span className="font-bold text-slate-800">{profile.experienceYears || 0} Years</span>
                          </div>
                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Consultation Rate</span>
                            <span className="font-bold text-slate-800">₹{profile.consultationFee || 500}</span>
                          </div>
                        </div>

                        {/* Uploaded Documents List */}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                            Submitted Legal & Educational Documents:
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {item.documents && item.documents.length > 0 ? (
                              item.documents.map((doc, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 text-xs"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                                    <span className="font-medium text-slate-800 capitalize truncate">
                                      {doc.docType.replace('_', ' ')}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 bg-slate-100 rounded">
                                    Encrypted
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-slate-400">No documents uploaded with submission.</p>
                            )}
                          </div>
                        </div>

                        {/* Admin Action Notes */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Administrator Review Notes (Required for Rejection/Changes):
                          </label>
                          <textarea
                            rows="2"
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder="Add compliance notes, license verification confirmation, or rejection reason..."
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 bg-white font-mono"
                          />
                        </div>

                        {/* Decision Buttons */}
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleRequestChanges(doctorUser._id)}
                            disabled={actionLoading === doctorUser._id}
                            className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold border border-blue-200"
                          >
                            Request Changes
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReject(doctorUser._id)}
                            disabled={actionLoading === doctorUser._id}
                            className="px-4 py-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold border border-rose-200"
                          >
                            Reject Application
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApprove(doctorUser._id)}
                            disabled={actionLoading === doctorUser._id}
                            className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm"
                          >
                            {actionLoading === doctorUser._id ? 'Processing...' : 'Approve & Verify Doctor'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDoctorReviewPage;
