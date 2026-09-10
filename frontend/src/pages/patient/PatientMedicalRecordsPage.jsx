import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import apiClient from '../../api/client';
import {
  FileText,
  Calendar,
  Search,
  Filter,
  Pill,
  Activity,
  Stethoscope,
  Clock,
  AlertCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export const PatientMedicalRecordsPage = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    fetchRecords();
  }, [filterType]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterType !== 'all') params.recordType = filterType;
      if (search.trim()) params.search = search.trim();

      const res = await apiClient.get('/medical/records', { params });
      if (res.data?.success) {
        setRecords(res.data.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load medical records.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRecords();
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'prescription':
        return <Pill className="w-4 h-4 text-teal-600" />;
      case 'test_report':
        return <Activity className="w-4 h-4 text-sky-600" />;
      case 'consultation':
        return <Stethoscope className="w-4 h-4 text-indigo-600" />;
      default:
        return <FileText className="w-4 h-4 text-slate-600" />;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'prescription':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'test_report':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'consultation':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <DashboardLayout title="Health History & Medical Records">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>Medical Records Timeline</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Unified digital health record aggregating your consultations, prescriptions, lab results, and clinical notes.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search records..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
            >
              Search
            </button>
          </form>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: 'all', label: 'All Records' },
            { id: 'prescription', label: 'Prescriptions' },
            { id: 'test_report', label: 'Lab Reports' },
            { id: 'consultation', label: 'Consultations' },
            { id: 'clinical_note', label: 'Clinical Notes' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                filterType === tab.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Timeline */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-28 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No medical records found</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Records are created automatically upon completed consultations, prescriptions, and lab tests.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((rec) => {
              const doc = rec.doctor || {};
              return (
                <div
                  key={rec._id}
                  onClick={() => setSelectedRecord(rec)}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:border-indigo-300 hover:shadow-sm transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                      {getTypeIcon(rec.recordType)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900">{rec.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${getTypeBadge(rec.recordType)}`}>
                          {rec.recordType?.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">{rec.summary}</p>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(rec.date || rec.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {doc.fullName && (
                          <span>• Attending: Dr. {doc.fullName}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs shrink-0 self-end sm:self-center">
                    <span>View Record</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Record Detail Modal */}
        {selectedRecord && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border mb-1.5 ${getTypeBadge(selectedRecord.recordType)}`}>
                    {selectedRecord.recordType?.replace('_', ' ')}
                  </span>
                  <h3 className="text-base font-black text-slate-900">{selectedRecord.title}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {new Date(selectedRecord.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-slate-900 block mb-1">Clinical Summary</span>
                <p>{selectedRecord.summary}</p>
              </div>

              {selectedRecord.details && Object.keys(selectedRecord.details).length > 0 && (
                <div className="text-xs space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="font-bold text-slate-900 block">Record Details</span>
                  {Object.entries(selectedRecord.details).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-slate-600">
                      <span className="capitalize">{k.replace(/([A-Z])/g, ' $1')}:</span>
                      <span className="font-semibold text-slate-800">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedRecord.documentUrl && (
                <a
                  href={selectedRecord.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:underline pt-1"
                >
                  <span>Open Attached Diagnostic File</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
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

export default PatientMedicalRecordsPage;
