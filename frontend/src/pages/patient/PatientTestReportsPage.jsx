import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Activity,
  FileText,
  Upload,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Filter,
  User,
  X
} from 'lucide-react';

export const PatientTestReportsPage = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // all, recommended, uploaded, reviewed

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Secure download/view state
  const [viewingFileId, setViewingFileId] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get('/medical/reports');
      if (res.data?.success) {
        setReports(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load test reports:', err);
      setError(err.response?.data?.message || 'Failed to load test reports.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUpload = (report) => {
    setSelectedReport(report);
    setUploadFile(null);
    setUploadNotes('');
    setUploadError(null);
    setUploadModalOpen(true);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a file to upload (PDF, JPEG, PNG max 5MB).');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      const formData = new FormData();
      formData.append('report', uploadFile);
      if (uploadNotes) {
        formData.append('notes', uploadNotes);
      }

      const res = await apiClient.post(`/medical/reports/${selectedReport._id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        setSuccessMsg(`Test report for "${selectedReport.testName}" uploaded successfully!`);
        setUploadModalOpen(false);
        fetchReports();
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError(err.response?.data?.message || 'File upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleViewReport = async (reportId) => {
    try {
      setViewingFileId(reportId);
      const token = localStorage.getItem('vitalink_token');
      const response = await fetch(`http://localhost:5000/api/v1/medical/reports/${reportId}/file`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || 'Unauthorized or failed to download report file.');
      }

      const blob = await response.blob();
      const fileUrl = window.URL.createObjectURL(blob);
      window.open(fileUrl, '_blank');
    } catch (err) {
      alert(err.message || 'Failed to view report file.');
    } finally {
      setViewingFileId(null);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (activeTab === 'all') return true;
    return r.status === activeTab;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'recommended':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 mr-1.5 bg-amber-500 rounded-full animate-pulse"></span>
            Pending Upload
          </span>
        );
      case 'uploaded':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
            <span className="w-1.5 h-1.5 mr-1.5 bg-sky-500 rounded-full"></span>
            Uploaded (Awaiting Review)
          </span>
        );
      case 'reviewed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            Reviewed by Doctor
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <DashboardLayout title="Diagnostic Test Reports">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-600" />
              <span>Diagnostic & Test Reports</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Securely track recommended diagnostic investigations, upload lab findings, and review doctor evaluations.
            </p>
          </div>
          <button
            onClick={fetchReports}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shadow-xs transition"
          >
            Refresh
          </button>
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

        {/* Filter Tabs */}
        <div className="flex border-b border-slate-200 space-x-2">
          {[
            { key: 'all', label: `All Reports (${reports.length})` },
            { key: 'recommended', label: `Pending Upload (${reports.filter(r => r.status === 'recommended').length})` },
            { key: 'uploaded', label: `Uploaded (${reports.filter(r => r.status === 'uploaded').length})` },
            { key: 'reviewed', label: `Doctor Reviewed (${reports.filter(r => r.status === 'reviewed').length})` }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-teal-600 text-teal-700 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2].map(n => (
              <div key={n} className="h-44 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Activity className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No test reports in this category</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              When doctors recommend diagnostic tests during your consultations, they will appear here ready for sample submission or upload.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReports.map((report) => (
              <div
                key={report._id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-teal-300 transition p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-100 px-2.5 py-0.5 rounded-md">
                      {report.category || 'Diagnostic'}
                    </span>
                    {getStatusBadge(report.status)}
                  </div>

                  <h3 className="text-base font-black text-slate-900 mb-1">
                    {report.testName}
                  </h3>

                  <p className="text-[11px] text-slate-400 mb-4 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    Ordered on {new Date(report.date || report.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>

                  {report.doctor && (
                    <div className="flex items-center gap-2 mb-4 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 font-bold flex items-center justify-center text-xs">
                        Dr
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          Dr. {report.doctor.fullName || 'Consulting Physician'}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {report.doctor.email}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Doctor Review Notes */}
                  {report.reviewedNotes && (
                    <div className="mb-4 text-xs bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                      <span className="font-bold text-emerald-800 flex items-center gap-1 mb-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Doctor Assessment Notes
                      </span>
                      <p className="text-emerald-900 text-xs">{report.reviewedNotes}</p>
                      {report.reviewedAt && (
                        <p className="text-[10px] text-emerald-700 mt-1">
                          Reviewed on {new Date(report.reviewedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  {report.status === 'recommended' ? (
                    <button
                      onClick={() => handleOpenUpload(report)}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs shadow-xs transition"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Report Document
                    </button>
                  ) : (
                    <button
                      onClick={() => handleViewReport(report._id)}
                      disabled={viewingFileId === report._id}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition disabled:opacity-50"
                    >
                      {viewingFileId === report._id ? (
                        <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ExternalLink className="w-4 h-4 text-slate-600" />
                      )}
                      View Report Securely
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Modal */}
        {uploadModalOpen && selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-teal-600" />
                  Upload Diagnostic Report
                </h3>
                <button
                  onClick={() => setUploadModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Diagnostic Test
                  </label>
                  <div className="p-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-800 border border-slate-200">
                    {selectedReport.testName} ({selectedReport.category || 'General'})
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Attach Report File (PDF, JPEG, PNG max 5MB) *
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setUploadFile(e.target.files[0] || null)}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer border border-slate-200 rounded-xl p-1.5"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Observation Notes / Lab Details (Optional)
                  </label>
                  <textarea
                    rows="3"
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    placeholder="e.g. Sample collected at local diagnostic center. Normal fasting glucose."
                    className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                  ></textarea>
                </div>

                {uploadError && (
                  <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setUploadModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 hover:bg-slate-50 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {uploading && (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    Submit & Upload
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

export default PatientTestReportsPage;
