import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import apiClient from '../../api/client';
import {
  ShieldCheck,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  AlertTriangle,
  Building,
  GraduationCap,
  Stethoscope,
  Save,
  Send
} from 'lucide-react';

const SPECIALIZATION_OPTIONS = [
  'General Physician', 'Cardiologist', 'Dermatologist', 'Neurologist',
  'Orthopedic', 'Pediatrician', 'Gynecologist', 'ENT Specialist',
  'Psychiatrist', 'Ophthalmologist', 'Dentist', 'Radiologist',
  'Surgeon', 'Urologist', 'Other'
];

const DEGREE_OPTIONS = [
  'MBBS', 'MBBS, MD', 'MBBS, MS', 'BDS', 'BAMS', 'BHMS', 'MCh', 'DM', 'Other'
];

const SKILL_OPTIONS = [
  'ECG', 'Telemedicine', 'ICU Care', 'Surgery', 'Emergency Care',
  'Diabetes Care', 'Heart Disease', 'Skin Treatment', 'MRI Analysis',
  'X-Ray Reading', 'Other'
];

export const DoctorVerificationPage = () => {
  const { user } = useAuth();

  const [profile, setProfile] = useState({
    medicalRegistrationNumber: '',
    highestDegree: 'MBBS',
    college: '',
    graduationYear: 2018,
    experienceYears: 5,
    specialization: 'General Physician',
    skills: ['Telemedicine', 'ECG'],
    hospitalName: '',
    hospitalAddress: '',
    consultationFee: 500,
    availableDays: ['Monday', 'Wednesday', 'Friday'],
    availableTime: { start: '09:00', end: '17:00' },
    consultationModes: ['chat', 'video', 'physical'],
    about: '',
    verificationStatus: 'draft',
    isVerified: false
  });

  const [files, setFiles] = useState({
    degreeCertificate: null,
    medicalLicense: null,
    aadhaarCard: null,
    other: null
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await apiClient.get('/doctors/profile/me');
      if (res.data?.data?.profile) {
        setProfile((prev) => ({
          ...prev,
          ...res.data.data.profile
        }));
      }
    } catch (err) {
      setErrorMsg('Failed to load doctor profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleFileChange = (e) => {
    setFiles({ ...files, [e.target.name]: e.target.files[0] });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await apiClient.put('/doctors/profile', profile);
      if (res.data && res.data.success) {
        setSuccessMsg('Clinical profile details saved successfully.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save clinical profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitVerification = async () => {
    setSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');

    if (!profile.medicalRegistrationNumber) {
      setSubmitting(false);
      return setErrorMsg('Please enter your Medical Registration Number before submitting verification.');
    }

    const formData = new FormData();
    if (files.degreeCertificate) formData.append('degreeCertificate', files.degreeCertificate);
    if (files.medicalLicense) formData.append('medicalLicense', files.medicalLicense);
    if (files.aadhaarCard) formData.append('aadhaarCard', files.aadhaarCard);
    if (files.other) formData.append('other', files.other);

    try {
      // First ensure profile fields are saved
      await apiClient.put('/doctors/profile', profile);

      // Then upload verification docs
      const res = await apiClient.post('/doctors/verification', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.success) {
        setSuccessMsg('Verification documents submitted for administrator review.');
        await fetchProfile();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Verification submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    const status = profile.verificationStatus || 'draft';
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>VERIFIED & APPROVED</span>
          </span>
        );
      case 'pending':
      case 'under_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>UNDER ADMIN REVIEW</span>
          </span>
        );
      case 'changes_requested':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <span>CHANGES REQUESTED</span>
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>SUSPENDED</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>REJECTED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <FileText className="w-4 h-4 text-slate-500" />
            <span>DRAFT / INCOMPLETE</span>
          </span>
        );
    }
  };

  return (
    <DashboardLayout title="Clinician Profile & Verification Pipeline">
      <div className="max-w-5xl space-y-6">
        {/* Status Header */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Credentials Verification Pipeline
            </div>
            <h1 className="text-xl font-black text-slate-900">Dr. {user?.fullName}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Only state-licensed clinicians verified by VitaLink Admin appear in search and receive appointments.
            </p>
          </div>
          <div>{getStatusBadge()}</div>
        </div>

        {successMsg && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Verification Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-8">
          {/* Section 1: Basic Clinical Credentials */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-teal-600" />
              <span>1. Basic Medical Registration & Specialty</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Medical Registration Number *
                </label>
                <input
                  type="text"
                  name="medicalRegistrationNumber"
                  required
                  value={profile.medicalRegistrationNumber}
                  onChange={handleTextChange}
                  placeholder="e.g. MCI-2015-89412"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Specialization *</label>
                <select
                  name="specialization"
                  value={profile.specialization}
                  onChange={handleTextChange}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 bg-white"
                >
                  {SPECIALIZATION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Years of Experience</label>
                <input
                  type="number"
                  name="experienceYears"
                  min="0"
                  value={profile.experienceYears}
                  onChange={handleTextChange}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Education */}
          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-sky-600" />
              <span>2. Qualifications & Education</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Highest Degree *</label>
                <select
                  name="highestDegree"
                  value={profile.highestDegree}
                  onChange={handleTextChange}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 bg-white"
                >
                  {DEGREE_OPTIONS.map((deg) => (
                    <option key={deg} value={deg}>{deg}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">College / University</label>
                <input
                  type="text"
                  name="college"
                  value={profile.college}
                  onChange={handleTextChange}
                  placeholder="e.g. AIIMS New Delhi"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Graduation Year</label>
                <input
                  type="number"
                  name="graduationYear"
                  value={profile.graduationYear}
                  onChange={handleTextChange}
                  placeholder="2018"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Hospital & Practice Fees */}
          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-600" />
              <span>3. Hospital Affiliation & Consultation Rates</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hospital / Clinic Name</label>
                <input
                  type="text"
                  name="hospitalName"
                  value={profile.hospitalName}
                  onChange={handleTextChange}
                  placeholder="e.g. Apollo Hospital"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hospital Address</label>
                <input
                  type="text"
                  name="hospitalAddress"
                  value={profile.hospitalAddress}
                  onChange={handleTextChange}
                  placeholder="e.g. Sector 62, Noida"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Consultation Fee (INR)</label>
                <input
                  type="number"
                  name="consultationFee"
                  min="0"
                  step="50"
                  value={profile.consultationFee}
                  onChange={handleTextChange}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">About Practitioner / Bio</label>
              <textarea
                name="about"
                rows="3"
                value={profile.about}
                onChange={handleTextChange}
                placeholder="Describe your clinical focus, specialties, and approach to patient care..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
          </div>

          {/* Section 4: Document Uploads */}
          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>4. Verification Documents (PDF, JPG, PNG - Max 5MB)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Medical Degree Certificate *
                </label>
                <input
                  type="file"
                  name="degreeCertificate"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                />
              </div>

              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  State Medical Council License *
                </label>
                <input
                  type="file"
                  name="medicalLicense"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                />
              </div>

              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Identity Verification (Aadhaar / Passport)
                </label>
                <input
                  type="file"
                  name="aadhaarCard"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Other Clinical Credentials / Certifications
                </label>
                <input
                  type="file"
                  name="other"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              * Sensitive documents are strictly encrypted and accessible only to verified VitaLink Administrators during credential review.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-slate-100 pt-6 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Save Draft</span>
            </button>

            <button
              type="button"
              onClick={handleSubmitVerification}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Documents...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit for Administrator Approval</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DoctorVerificationPage;
