"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsServices = void 0;
const enums_1 = require("../../../generated/prisma/enums");
const prisma_1 = require("../../lib/prisma");
const appError_1 = require("../../utils/appError");
const doctorProfile_1 = require("../../utils/doctorProfile");
const http_status_1 = __importDefault(require("http-status"));
const getAdminAnalytics = async () => {
    //total doctors
    const totalDoctors = await prisma_1.prisma.doctor.count({
        where: {
            isDeleted: false,
        },
    });
    const totalPendingDoctorApplications = await prisma_1.prisma.doctor.count({
        where: {
            isDeleted: false,
            verificationStatus: enums_1.DoctorVerificationStatus.PENDING,
        },
    });
    const totalApprovedDoctors = await prisma_1.prisma.doctor.count({
        where: {
            isDeleted: false,
            verificationStatus: enums_1.DoctorVerificationStatus.APPROVED,
        },
    });
    const totalRejectedDoctors = await prisma_1.prisma.doctor.count({
        where: {
            isDeleted: false,
            verificationStatus: enums_1.DoctorVerificationStatus.REJECTED,
        },
    });
    const totalPatients = await prisma_1.prisma.patient.count({
        where: { isDeleted: false },
    });
    const totalAppointments = await prisma_1.prisma.appointment.count();
    const totalCompletedAppointments = await prisma_1.prisma.appointment.count({
        where: { status: enums_1.AppointmentStatus.COMPLETED },
    });
    const totalCancelledAppointments = await prisma_1.prisma.appointment.count({
        where: { status: enums_1.AppointmentStatus.CANCELLED },
    });
    const totalRefundResult = await prisma_1.prisma.payment.aggregate({
        where: {
            status: enums_1.PaymentStatus.REFUNDED,
        },
        _sum: {
            amount: true,
        },
    });
    const totalRefunded = totalRefundResult._sum.amount?.toNumber() || 0;
    const totalRevenueResult = await prisma_1.prisma.payment.aggregate({
        where: {
            status: enums_1.PaymentStatus.PAID,
        },
        _sum: {
            amount: true,
        },
    });
    const totalRevenue = (totalRevenueResult._sum.amount?.toNumber() || 0) - totalRefunded;
    return {
        totalDoctors,
        totalPendingDoctorApplications,
        totalApprovedDoctors,
        totalRejectedDoctors,
        totalPatients,
        totalAppointments,
        totalCompletedAppointments,
        totalCancelledAppointments,
        totalRevenue,
        totalRefunded,
    };
};
const getPatientAnalytics = async (user) => {
    const patient = await prisma_1.prisma.patient.findUnique({
        where: { userId: user.userId },
    });
    if (!patient) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Patient Profile Not Found");
    }
    const totalAppointments = await prisma_1.prisma.appointment.count({
        where: { patientId: patient.id },
    });
    const upcomingAppointments = await prisma_1.prisma.appointment.count({
        where: { patientId: patient.id, status: enums_1.AppointmentStatus.CONFIRMED },
    });
    const completedAppointments = await prisma_1.prisma.appointment.count({
        where: { patientId: patient.id, status: enums_1.AppointmentStatus.COMPLETED },
    });
    const cancelledAppointments = await prisma_1.prisma.appointment.count({
        where: { patientId: patient.id, status: enums_1.AppointmentStatus.CANCELLED },
    });
    const totalAmountSpentResult = await prisma_1.prisma.payment.aggregate({
        where: {
            appointment: {
                patientId: patient.id,
            },
            status: enums_1.PaymentStatus.PAID,
        },
        _sum: {
            amount: true,
        },
    });
    const totalAmountSpent = totalAmountSpentResult._sum.amount?.toNumber() || 0;
    const totalRefundedResult = await prisma_1.prisma.payment.aggregate({
        where: {
            appointment: {
                patientId: patient.id,
            },
            status: enums_1.PaymentStatus.REFUNDED,
        },
        _sum: {
            amount: true,
        },
    });
    const totalRefunded = totalRefundedResult._sum.amount?.toNumber() || 0;
    return {
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
        cancelledAppointments,
        totalAmountSpent,
        totalRefunded,
    };
};
const getDoctorAnalytics = async (user) => {
    const doctor = await (0, doctorProfile_1.getDoctorProfileOrThrow)(user.userId);
    const totalSchedules = await prisma_1.prisma.schedule.count({
        where: { doctorId: doctor.id, isDeleted: false },
    });
    const publishedSchedules = await prisma_1.prisma.schedule.count({
        where: {
            doctorId: doctor.id,
            isDeleted: false,
            status: enums_1.ScheduleStatus.PUBLISHED,
        },
    });
    const totalAppointments = await prisma_1.prisma.appointment.count({
        where: { doctorId: doctor.id },
    });
    const upcomingAppointments = await prisma_1.prisma.appointment.count({
        where: { doctorId: doctor.id, status: enums_1.AppointmentStatus.CONFIRMED },
    });
    const ongoingAppointments = await prisma_1.prisma.appointment.count({
        where: { doctorId: doctor.id, status: enums_1.AppointmentStatus.ONGOING },
    });
    const completedAppointments = await prisma_1.prisma.appointment.count({
        where: { doctorId: doctor.id, status: enums_1.AppointmentStatus.COMPLETED },
    });
    const cancelledAppointments = await prisma_1.prisma.appointment.count({
        where: { doctorId: doctor.id, status: enums_1.AppointmentStatus.CANCELLED },
    });
    const totalDoctorRefundedResult = await prisma_1.prisma.payment.aggregate({
        where: {
            appointment: {
                doctorId: doctor.id,
            },
            status: enums_1.PaymentStatus.REFUNDED,
        },
        _sum: {
            amount: true,
        },
    });
    const totalDoctorRefunded = totalDoctorRefundedResult._sum.amount?.toNumber() || 0;
    const totalDoctorEarningsResult = await prisma_1.prisma.payment.aggregate({
        where: {
            appointment: {
                doctorId: doctor.id,
            },
            status: enums_1.PaymentStatus.PAID,
        },
        _sum: {
            amount: true,
        },
    });
    const totalDoctorEarnings = (totalDoctorEarningsResult._sum.amount?.toNumber() || 0) -
        totalDoctorRefunded;
    return {
        totalSchedules,
        publishedSchedules,
        totalAppointments,
        upcomingAppointments,
        ongoingAppointments,
        completedAppointments,
        cancelledAppointments,
        totalDoctorEarnings,
        totalDoctorRefunded,
    };
};
exports.AnalyticsServices = {
    getAdminAnalytics,
    getDoctorAnalytics,
    getPatientAnalytics,
};
