import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  Activity,
  Calendar,
  Search,
  Filter,
  Pill,
  Stethoscope,
  Clock,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  User,
  X
} from 'lucide-react';

export const DoctorMedicalRecordsPage = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(null);
  const [reviewError, setReviewError] = useState(null);

  useEffect(() => {
    fetchMedicalData();
  }, [filterType]);

  const fetchMedicalData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (filterType !== 'all') params.recordType = filterType;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const [recRes, repRes] = await Promise.all([
        apiClient.get('/medical/records', { params }),
        apiClient.get('/medical/reports')
      ]);

      if (recRes.data?.success) {
        setRecords(recRes.data.data || []);
      }
      if (repRes.data?.success) {
        setReports(repRes.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load clinical records:', err);
      setError(err.response?.data?.message || 'Failed to load medical records.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchMedicalData();
  };

  const handleOpenReviewModal = (report) => {
    setSelectedReport(report);
    setReviewNotes(report.reviewedNotes || '');
    setReviewError(null);
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewNotes.trim()) {
      setReviewError('Please enter clinical evaluation / review notes.');
      return;
    }

    try {
      setReviewing(true);
      setReviewError(null);
      const res = await apiClient.patch(`/medical/reports/${selectedReport._id}/review`, {
        reviewedNotes: reviewNotes.trim()
      });

      if (res.data?.success) {
        setReviewSuccess(`Diagnostic report for "${selectedReport.testName}" marked as reviewed.`);
        setReviewModalOpen(false);
        fetchMedicalData();
        setTimeout(() => setReviewSuccess(null), 5000);
      }
    } catch (err) {
      console.error('Review failed:', err);
      setReviewError(err.response?.data?.message || 'Failed to submit review notes.');
    } finally {
      setReviewing(false);
    }
  };

  const handleViewFile = async (reportId) => {
    try {
      const token = localStorage.getItem('vitalink_token');
      const response = await fetch(`http://localhost:5000/api/v1/medical/reports/${reportId}/file`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Unauthorized or file missing.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      alert(err.message || 'Failed to view report file.');
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'consultation':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Consultation</span>;
      case 'prescription':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Prescription</span>;
      case 'test_report':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Test Report</span>;
      case 'clinical_note':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Clinical Note</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{type}</span>;
    }
  };

  return (
    <DashboardLayout title="Medical Records & Reviews">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-600" />
              <span>Patient Medical Records & Reports Review</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Securely access clinical history, view patient records, and review submitted diagnostic test files.
            </p>
          </div>
          <button
            onClick={fetchMedicalData}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shadow-xs transition"
          >
            Refresh
          </button>
        </div>

        {reviewSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{reviewSuccess}</span>
            </div>
            <button onClick={() => setReviewSuccess(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">✕</button>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Pending Lab Reviews Banner */}
        {reports.filter(r => r.status === 'uploaded').length > 0 && (
          <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
              <h2 className="text-sm font-black text-amber-900">
                Action Required: Pending Lab Report Reviews ({reports.filter(r => r.status === 'uploaded').length})
              </h2>
            </div>
            <p className="text-xs text-amber-700 mb-4">
              Patients have uploaded diagnostic findings for your authorized review.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports.filter(r => r.status === 'uploaded').map(rep => (
                <div key={rep._id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800 truncate">{rep.testName}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                      Needs Review
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-2">
                    Patient: <span className="font-semibold text-slate-800">{rep.patient?.fullName || 'Patient'}</span>
                  </p>
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleViewFile(rep._id)}
                      className="flex-1 py-1.5 px-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-center transition"
                    >
                      View File
                    </button>
                    <button
                      onClick={() => handleOpenReviewModal(rep)}
                      className="flex-1 py-1.5 px-2 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-center shadow-xs transition"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {[
              { key: 'all', label: 'All Records' },
              { key: 'consultation', label: 'Consultations' },
              { key: 'prescription', label: 'Prescriptions' },
              { key: 'test_report', label: 'Test Reports' },
              { key: 'clinical_note', label: 'Clinical Notes' }
            ].map(type => (
              <button
                key={type.key}
                onClick={() => setFilterType(type.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterType === type.key
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:w-auto">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search records..."
              className="w-full md:w-60 px-3 py-1.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
            >
              Search
            </button>
          </form>
        </div>

        {/* Records List */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2].map(n => (
              <div key={n} className="h-44 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No medical records match this filter</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Clinical records and consultation summaries for your patients will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((rec) => (
              <div
                key={rec._id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-teal-300 transition flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-3">
                    {getTypeBadge(rec.recordType)}
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {new Date(rec.date || rec.createdAt).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-black text-slate-900">{rec.title}</h3>
                    <span className="text-xs text-slate-500">
                      (Patient: <span className="font-semibold text-slate-800">{rec.patient?.fullName || 'Patient'}</span>)
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">{rec.summary}</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedRecord(rec)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Record Details Modal */}
        {selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {getTypeBadge(selectedRecord.recordType)}
                    <span className="text-[10px] text-slate-400">
                      {new Date(selectedRecord.date || selectedRecord.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900">{selectedRecord.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                  <p><span className="font-semibold text-slate-700">Patient: </span>{selectedRecord.patient?.fullName} ({selectedRecord.patient?.email})</p>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Summary</h4>
                  <p className="text-xs font-medium text-slate-800 bg-teal-50/40 p-3 rounded-xl border border-teal-100">
                    {selectedRecord.summary}
                  </p>
                </div>

                {selectedRecord.details && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Clinical Details</h4>
                    <pre className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 overflow-x-auto whitespace-pre-wrap font-sans">
                      {typeof selectedRecord.details === 'object'
                        ? JSON.stringify(selectedRecord.details, null, 2)
                        : selectedRecord.details}
                    </pre>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Review Modal */}
        {reviewModalOpen && selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-teal-600" />
                  Review Diagnostic Test Report
                </h3>
                <button
                  onClick={() => setReviewModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitReview} className="mt-4 space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                  <p><span className="font-semibold text-slate-700">Test: </span>{selectedReport.testName} ({selectedReport.category})</p>
                  <p><span className="font-semibold text-slate-700">Patient: </span>{selectedReport.patient?.fullName}</p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Doctor Assessment & Evaluation Notes *
                  </label>
                  <textarea
                    rows="4"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="e.g. Findings indicate normal lipid profile. Patient advised to continue current dietary regimen and repeat in 6 months."
                    className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                    required
                  ></textarea>
                </div>

                {reviewError && (
                  <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{reviewError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setReviewModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 hover:bg-slate-50 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reviewing}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {reviewing && (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    Save & Mark Reviewed
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

export default DoctorMedicalRecordsPage;
