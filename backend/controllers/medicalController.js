const path = require('path');
const fs = require('fs');
const Prescription = require('../models/Prescription');
const MedicalRecord = require('../models/MedicalRecord');
const TestReport = require('../models/TestReport');
const Appointment = require('../models/Appointment');
const { getIO } = require('../services/socketService');
const { createNotification } = require('../services/notificationService');
const { ROLES, APPOINTMENT_STATUS } = require('../config/constants');
const { escapeRegex } = require('../utils/security');

// ====================================================
// 1. PRESCRIPTIONS CONTROLLER
// ====================================================

/**
 * Doctor creates a prescription for a consultation appointment
 * POST /api/v1/medical/prescriptions
 * Access: Doctor
 */
const createPrescription = async (req, res, next) => {
  try {
    const {
      appointmentId,
      clinicalAssessment,
      medications,
      testsRecommended = [],
      advice = '',
      followUpDate = null
    } = req.body;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Appointment ID is required to issue a prescription.'
      });
    }

    if (!clinicalAssessment || typeof clinicalAssessment !== 'string' || clinicalAssessment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Clinical assessment / diagnosis is required.'
      });
    }

    if (!Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'At least one medication item is required.'
      });
    }

    // Validate medication items
    for (const med of medications) {
      if (!med.name || !med.dosage || !med.frequency || !med.duration) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Each medication must include name, dosage, frequency, and duration.'
        });
      }
    }

    // Verify appointment exists and doctor is authorized
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Consultation appointment not found.'
      });
    }

    if (appointment.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You are not the assigned doctor for this appointment.'
      });
    }

    // Verify appointment is an active confirmed or completed consultation
    const eligibleStatuses = [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.COMPLETED];
    if (!eligibleStatuses.includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        code: 'INELIGIBLE_APPOINTMENT_STATUS',
        message: `Prescriptions can only be issued for confirmed or completed consultations (current status: ${appointment.status}).`
      });
    }

    const patientId = appointment.patient;

    // 1. Save Prescription
    const prescription = await Prescription.create({
      patient: patientId,
      doctor: req.user._id,
      appointment: appointment._id,
      clinicalAssessment: clinicalAssessment.trim(),
      medications: medications.map(m => ({
        name: m.name.trim(),
        dosage: m.dosage.trim(),
        frequency: m.frequency.trim(),
        duration: m.duration.trim(),
        instructions: m.instructions ? m.instructions.trim() : 'After meals',
        price: Number(m.price) || 50
      })),
      testsRecommended: Array.isArray(testsRecommended) ? testsRecommended : [],
      advice: advice.trim(),
      followUpDate: followUpDate ? new Date(followUpDate) : null
    });

    // 2. Automatically create a MedicalRecord of type 'prescription'
    await MedicalRecord.create({
      patient: patientId,
      doctor: req.user._id,
      appointment: appointment._id,
      recordType: 'prescription',
      title: `Prescription: ${clinicalAssessment.slice(0, 40)}`,
      summary: `Prescribed ${medications.length} medication(s) by Dr. ${req.user.fullName}.`,
      details: {
        prescriptionId: prescription._id,
        medicationsCount: medications.length,
        testsCount: testsRecommended.length,
        advice: advice.trim()
      },
      date: new Date()
    });

    // 3. Automatically create TestReport placeholders for any recommended tests
    if (Array.isArray(testsRecommended) && testsRecommended.length > 0) {
      for (const testName of testsRecommended) {
        if (testName && typeof testName === 'string' && testName.trim()) {
          await TestReport.create({
            patient: patientId,
            doctor: req.user._id,
            appointment: appointment._id,
            testName: testName.trim(),
            status: 'recommended',
            date: new Date()
          });
        }
      }
    }

    // 4. Emit real-time notification to patient via Socket.IO and Notification model
    await createNotification({
      recipient: patientId,
      sender: req.user._id,
      type: 'new_prescription',
      title: 'New Prescription Issued',
      message: `Dr. ${req.user.fullName} has issued a new prescription for you.`,
      link: '/patient/prescriptions',
      data: { prescriptionId: prescription._id, appointmentId: appointment._id }
    });

    const io = getIO();
    if (io) {
      io.to(`user:${patientId.toString()}`).emit('prescription-notification', {
        prescriptionId: prescription._id,
        doctorName: req.user.fullName,
        clinicalAssessment: prescription.clinicalAssessment,
        createdAt: prescription.createdAt
      });
    }

    const populated = await Prescription.findById(prescription._id)
      .populate('doctor', 'fullName email phone')
      .populate('patient', 'fullName email phone dateOfBirth gender');

    res.status(201).json({
      success: true,
      message: 'Prescription created successfully.',
      data: populated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get prescriptions for current user
 * GET /api/v1/medical/prescriptions
 * Access: Patient or Doctor
 */
const getPrescriptions = async (req, res, next) => {
  try {
    const query = {};

    if (req.user.role === ROLES.PATIENT) {
      query.patient = req.user._id;
    } else if (req.user.role === ROLES.DOCTOR) {
      if (req.query.patientId) {
        // Doctor can access prescription history for patients they have consulted with
        const hasInteraction = await Appointment.findOne({
          doctor: req.user._id,
          patient: req.query.patientId
        });

        if (!hasInteraction) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'You can only view prescriptions for patients with an authorized consultation.'
          });
        }
        query.patient = req.query.patientId;
      } else {
        query.doctor = req.user._id;
      }
    } else if (req.user.role === ROLES.ADMIN) {
      // Admin can see all or filter by patient/doctor
      if (req.query.patientId) query.patient = req.query.patientId;
      if (req.query.doctorId) query.doctor = req.query.doctorId;
    } else {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Shipping partners cannot access clinical prescriptions.'
      });
    }

    const prescriptions = await Prescription.find(query)
      .populate('doctor', 'fullName avatar email phone')
      .populate('patient', 'fullName avatar email phone dateOfBirth gender')
      .populate('appointment', 'date timeSlot consultationType status')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: prescriptions.length,
      data: prescriptions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single prescription by ID
 * GET /api/v1/medical/prescriptions/:id
 * Access: Authenticated (Patient owner, Doctor issuer, or Admin)
 */
const getPrescriptionById = async (req, res, next) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('doctor', 'fullName avatar email phone')
      .populate('patient', 'fullName avatar email phone dateOfBirth gender city state')
      .populate('appointment', 'date timeSlot consultationType status reason');

    if (!prescription) {
      return res.status(404).json({
        success: false,
        code: 'PRESCRIPTION_NOT_FOUND',
        message: 'Prescription not found.'
      });
    }

    const isPatient = prescription.patient?._id.toString() === req.user._id.toString();
    const isDoctor = prescription.doctor?._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    let hasClinicalAccess = false;
    if (req.user.role === ROLES.DOCTOR && !isDoctor && prescription.patient) {
      const hasInteraction = await Appointment.findOne({
        doctor: req.user._id,
        patient: prescription.patient._id
      });
      if (hasInteraction) {
        hasClinicalAccess = true;
      }
    }

    if (!isPatient && !isDoctor && !isAdmin && !hasClinicalAccess) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Access denied to this prescription.'
      });
    }

    res.status(200).json({
      success: true,
      data: prescription
    });
  } catch (error) {
    next(error);
  }
};

// ====================================================
// 2. MEDICAL RECORDS CONTROLLER
// ====================================================

/**
 * Get medical records history for current patient
 * GET /api/v1/medical/records
 * Access: Patient, Doctor (for active patient), Admin
 */
const getMedicalRecords = async (req, res, next) => {
  try {
    const { recordType, search, patientId } = req.query;
    const query = {};

    if (req.user.role === ROLES.PATIENT) {
      query.patient = req.user._id;
    } else if (req.user.role === ROLES.DOCTOR) {
      if (patientId) {
        // Doctor can access records of patients they have consulted with
        const hasInteraction = await Appointment.findOne({
          doctor: req.user._id,
          patient: patientId
        });

        if (!hasInteraction) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'You can only view medical records for patients with an authorized consultation.'
          });
        }
        query.patient = patientId;
      } else {
        query.doctor = req.user._id;
      }
    } else if (req.user.role === ROLES.ADMIN) {
      if (patientId) query.patient = patientId;
    } else {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Shipping partners cannot access clinical medical records.'
      });
    }

    if (recordType && recordType !== 'all') {
      query.recordType = recordType;
    }

    if (search && search.trim()) {
      const escaped = escapeRegex(search.trim());
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { summary: { $regex: escaped, $options: 'i' } }
      ];
    }

    const records = await MedicalRecord.find(query)
      .populate('doctor', 'fullName avatar email')
      .populate('patient', 'fullName avatar email')
      .populate('appointment', 'date consultationType status')
      .sort({ date: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single medical record by ID
 * GET /api/v1/medical/records/:id
 * Access: Patient owner, Doctor, Admin
 */
const getMedicalRecordById = async (req, res, next) => {
  try {
    const record = await MedicalRecord.findById(req.params.id)
      .populate('doctor', 'fullName avatar email phone')
      .populate('patient', 'fullName avatar email phone dateOfBirth gender')
      .populate('appointment', 'date consultationType status');

    if (!record) {
      return res.status(404).json({
        success: false,
        code: 'RECORD_NOT_FOUND',
        message: 'Medical record not found.'
      });
    }

    const isPatient = record.patient?._id.toString() === req.user._id.toString();
    const isDoctor = record.doctor?._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Access denied to this medical record.'
      });
    }

    res.status(200).json({
      success: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor creates a clinical note or general medical record
 * POST /api/v1/medical/records
 * Access: Doctor
 */
const createMedicalRecord = async (req, res, next) => {
  try {
    const { patientId, appointmentId, title, summary, details = {}, recordType = 'clinical_note' } = req.body;

    if (!patientId || !title || !summary) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Patient ID, title, and summary are required.'
      });
    }

    if (req.user.role === ROLES.DOCTOR) {
      const hasInteraction = await Appointment.findOne({
        doctor: req.user._id,
        patient: patientId
      });
      if (!hasInteraction) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'You can only create records for patients with an authorized consultation.'
        });
      }
    }

    const record = await MedicalRecord.create({
      patient: patientId,
      doctor: req.user._id,
      appointment: appointmentId || null,
      recordType,
      title: title.trim(),
      summary: summary.trim(),
      details,
      date: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Medical record added successfully.',
      data: record
    });
  } catch (error) {
    next(error);
  }
};

// ====================================================
// 3. TEST REPORTS CONTROLLER
// ====================================================

/**
 * Get test reports list
 * GET /api/v1/medical/reports
 * Access: Patient or Doctor
 */
const getTestReports = async (req, res, next) => {
  try {
    const { status, category, patientId } = req.query;
    const query = {};

    if (req.user.role === ROLES.PATIENT) {
      query.patient = req.user._id;
    } else if (req.user.role === ROLES.DOCTOR) {
      if (patientId) {
        const hasInteraction = await Appointment.findOne({
          doctor: req.user._id,
          patient: patientId
        });
        if (!hasInteraction) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'You can only view reports for patients with an authorized consultation.'
          });
        }
        query.patient = patientId;
      } else {
        query.doctor = req.user._id;
      }
    } else if (req.user.role === ROLES.ADMIN) {
      if (patientId) query.patient = patientId;
    } else {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Shipping partners cannot access diagnostic lab reports.'
      });
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    const reports = await TestReport.find(query)
      .populate('doctor', 'fullName email phone')
      .populate('patient', 'fullName email phone')
      .populate('appointment', 'date consultationType')
      .sort({ date: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor recommends a diagnostic test for patient
 * POST /api/v1/medical/reports/recommend
 * Access: Doctor
 */
const recommendTest = async (req, res, next) => {
  try {
    const { patientId, appointmentId, testName, category = 'Other' } = req.body;

    if (!patientId || !testName || !testName.trim()) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Patient ID and test name are required.'
      });
    }

    if (req.user.role === ROLES.DOCTOR) {
      const hasInteraction = await Appointment.findOne({
        doctor: req.user._id,
        patient: patientId
      });
      if (!hasInteraction) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'You can only recommend tests for patients with an authorized consultation.'
        });
      }
    }

    const report = await TestReport.create({
      patient: patientId,
      doctor: req.user._id,
      appointment: appointmentId || null,
      testName: testName.trim(),
      category,
      status: 'recommended',
      date: new Date()
    });

    await createNotification({
      recipient: patientId,
      sender: req.user._id,
      type: 'test_recommendation',
      title: 'Diagnostic Test Recommended',
      message: `Dr. ${req.user.fullName} recommended test: ${testName.trim()}.`,
      link: '/patient/test-reports',
      data: { reportId: report._id, testName: report.testName }
    });

    res.status(201).json({
      success: true,
      message: 'Diagnostic test recommended successfully.',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Patient uploads a diagnostic test report document (PDF, JPG, PNG)
 * POST /api/v1/medical/reports/:id/upload
 * Access: Patient
 */
const uploadTestReport = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: 'FILE_REQUIRED',
        message: 'Please select a diagnostic report file to upload (PDF, JPEG, PNG max 5MB).'
      });
    }

    let report = await TestReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        code: 'REPORT_NOT_FOUND',
        message: 'Test report record not found.'
      });
    }

    // Verify patient owns this test report
    if (report.patient.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Access denied: You cannot upload reports for another patient.'
      });
    }

    // Store private streaming URL (NOT public static path!)
    const fileUrl = `/api/v1/medical/reports/${report._id}/file`;

    report.status = 'uploaded';
    report.reportFileUrl = fileUrl;
    report.reportFileName = req.file.filename;
    report.date = new Date();
    await report.save();

    // Auto-create medical record of type 'test_report'
    await MedicalRecord.create({
      patient: report.patient,
      doctor: report.doctor || null,
      appointment: report.appointment || null,
      recordType: 'test_report',
      title: `Lab Report: ${report.testName}`,
      summary: `Patient uploaded diagnostic report document for ${report.testName}.`,
      documentUrl: fileUrl,
      details: {
        testReportId: report._id,
        category: report.category,
        fileName: req.file.filename
      },
      date: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Diagnostic report uploaded successfully.',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Securely stream and download a sensitive medical report file
 * GET /api/v1/medical/reports/:id/file
 * Access: Authenticated (Patient owner, Doctor with interaction, or Admin)
 */
const getReportFile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const report = await TestReport.findById(id);
    if (!report || !report.reportFileUrl) {
      return res.status(404).json({
        success: false,
        code: 'FILE_NOT_FOUND',
        message: 'Report file not found.'
      });
    }

    // Access control
    const isPatient = report.patient.toString() === req.user._id.toString();
    const isDoctor = report.doctor ? report.doctor.toString() === req.user._id.toString() : false;
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Access denied to this sensitive medical file.'
      });
    }

    // Find the file on disk in uploads/reports
    const uploadDir = path.join(__dirname, '..', 'uploads', 'reports');
    if (!fs.existsSync(uploadDir)) {
      return res.status(404).json({
        success: false,
        code: 'FILE_NOT_FOUND',
        message: 'Reports storage directory is empty.'
      });
    }

    let filePath = null;
    if (report.reportFileName) {
      const safeName = path.basename(report.reportFileName);
      const candidatePath = path.join(uploadDir, safeName);
      if (fs.existsSync(candidatePath)) {
        filePath = candidatePath;
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        code: 'FILE_NOT_FOUND',
        message: 'Report file is not available on storage.'
      });
    }

    // Stream file with safe headers
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor reviews test report and adds clinical findings
 * PATCH /api/v1/medical/reports/:id/review
 * Access: Doctor
 */
const reviewTestReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { findings = '', reviewedNotes = '' } = req.body;

    const report = await TestReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        code: 'REPORT_NOT_FOUND',
        message: 'Test report not found.'
      });
    }

    if (report.doctor && report.doctor.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You are not authorized to review this report.'
      });
    }

    if (!report.doctor && req.user.role === ROLES.DOCTOR) {
      const hasInteraction = await Appointment.findOne({
        doctor: req.user._id,
        patient: report.patient
      });
      if (!hasInteraction) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'You can only review reports for patients with an authorized consultation.'
        });
      }
    }

    report.status = 'reviewed';
    report.findings = findings.trim();
    report.reviewedNotes = reviewedNotes.trim();
    await report.save();

    await createNotification({
      recipient: report.patient,
      sender: req.user._id,
      type: 'test_recommendation',
      title: 'Diagnostic Test Reviewed',
      message: `Dr. ${req.user.fullName} reviewed your lab report for ${report.testName}.`,
      link: '/patient/test-reports',
      data: { reportId: report._id, testName: report.testName }
    });

    res.status(200).json({
      success: true,
      message: 'Test report marked as reviewed.',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPrescription,
  getPrescriptions,
  getPrescriptionById,
  getMedicalRecords,
  getMedicalRecordById,
  createMedicalRecord,
  getTestReports,
  recommendTest,
  uploadTestReport,
  getReportFile,
  reviewTestReport
};
