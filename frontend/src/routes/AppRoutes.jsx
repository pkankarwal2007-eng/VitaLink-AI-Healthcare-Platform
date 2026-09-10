import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from '../pages/public/LandingPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { EmailVerificationPage } from '../pages/auth/EmailVerificationPage';
import { AdminLoginPage } from '../pages/auth/AdminLoginPage';
import { DoctorsPage } from '../pages/public/DoctorsPage';
import { DoctorDetailPage } from '../pages/public/DoctorDetailPage';
import { PatientDashboard } from '../pages/patient/PatientDashboard';
import { AIAssistantPage } from '../pages/patient/AIAssistantPage';
import { PatientAppointmentsPage } from '../pages/patient/PatientAppointmentsPage';
import { PatientPrescriptionsPage } from '../pages/patient/PatientPrescriptionsPage';
import { PatientMedicalRecordsPage } from '../pages/patient/PatientMedicalRecordsPage';
import { PatientTestReportsPage } from '../pages/patient/PatientTestReportsPage';
import { PatientOrdersPage } from '../pages/patient/PatientOrdersPage';
import { DoctorDashboard } from '../pages/doctor/DoctorDashboard';
import { DoctorAppointmentsPage } from '../pages/doctor/DoctorAppointmentsPage';
import { DoctorVerificationPage } from '../pages/doctor/DoctorVerificationPage';
import { DoctorPrescriptionsPage } from '../pages/doctor/DoctorPrescriptionsPage';
import { DoctorMedicalRecordsPage } from '../pages/doctor/DoctorMedicalRecordsPage';
import { DoctorPatientsPage } from '../pages/doctor/DoctorPatientsPage';
import { ShippingDashboard } from '../pages/shipping/ShippingDashboard';
import { ShippingOrdersPage } from '../pages/shipping/ShippingOrdersPage';
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { AdminDoctorReviewPage } from '../pages/admin/AdminDoctorReviewPage';
import { AdminOrdersPage } from '../pages/admin/AdminOrdersPage';
import { ProfilePage } from '../pages/common/ProfilePage';
import { ChatConsultationPage } from '../pages/consultation/ChatConsultationPage';
import { VideoConsultationPage } from '../pages/consultation/VideoConsultationPage';
import { PhysicalConsultationPage } from '../pages/consultation/PhysicalConsultationPage';
import { ProtectedRoute, PatientRoute, DoctorRoute, ShippingRoute, AdminRoute } from './ProtectedRoute';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<EmailVerificationPage />} />
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />
      <Route path="/doctors" element={<DoctorsPage />} />
      <Route path="/doctors/:id" element={<DoctorDetailPage />} />

      {/* Patient Protected Routes */}
      <Route
        path="/patient"
        element={
          <PatientRoute>
            <PatientDashboard />
          </PatientRoute>
        }
      />
      <Route
        path="/patient/ai-assistant"
        element={
          <PatientRoute>
            <AIAssistantPage />
          </PatientRoute>
        }
      />
      <Route
        path="/patient/appointments"
        element={
          <PatientRoute>
            <PatientAppointmentsPage />
          </PatientRoute>
        }
      />
      <Route
        path="/patient/doctors"
        element={
          <PatientRoute>
            <DoctorsPage />
          </PatientRoute>
        }
      />
      <Route
        path="/patient/profile"
        element={
          <PatientRoute>
            <ProfilePage />
          </PatientRoute>
        }
      />
      <Route
        path="/patient/prescriptions"
        element={
          <PatientRoute>
            <PatientPrescriptionsPage />
          </PatientRoute>
        }
      />
      <Route
        path="/patient/records"
        element={
          <PatientRoute>
            <PatientMedicalRecordsPage />
          </PatientRoute>
        }
      />
      <Route
        path="/patient/reports"
        element={
          <PatientRoute>
            <PatientTestReportsPage />
          </PatientRoute>
        }
      />
      <Route
        path="/patient/orders"
        element={
          <PatientRoute>
            <PatientOrdersPage />
          </PatientRoute>
        }
      />
      <Route
        path="/patient/*"
        element={
          <PatientRoute>
            <PatientDashboard />
          </PatientRoute>
        }
      />

      {/* Doctor Protected Routes */}
      <Route
        path="/doctor"
        element={
          <DoctorRoute>
            <DoctorDashboard />
          </DoctorRoute>
        }
      />
      <Route
        path="/doctor/appointments"
        element={
          <DoctorRoute>
            <DoctorAppointmentsPage />
          </DoctorRoute>
        }
      />
      <Route
        path="/doctor/verification"
        element={
          <DoctorRoute>
            <DoctorVerificationPage />
          </DoctorRoute>
        }
      />
      <Route
        path="/doctor/patients"
        element={
          <DoctorRoute>
            <DoctorPatientsPage />
          </DoctorRoute>
        }
      />
      <Route
        path="/doctor/prescriptions"
        element={
          <DoctorRoute>
            <DoctorPrescriptionsPage />
          </DoctorRoute>
        }
      />
      <Route
        path="/doctor/records"
        element={
          <DoctorRoute>
            <DoctorMedicalRecordsPage />
          </DoctorRoute>
        }
      />
      <Route
        path="/doctor/profile"
        element={
          <DoctorRoute>
            <ProfilePage />
          </DoctorRoute>
        }
      />
      <Route
        path="/doctor/*"
        element={
          <DoctorRoute>
            <DoctorDashboard />
          </DoctorRoute>
        }
      />

      {/* Shipping Protected Routes */}
      <Route
        path="/shipping"
        element={
          <ShippingRoute>
            <ShippingDashboard />
          </ShippingRoute>
        }
      />
      <Route
        path="/shipping/orders"
        element={
          <ShippingRoute>
            <ShippingOrdersPage />
          </ShippingRoute>
        }
      />
      <Route
        path="/shipping/active"
        element={
          <ShippingRoute>
            <ShippingOrdersPage />
          </ShippingRoute>
        }
      />
      <Route
        path="/shipping/history"
        element={
          <ShippingRoute>
            <ShippingOrdersPage />
          </ShippingRoute>
        }
      />
      <Route
        path="/shipping/profile"
        element={
          <ShippingRoute>
            <ProfilePage />
          </ShippingRoute>
        }
      />
      <Route
        path="/shipping/*"
        element={
          <ShippingRoute>
            <ShippingDashboard />
          </ShippingRoute>
        }
      />

      {/* Admin Protected Routes (STRICTLY PRIVATE) */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/doctors/pending"
        element={
          <AdminRoute>
            <AdminDoctorReviewPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/orders"
        element={
          <AdminRoute>
            <AdminOrdersPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/profile"
        element={
          <AdminRoute>
            <ProfilePage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/*"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />

      {/* Active Consultation Routes (Patient & Doctor) */}
      <Route
        path="/consultations/chat/:appointmentId"
        element={
          <ProtectedRoute allowedRoles={['patient', 'doctor', 'admin']}>
            <ChatConsultationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/consultations/video/:appointmentId"
        element={
          <ProtectedRoute allowedRoles={['patient', 'doctor', 'admin']}>
            <VideoConsultationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/consultations/physical/:appointmentId"
        element={
          <ProtectedRoute allowedRoles={['patient', 'doctor', 'admin']}>
            <PhysicalConsultationPage />
          </ProtectedRoute>
        }
      />

      {/* Default Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
