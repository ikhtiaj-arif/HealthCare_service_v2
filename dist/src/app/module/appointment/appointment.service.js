"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentServices = void 0;
const enums_1 = require("../../../generated/prisma/enums");
const config_1 = __importDefault(require("../../config"));
const bkash_1 = require("../../lib/bkash");
const prisma_1 = require("../../lib/prisma");
const appError_1 = require("../../utils/appError");
const sort_1 = require("../../utils/sort");
const doctorProfile_1 = require("../../utils/doctorProfile");
const http_status_1 = __importDefault(require("http-status"));
const date_fns_1 = require("date-fns");
const nodemailer_1 = require("../../lib/nodemailer");
const pdfkit_1 = __importDefault(require("pdfkit"));
const bookAppointment = async (payload, user) => {
    // business logics
    // transaction = appointment --> bkash payment --> payment model create
    const transactionResult = await prisma_1.prisma.$transaction(async (tx) => {
        const patient = await tx.patient.findUnique({
            where: { userId: user.userId },
        });
        if (!patient)
            throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Patient Profile not found");
        const schedule = await tx.schedule.findUnique({
            where: { id: payload.scheduleId },
            include: { doctor: true },
        });
        if (!schedule || schedule.isDeleted) {
            throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Schedule Not Found");
        }
        if (schedule.status !== enums_1.ScheduleStatus.PUBLISHED) {
            throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "This Schedule Is Not Published Yet");
        }
        const now = new Date();
        if (!(0, date_fns_1.isSameDay)(now, schedule.startDateTime)) {
            throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "This Schedule Is Not Available Today");
        }
        if (!(0, date_fns_1.isBefore)(now, schedule.startDateTime)) {
            throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "This Schedule Has Already Started");
        }
        // if(isAfter(now, schedule.startDateTime)){
        // 	throw new AppError(
        // 		httpStatus.BAD_REQUEST,
        // 		"This Schedule Has Already Started",
        // 	);
        // }
        const existingAppointment = await tx.appointment.findFirst({
            where: {
                patientId: patient.id,
                scheduleId: schedule.id,
                // status : { not : AppointmentStatus.CANCELLED }
            },
        });
        if (existingAppointment?.status === enums_1.AppointmentStatus.PENDING) {
            throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "You already have a pending appointment.");
        }
        if (existingAppointment?.status === enums_1.AppointmentStatus.ONGOING) {
            throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "You already have an Ongoing appointment.");
        }
        if (existingAppointment?.status === enums_1.AppointmentStatus.COMPLETED) {
            throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "You already have completed the appointment.");
        }
        if (existingAppointment?.status === enums_1.AppointmentStatus.CONFIRMED) {
            throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "You already have confirmed the appointment.");
        }
        if (schedule.availableSlots === 0) {
            throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "This Schedule Is Fully Booked");
        }
        if (!schedule.doctor.consultationFee) {
            throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "Doctor Has Not Set A Consultation Fee Yet");
        }
        // create appointment
        const amount = schedule.doctor.consultationFee.toString();
        const appointment = await tx.appointment.create({
            data: {
                status: enums_1.AppointmentStatus.PENDING,
                patientId: patient.id,
                doctorId: schedule.doctor.id,
                scheduleId: schedule.id,
            },
        });
        return { appointment, amount };
    });
    // The bKash calls sit deliberately outside the transaction. A transaction
    // holds a pooled connection open for its whole duration, and these are two
    // sequential network round-trips to a third party, so doing them inline
    // blocked a connection for the duration of the gateway's latency.
    //
    // If this step fails the PENDING appointment is left behind on purpose: that
    // is the same state payAppointment resumes from, so the patient can retry
    // payment without losing the booking.
    const { appointment, amount } = transactionResult;
    const bkashIdToken = await (0, bkash_1.getBkashIdToken)();
    if (!bkashIdToken)
        throw new appError_1.AppError(http_status_1.default.INTERNAL_SERVER_ERROR, "No Bkash Access Token Found!");
    const bkashCreatePaymentResponse = await fetch(`${config_1.default.bkash_base_url}/tokenized/checkout/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: bkashIdToken,
            "X-App-Key": config_1.default.bkash_app_key,
        },
        body: JSON.stringify({
            mode: "0011",
            payerReference: user.email, // user email or phone number
            callbackURL: `${config_1.default.bkash_callback_url}/appointment/book-appointment/payment/callback`,
            amount: amount,
            currency: "BDT",
            intent: "sale",
            merchantInvoiceNumber: appointment.id, // appointment id
        }),
    });
    const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();
    if (!bkashCreatePaymentResult?.bkashURL) {
        throw new appError_1.AppError(http_status_1.default.BAD_GATEWAY, "Could not start the bKash payment. Please try again.");
    }
    // payment model create
    const payment = await prisma_1.prisma.payment.create({
        data: {
            merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
            appointmentId: appointment.id,
            amount: amount,
            gatewayResponse: bkashCreatePaymentResult,
            bkashPaymentId: bkashCreatePaymentResult.paymentID,
            payerReference: user.email,
        },
    });
    return { paymentUrl: bkashCreatePaymentResult.bkashURL };
};
const payAppointment = async (payload, user) => {
    const { appointmentId } = payload;
    const existingAppointment = await prisma_1.prisma.appointment.findUnique({
        where: {
            id: appointmentId,
        },
        include: {
            schedule: {
                include: {
                    doctor: true,
                },
            },
            patient: {
                select: {
                    userId: true,
                },
            },
        },
    });
    if (!existingAppointment)
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Appointment Does Not Exist");
    // The route is PATIENT-only, so the only thing that identifies "whose"
    // appointment this is has to be checked here. Without it any authenticated
    // patient could pass an arbitrary id and open a bKash checkout against someone
    // else's appointment: the gateway ids below are written to that appointment's
    // payment row, and paying it confirms their slot, so the victim is booked in
    // and the payer is not the patient being treated. Same check as
    // `getSingleAppointment`, compared on `userId` rather than email because
    // `checkAuth` re-reads the user by id and treats the two as distinct.
    if (existingAppointment.patient.userId !== user.userId)
        throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "You are not allowed to pay for this appointment");
    if (existingAppointment.status !== enums_1.AppointmentStatus.PENDING) {
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, `Appointment is Already ${existingAppointment.status.toUpperCase()}`);
    }
    if (!existingAppointment?.schedule?.doctor?.consultationFee)
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, `Doctor has not set a consultation fee yet`);
    const amount = existingAppointment?.schedule?.doctor?.consultationFee.toString();
    const bkashIdToken = await (0, bkash_1.getBkashIdToken)();
    if (!bkashIdToken)
        throw new appError_1.AppError(http_status_1.default.INTERNAL_SERVER_ERROR, "No Bkash Access Token Found!");
    const bkashCreatePaymentResponse = await fetch(`${config_1.default.bkash_base_url}/tokenized/checkout/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: bkashIdToken,
            "X-App-Key": config_1.default.bkash_app_key,
        },
        body: JSON.stringify({
            // agreementID: "TokenizedMerchant01L3IKB6H1565072174986", // appointment id
            mode: "0011",
            // payerReference: "01723888888", // user email or phone number
            payerReference: user.email, // user email or phone number
            callbackURL: `${config_1.default.bkash_callback_url}/appointment/book-appointment/payment/callback`,
            // merchantAssociationInfo: "MI05MID54RF09123456One",
            amount: amount,
            currency: "BDT",
            intent: "sale",
            // merchantInvoiceNumber: "Inv0124", // appointment id
            merchantInvoiceNumber: existingAppointment.id, // appointment id
        }),
    });
    const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();
    await prisma_1.prisma.payment.update({
        where: {
            appointmentId: existingAppointment.id,
        },
        data: {
            merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
            gatewayResponse: bkashCreatePaymentResult,
            bkashPaymentId: bkashCreatePaymentResult.paymentID,
        },
    });
    return { paymentUrl: bkashCreatePaymentResult.bkashURL };
};
const cancelAppointment = async (payload, user) => {
    const transactionResult = await prisma_1.prisma.$transaction(async (tx) => {
        const { appointmentId, refundReason } = payload;
        const existingAppointment = await tx.appointment.findUnique({
            where: {
                id: appointmentId,
                patient: {
                    email: user.email,
                },
            },
            include: {
                payment: true,
                schedule: true,
            },
        });
        if (!existingAppointment)
            throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Appointment Does Not Exist");
        if (existingAppointment.status === enums_1.AppointmentStatus.ONGOING ||
            existingAppointment.status === enums_1.AppointmentStatus.COMPLETED ||
            existingAppointment.status === enums_1.AppointmentStatus.CANCELLED) {
            throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, `Appointment is Already ${existingAppointment.status.toUpperCase()}`);
        }
        const updateAppointment = await tx.appointment.update({
            where: {
                id: existingAppointment.id,
            },
            data: { status: enums_1.AppointmentStatus.CANCELLED },
        });
        await tx.schedule.update({
            where: {
                id: existingAppointment.schedule.id,
            },
            data: {
                availableSlots: { increment: 1 },
            },
        });
        //refund process
        const now = new Date();
        const startDateTime = existingAppointment.schedule.startDateTime; // 25 August : 3:00 PM
        // After 2:00 Pm => no refund
        // must cancel before  2:00 PM
        const refundCutOffTime = (0, date_fns_1.subHours)(startDateTime, 1);
        // now >  refuncCutOff Time => no refund
        // now < refundCutOff Time => refund eligible
        const isEligibleForRefund = (0, date_fns_1.isBefore)(now, refundCutOffTime);
        if (isEligibleForRefund) {
            const bkashIdToken = await (0, bkash_1.getBkashIdToken)();
            if (!bkashIdToken)
                throw new appError_1.AppError(http_status_1.default.INTERNAL_SERVER_ERROR, "No Bkash Access Token Found!");
            const bkashRefundPaymentResponse = await fetch(`${config_1.default.bkash_base_url}/tokenized/checkout/payment/refund`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: bkashIdToken,
                    "X-App-Key": config_1.default.bkash_app_key,
                },
                body: JSON.stringify({
                    paymentID: existingAppointment.payment?.bkashPaymentId,
                    trxID: existingAppointment.payment?.bkashTrxId,
                    amount: existingAppointment.payment?.amount.toString(),
                    sku: "Appoint cancellation",
                    reason: refundReason,
                }),
            });
            const bkashRefundPaymentResult = await bkashRefundPaymentResponse.json();
            console.log("💰 bkashRefundPaymentResult:", { bkashRefundPaymentResult });
            // update payment and appointment model after refund
            await tx.payment.update({
                where: {
                    appointmentId: existingAppointment.id,
                },
                data: {
                    refundTrxId: bkashRefundPaymentResult.refundTrxID,
                    refundedAt: bkashRefundPaymentResult.completedTime,
                    refundAmount: bkashRefundPaymentResult.amount,
                    refundReason: refundReason,
                    status: enums_1.PaymentStatus.REFUNDED,
                    gatewayResponse: bkashRefundPaymentResult,
                },
            });
        }
        const newPaymentInfo = await prisma_1.prisma.payment.findUnique({
            where: {
                appointmentId: existingAppointment.id,
            },
        });
        return {
            appointment: updateAppointment,
            payment: newPaymentInfo,
        };
    });
    return transactionResult;
};
const bookAppointmentCallback = async (query) => {
    const transactionResult = await prisma_1.prisma.$transaction(async (tx) => {
        const paymentId = query.paymentID;
        if (!paymentId)
            throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "Payment ID Missing");
        const status = query.status;
        if (!status)
            throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "Payment Status Missing");
        const bkashIdToken = await (0, bkash_1.getBkashIdToken)();
        if (!bkashIdToken)
            throw new appError_1.AppError(http_status_1.default.INTERNAL_SERVER_ERROR, "No Bkash Access Token Found!");
        const executedPayment = await fetch(`${config_1.default.bkash_base_url}/tokenized/checkout/execute`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: bkashIdToken,
                "X-App-Key": config_1.default.bkash_app_key,
            },
            body: JSON.stringify({
                paymentID: paymentId,
            }),
        });
        const executedPaymentResult = await executedPayment.json();
        if (status === "success") {
            // create serial number
            const appointment = await prisma_1.prisma.appointment.findUnique({
                where: {
                    id: executedPaymentResult.merchantInvoiceNumber,
                },
                include: {
                    schedule: true,
                    patient: true,
                    doctor: true,
                },
            });
            if (!appointment)
                throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "appointment not found");
            // total slots = 3, available = 3
            //(total - available) + 1
            const alreadyBookedSlots = appointment.schedule.totalSlots - appointment.schedule.availableSlots;
            const serialNumber = alreadyBookedSlots + 1;
            // 25 August => 3:00 PM - 4:00 PM
            // 1st person joining time => startDateTime = 2026-08-25T15:00:00.436Z => 3:00 PM
            // serial number (1) - 1 * 20 => 0 minutes
            // 2nd person joining time => startDateTime = 2026-08-25T15:20:00.436Z => 3:00 PM
            // serial number (2) - 1 * 20 => 20 minutes
            // 3nd person joining time => startDateTime = 2026-08-25T15:40:00.436Z => 3:00 PM
            // serial number (3) - 1 * 20 => 40 minutes
            const joiningTime = (0, date_fns_1.addMinutes)(appointment.schedule.startDateTime, (serialNumber - 1) * 20);
            await tx.appointment.update({
                where: {
                    id: executedPaymentResult.merchantInvoiceNumber,
                },
                data: {
                    status: enums_1.AppointmentStatus.CONFIRMED,
                    joiningTime,
                    serialNumber,
                },
            });
            const newAvailableSlots = appointment.schedule.availableSlots - 1;
            await tx.schedule.update({
                where: {
                    id: appointment.schedule.id,
                },
                data: {
                    availableSlots: newAvailableSlots,
                },
            });
            await tx.payment.update({
                where: {
                    appointmentId: executedPaymentResult.merchantInvoiceNumber,
                    bkashPaymentId: paymentId,
                },
                data: {
                    status: enums_1.PaymentStatus.PAID,
                    bkashTrxId: executedPaymentResult.trxID,
                    paidAt: executedPaymentResult.paymentExecuteTime,
                    gatewayResponse: executedPaymentResult,
                },
            });
            //generate pdf
            const pdfDocument = new pdfkit_1.default({ margin: 50 });
            const pdfChunks = [];
            pdfDocument.on("data", (chunk) => {
                pdfChunks.push(chunk);
            });
            const pdfReadyPromise = new Promise((resolve) => {
                pdfDocument.on("end", () => {
                    resolve(Buffer.concat(pdfChunks));
                });
            });
            pdfDocument.fontSize(20).text("Healthcare System", { align: "center" });
            pdfDocument.fontSize(14).text("Appointment Invoice", { align: "center" });
            pdfDocument.moveDown(2);
            pdfDocument
                .fontSize(12)
                .text(`Patient Name: ${appointment.patient?.name}`);
            pdfDocument.text(`Patient Email: ${appointment.patient?.email}`);
            pdfDocument.moveDown();
            pdfDocument.text(`Doctor Name: ${appointment?.doctor?.name}`);
            pdfDocument.text(`Specialization: ${appointment.doctor?.specialization}`);
            pdfDocument.moveDown();
            pdfDocument.text(`Appointment Date: ${appointment.schedule.startDateTime.toDateString()}`);
            pdfDocument.text(`Your Joining Time: ${joiningTime.toString()}`);
            pdfDocument.text(`Your Serial Number: ${serialNumber}`);
            pdfDocument.text(`Meeting Link: ${appointment.schedule.meetingLink}`);
            pdfDocument.moveDown();
            pdfDocument.text(`Amount Paid: ${executedPaymentResult.amount} BDT`);
            pdfDocument.text(`Payment Method: bKash`);
            pdfDocument.text(`Transaction Id: ${executedPaymentResult.trxID}`);
            pdfDocument.text(`Paid At: ${executedPaymentResult.paymentExecuteTime}`);
            pdfDocument.end();
            const pdfBuffer = await pdfReadyPromise;
            await nodemailer_1.transporter.sendMail({
                from: config_1.default.email_sender,
                to: appointment.patient.email,
                subject: "Your Appointment Invoice - Healthcare System",
                text: "Thank you for booking an appointment. Please find your invoice attached.",
                attachments: [
                    {
                        filename: "invoice.pdf",
                        content: pdfBuffer,
                    },
                ],
            });
            return {
                redirectUrl: `${config_1.default.frontend_url}/dashboard/my-appointments?status=success`,
            };
        }
        else if (status === "failure") {
            await tx.payment.update({
                where: {
                    bkashPaymentId: paymentId,
                },
                data: {
                    status: enums_1.PaymentStatus.FAILED,
                    gatewayResponse: executedPaymentResult,
                },
            });
            return {
                redirectUrl: `${config_1.default.frontend_url}/dashboard/my-appointments?status=failure`,
            };
        }
        else if (status === "cancel") {
            await tx.payment.update({
                where: {
                    bkashPaymentId: paymentId,
                },
                data: {
                    status: enums_1.PaymentStatus.CANCELLED,
                    gatewayResponse: executedPaymentResult,
                },
            });
            return {
                redirectUrl: `${config_1.default.frontend_url}/dashboard/my-appointments?status=cancel`,
            };
        }
        else {
            return {
                executedPaymentResult,
                redirectUrl: `${config_1.default.frontend_url}/dashboard/my-appointments?error=payment-failed`,
            };
        }
    }, { maxWait: 5000, timeout: 20000 });
    return transactionResult;
};
// doctor only confirmed => ongoing => completed
const updateAppointmentStatus = async (appointmentId, payload, user) => {
    const doctor = await (0, doctorProfile_1.getDoctorProfileOrThrow)(user.userId);
    const appointment = await prisma_1.prisma.appointment.findUnique({
        where: { id: appointmentId, doctorId: doctor.id },
    });
    if (!appointment) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Appointment Not Found");
    }
    if (appointment.status === enums_1.AppointmentStatus.COMPLETED) {
        throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "Appointment is already completed");
    }
    if (appointment.status === enums_1.AppointmentStatus.CANCELLED) {
        throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "Appointment is already Cancelled");
    }
    if (appointment.status === enums_1.AppointmentStatus.PENDING) {
        throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "Appointment is Pending, You can change the appointment after it is confirmed");
    }
    if (appointment.status === enums_1.AppointmentStatus.CONFIRMED) {
        if (payload.status !== "ONGOING") {
            throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "Confirmed appointment must be ongoing at first");
        }
        await prisma_1.prisma.appointment.update({
            where: {
                id: appointment.id,
            },
            data: {
                status: enums_1.AppointmentStatus.ONGOING,
            },
        });
    }
    if (appointment.status === enums_1.AppointmentStatus.ONGOING) {
        if (payload.status !== "COMPLETED") {
            throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "Ongoing appointment must be completed");
        }
        await prisma_1.prisma.appointment.update({
            where: {
                id: appointment.id,
            },
            data: {
                status: enums_1.AppointmentStatus.COMPLETED,
            },
        });
    }
    const updatedAppointment = await prisma_1.prisma.appointment.findUnique({
        where: {
            id: appointment.id,
        },
    });
    return updatedAppointment;
};
// patient appointments
const getMyAppointments = async (query, user) => {
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const { sortBy, sortOrder } = (0, sort_1.parseSort)(query, sort_1.APPOINTMENT_SORTABLE_FIELDS);
    const patient = await prisma_1.prisma.patient.findUnique({
        where: { userId: user.userId },
    });
    if (!patient) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Patient Profile Not Found");
    }
    const andConditions = [
        {
            patientId: patient.id,
        },
    ];
    if (query.status) {
        andConditions.push({ status: query.status });
    }
    const appointments = await prisma_1.prisma.appointment.findMany({
        where: { AND: andConditions },
        take: limit,
        skip,
        orderBy: { [sortBy]: sortOrder },
        include: {
            doctor: { select: { id: true, name: true, specialization: true } },
            schedule: true,
            payment: true,
        },
    });
    const total = await prisma_1.prisma.appointment.count({
        where: { AND: andConditions },
    });
    return {
        data: appointments,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};
// doctor appointments
const getDoctorAppointments = async (query, user) => {
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const { sortBy, sortOrder } = (0, sort_1.parseSort)(query, sort_1.APPOINTMENT_SORTABLE_FIELDS);
    const doctor = await (0, doctorProfile_1.getDoctorProfileOrThrow)(user.userId);
    const andConditions = [
        {
            doctorId: doctor.id,
        },
    ];
    if (query.status) {
        andConditions.push({ status: query.status });
    }
    const appointments = await prisma_1.prisma.appointment.findMany({
        where: { AND: andConditions },
        take: limit,
        skip,
        orderBy: { [sortBy]: sortOrder },
        include: {
            patient: {
                select: { id: true, name: true, email: true, contactNumber: true },
            },
            schedule: true,
            payment: true,
        },
    });
    const total = await prisma_1.prisma.appointment.count({
        where: { AND: andConditions },
    });
    return {
        data: appointments,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};
// admin super admin
const getAllAppointments = async (query, user) => {
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const { sortBy, sortOrder } = (0, sort_1.parseSort)(query, sort_1.APPOINTMENT_SORTABLE_FIELDS);
    const andConditions = [];
    if (query.status) {
        andConditions.push({ status: query.status });
    }
    if (query.doctorId) {
        andConditions.push({ doctorId: query.doctorId });
    }
    if (query.patientId) {
        andConditions.push({ patientId: query.patientId });
    }
    if (query.doctorEmail) {
        andConditions.push({
            doctor: {
                email: query.doctorEmail,
            },
        });
    }
    if (query.patientEmail) {
        andConditions.push({
            patient: {
                email: query.patientEmail,
            },
        });
    }
    const appointments = await prisma_1.prisma.appointment.findMany({
        where: { AND: andConditions },
        take: limit,
        skip,
        orderBy: { [sortBy]: sortOrder },
        include: {
            patient: { select: { id: true, name: true, email: true } },
            doctor: { select: { id: true, name: true, specialization: true } },
            schedule: true,
            payment: true,
        },
    });
    const total = await prisma_1.prisma.appointment.count({
        where: { AND: andConditions },
    });
    return {
        data: appointments,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};
// for all users
const getSingleAppointment = async (appointmentId, user) => {
    const appointment = await prisma_1.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
            patient: { select: { id: true, name: true, email: true, userId: true } },
            doctor: {
                select: { id: true, name: true, specialization: true, userId: true },
            },
            schedule: true,
            payment: true,
        },
    });
    if (!appointment) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Appointment Not Found");
    }
    if (user.role === enums_1.Role.PATIENT) {
        if (appointment.patient.userId !== user.userId)
            throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "You are not allowed to view this appointment");
    }
    if (user.role === enums_1.Role.DOCTOR) {
        if (appointment.doctor.userId !== user.userId)
            throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "You are not allowed to view this appointment");
    }
    return appointment;
};
exports.AppointmentServices = {
    bookAppointment,
    bookAppointmentCallback,
    payAppointment,
    cancelAppointment,
    updateAppointmentStatus,
    getMyAppointments,
    getDoctorAppointments,
    getAllAppointments,
    getSingleAppointment,
};
