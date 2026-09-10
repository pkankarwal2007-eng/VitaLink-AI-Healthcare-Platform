import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/common/Navbar';
import { Footer } from '../../components/common/Footer';
import apiClient from '../../api/client';
import {
  Stethoscope,
  ShieldCheck,
  Star,
  Clock,
  Building,
  Calendar,
  Search,
  Filter,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

const SPECIALIZATION_FILTERS = [
  'All Specialties', 'General Physician', 'Cardiologist', 'Dermatologist',
  'Neurologist', 'Orthopedic', 'Pediatrician', 'Gynecologist', 'ENT Specialist',
  'Psychiatrist', 'Ophthalmologist', 'Dentist', 'Radiologist', 'Surgeon', 'Urologist'
];

export const DoctorsPage = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All Specialties');
  const [sortBy, setSortBy] = useState('rating');

  useEffect(() => {
    fetchDoctors();
  }, [selectedSpecialty, sortBy]);

  const fetchDoctors = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedSpecialty !== 'All Specialties') {
        params.specialization = selectedSpecialty;
      }
      if (search.trim()) {
        params.search = search.trim();
      }
      if (sortBy) {
        params.sortBy = sortBy;
      }

      const res = await apiClient.get('/doctors', { params });
      if (res.data?.success) {
        setDoctors(res.data.data.doctors || []);
      }
    } catch (err) {
      setError('Unable to load verified doctors at this time. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDoctors();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-teal-900 text-white py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Verified Practitioner Network</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
            Consult Board-Verified Specialists
          </h1>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto">
            Every clinician on VitaLink has verified degrees and state medical council licenses. Book appointments for video, chat, or in-person clinic care.
          </p>

          {/* Search & Filter Bar */}
          <form onSubmit={handleSearchSubmit} className="max-w-3xl mx-auto mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by doctor name, hospital, or specialty..."
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 shadow-sm"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm shadow-md transition"
            >
              Search Doctors
            </button>
          </form>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-8">
        {/* Specialty Filter Pills & Sort Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {SPECIALIZATION_FILTERS.slice(0, 8).map((sp) => (
              <button
                key={sp}
                onClick={() => setSelectedSpecialty(sp)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                  selectedSpecialty === sp
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {sp}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-semibold text-slate-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              <option value="rating">Top Rated</option>
              <option value="experience">Most Experienced</option>
              <option value="fee_asc">Fee: Low to High</option>
              <option value="fee_desc">Fee: High to Low</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Doctor Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-64 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        ) : doctors.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
              <Stethoscope className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No verified specialists match your criteria</h3>
            <p className="text-xs text-slate-500 max-w-md mt-1 mb-6">
              VitaLink only shows state-certified, admin-approved doctors. Try expanding your search or selecting a different specialty.
            </p>
            <button
              onClick={() => { setSelectedSpecialty('All Specialties'); setSearch(''); }}
              className="px-4 py-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold hover:bg-sky-100"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors.map((doctor) => {
              const u = doctor.user || {};
              return (
                <div
                  key={doctor._id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-sky-300 shadow-sm hover:shadow-lg transition flex flex-col justify-between overflow-hidden"
                >
                  <div className="p-6 space-y-4">
                    {/* Top Row: Avatar & Verified Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt={u.fullName}
                            className="w-14 h-14 rounded-2xl object-cover object-top border border-teal-200 shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center text-xl font-black shrink-0">
                            {u.fullName?.charAt(0) || 'D'}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-slate-900 text-base leading-snug">
                              Dr. {u.fullName?.replace(/^dr\.\s*/i, '')}
                            </h3>
                            <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" title="Verified Practitioner" />
                          </div>
                          <p className="text-xs font-semibold text-teal-700">{doctor.specialization}</p>
                          <p className="text-[11px] text-slate-400">{doctor.highestDegree || doctor.college || 'Verified Specialist'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-800 text-xs font-bold shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{doctor.rating?.toFixed(1) || '5.0'}</span>
                      </div>
                    </div>

                    {/* Clinic & Experience Coordinates */}
                    <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{doctor.hospitalName || 'Clinical Health Centre'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{doctor.experienceYears || 0} Years Experience</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">Days: {doctor.availableDays?.slice(0, 3).join(', ')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Consultation Fee</span>
                      <span className="text-sm font-black text-slate-900">₹{doctor.consultationFee || 500}</span>
                    </div>
                    <Link
                      to={`/doctors/${doctor._id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm transition"
                    >
                      <span>View Profile</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default DoctorsPage;
