const mongoose = require('mongoose');
const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const MedicineOrder = require('../models/MedicineOrder');
const MedicalRecord = require('../models/MedicalRecord');
const TestReport = require('../models/TestReport');
const Review = require('../models/Review');
const { ROLES, VERIFICATION_STATUS, APPOINTMENT_STATUS, ORDER_STATUS } = require('../config/constants');

/**
 * Get comprehensive platform-wide analytics
 * GET /api/v1/analytics/admin
 * Access: Admin
 */
const getAdminAnalytics = async (req, res, next) => {
  try {
    const [
      totalPatients,
      totalDoctors,
      verifiedDoctors,
      pendingDoctors,
      shippingPartners,
      totalAppointments,
      completedAppointments,
      appointmentsByType,
      totalOrders,
      deliveredOrders,
      appointmentRevenueResult,
      ordersRevenueResult,
      totalPrescriptions,
      totalRecords,
      totalTestReports,
      totalReviews
    ] = await Promise.all([
      User.countDocuments({ role: ROLES.PATIENT }),
      User.countDocuments({ role: ROLES.DOCTOR }),
      DoctorProfile.countDocuments({ verificationStatus: VERIFICATION_STATUS.APPROVED }),
      DoctorProfile.countDocuments({
        verificationStatus: { $in: [VERIFICATION_STATUS.PENDING, VERIFICATION_STATUS.UNDER_REVIEW] }
      }),
      User.countDocuments({ role: ROLES.SHIPPING }),
      Appointment.countDocuments(),
      Appointment.countDocuments({ status: APPOINTMENT_STATUS.COMPLETED }),
      Appointment.aggregate([
        {
          $group: {
            _id: '$consultationType',
            count: { $sum: 1 }
          }
        }
      ]),
      MedicineOrder.countDocuments(),
      MedicineOrder.countDocuments({ status: ORDER_STATUS.DELIVERED }),
      Appointment.aggregate([
        { $match: { status: APPOINTMENT_STATUS.COMPLETED } },
        { $group: { _id: null, total: { $sum: '$fee' } } }
      ]),
      MedicineOrder.aggregate([
        { $match: { status: ORDER_STATUS.DELIVERED } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Prescription.countDocuments(),
      MedicalRecord.countDocuments(),
      TestReport.countDocuments(),
      Review.countDocuments()
    ]);

    const consultationRevenue = appointmentRevenueResult[0]?.total || 0;
    const medicineSalesRevenue = ordersRevenueResult[0]?.total || 0;
    const totalPlatformRevenue = consultationRevenue + medicineSalesRevenue;

    const consultationTypes = { chat: 0, video: 0, physical: 0 };
    appointmentsByType.forEach(item => {
      if (consultationTypes[item._id] !== undefined) {
        consultationTypes[item._id] = item.count;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalPatients,
          totalDoctors,
          verifiedDoctors,
          pendingVerifications: pendingDoctors,
          totalShippingPartners: shippingPartners,
          totalAppointments,
          completedAppointments,
          appointmentCompletionRate: totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0,
          totalOrders,
          deliveredOrders,
          orderFulfillmentRate: totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0,
          totalRevenue: totalPlatformRevenue,
          totalPrescriptions,
          totalRecords,
          totalTestReports,
          totalReviews
        },
        users: {
          patients: totalPatients,
          doctors: totalDoctors,
          verifiedDoctors,
          pendingDoctors,
          shippingPartners,
          totalUsers: totalPatients + totalDoctors + shippingPartners
        },
        consultations: {
          total: totalAppointments,
          completed: completedAppointments,
          completionRate: totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0,
          types: consultationTypes
        },
        appointmentsByType: consultationTypes,
        logistics: {
          totalOrders,
          deliveredOrders,
          fulfillmentRate: totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0
        },
        financials: {
          consultationRevenue,
          medicineSalesRevenue,
          totalPlatformRevenue,
          currency: 'INR'
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get practice and consultation analytics for authenticated doctor
 * GET /api/v1/analytics/doctor
 * Access: Doctor
 */
const getDoctorAnalytics = async (req, res, next) => {
  try {
    const doctorId = req.user._id;

    const [
      uniquePatients,
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      prescriptionsCount,
      revenueResult,
      profile,
      reviewStats,
      appointmentsByTypeAgg,
      recordsCount
    ] = await Promise.all([
      Appointment.distinct('patient', { doctor: doctorId }),
      Appointment.countDocuments({ doctor: doctorId }),
      Appointment.countDocuments({ doctor: doctorId, status: APPOINTMENT_STATUS.COMPLETED }),
      Appointment.countDocuments({ doctor: doctorId, status: APPOINTMENT_STATUS.CANCELLED }),
      Prescription.countDocuments({ doctor: doctorId }),
      Appointment.aggregate([
        { $match: { doctor: doctorId, status: APPOINTMENT_STATUS.COMPLETED } },
        { $group: { _id: null, total: { $sum: '$fee' } } }
      ]),
      DoctorProfile.findOne({ user: doctorId }).select('rating reviewCount consultationFee'),
      Review.aggregate([
        { $match: { doctor: doctorId } },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 }
          }
        }
      ]),
      Appointment.aggregate([
        { $match: { doctor: doctorId } },
        {
          $group: {
            _id: '$consultationType',
            count: { $sum: 1 }
          }
        }
      ]),
      MedicalRecord.countDocuments({ doctor: doctorId })
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviewStats.forEach(item => {
      if (ratingDistribution[item._id] !== undefined) {
        ratingDistribution[item._id] = item.count;
      }
    });

    const consultationTypes = { chat: 0, video: 0, physical: 0 };
    appointmentsByTypeAgg.forEach(item => {
      if (consultationTypes[item._id] !== undefined) {
        consultationTypes[item._id] = item.count;
      }
    });

    const upcomingAppointments = Math.max(0, totalAppointments - completedAppointments - cancelledAppointments);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalAppointments,
          completedAppointments,
          upcomingAppointments,
          cancelledAppointments,
          totalPrescriptions: prescriptionsCount,
          totalRecords: recordsCount,
          uniquePatients: uniquePatients.length,
          averageRating: profile?.rating || 5.0,
          reviewCount: profile?.reviewCount || 0,
          estimatedEarnings: totalRevenue
        },
        patients: {
          totalUniquePatients: uniquePatients.length
        },
        appointments: {
          total: totalAppointments,
          completed: completedAppointments,
          cancelled: cancelledAppointments,
          upcoming: upcomingAppointments,
          completionRate: totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0
        },
        appointmentsByType: consultationTypes,
        prescriptions: {
          totalIssued: prescriptionsCount
        },
        financials: {
          consultationFee: profile?.consultationFee || 500,
          totalEarnings: totalRevenue,
          currency: 'INR'
        },
        satisfaction: {
          averageRating: profile?.rating || 5.0,
          reviewCount: profile?.reviewCount || 0,
          distribution: ratingDistribution
        },
        ratingBreakdown: ratingDistribution
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminAnalytics,
  getDoctorAnalytics
};
