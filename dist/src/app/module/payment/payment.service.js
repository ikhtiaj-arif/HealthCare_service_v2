"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentServices = void 0;
const prisma_1 = require("../../lib/prisma");
const http_status_1 = __importDefault(require("http-status"));
const appError_1 = require("../../utils/appError");
const sort_1 = require("../../utils/sort");
const enums_1 = require("../../../generated/prisma/enums");
const getMyPayments = async (query, user) => {
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const { sortBy, sortOrder } = (0, sort_1.parseSort)(query, sort_1.PAYMENT_SORTABLE_FIELDS);
    const patient = await prisma_1.prisma.patient.findUnique({
        where: { userId: user.userId },
    });
    if (!patient) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Patient Profile Not Found");
    }
    const andConditions = [
        {
            appointment: { patientId: patient.id },
        },
    ];
    const payments = await prisma_1.prisma.payment.findMany({
        where: { AND: andConditions },
        take: limit,
        skip,
        orderBy: { [sortBy]: sortOrder },
        include: {
            appointment: {
                include: {
                    doctor: { select: { id: true, name: true, specialization: true } },
                    schedule: true,
                },
            },
        },
    });
    const total = await prisma_1.prisma.payment.count({
        where: { AND: andConditions },
    });
    return {
        data: payments,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};
const getAllPayments = async (query) => {
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const { sortBy, sortOrder } = (0, sort_1.parseSort)(query, sort_1.PAYMENT_SORTABLE_FIELDS);
    const andConditions = [];
    if (query.patientEmail) {
        andConditions.push({
            appointment: {
                patient: {
                    email: {
                        contains: query.patientEmail,
                        mode: "insensitive",
                    },
                },
            },
        });
    }
    const payments = await prisma_1.prisma.payment.findMany({
        where: { AND: andConditions },
        take: limit,
        skip,
        orderBy: { [sortBy]: sortOrder },
        include: {
            appointment: {
                include: {
                    doctor: { select: { id: true, name: true, specialization: true } },
                    schedule: true,
                },
            },
        },
    });
    const total = await prisma_1.prisma.payment.count({
        where: { AND: andConditions },
    });
    return {
        data: payments,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};
const getSinglePayment = async (paymentId, user) => {
    const payment = await prisma_1.prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
            appointment: {
                include: {
                    patient: {
                        select: { id: true, name: true, email: true, userId: true },
                    },
                    doctor: { select: { id: true, name: true, specialization: true } },
                    schedule: true,
                },
            },
        },
    });
    if (!payment) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Payment Not Found");
    }
    if (user.role === enums_1.Role.PATIENT) {
        if (payment.appointment.patient.userId !== user.userId) {
            throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "You Are Not Allowed To View This Payment");
        }
    }
    return payment;
};
exports.PaymentServices = {
    getMyPayments,
    getAllPayments,
    getSinglePayment,
};
