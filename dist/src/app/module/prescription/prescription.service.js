"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrescriptionServices = void 0;
const enums_1 = require("../../../generated/prisma/enums");
const prisma_1 = require("../../lib/prisma");
const appError_1 = require("../../utils/appError");
const doctorProfile_1 = require("../../utils/doctorProfile");
const http_status_1 = __importDefault(require("http-status"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const cloudinary_1 = require("../../lib/cloudinary");
const nodemailer_1 = require("../../lib/nodemailer");
const config_1 = __importDefault(require("../../config"));
const createPrescription = async (payload, user) => {
    const doctor = await (0, doctorProfile_1.getDoctorProfileOrThrow)(user.userId);
    const appointment = await prisma_1.prisma.appointment.findUnique({
        where: { id: payload.appointmentId, doctorId: doctor.id },
        include: { patient: true },
    });
    if (!appointment) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Appointment Not Found");
    }
    if (appointment.status !== enums_1.AppointmentStatus.COMPLETED) {
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "Prescription Can Only Be Written For A Completed Appointment");
    }
    if (appointment.prescriptionUrl) {
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "A Prescription Already Exists For This Appointment");
    }
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
    //pdf contents
    pdfDocument.fontSize(20).text("Healthcare System", { align: "center" });
    pdfDocument.fontSize(14).text("Prescription", { align: "center" });
    pdfDocument.moveDown(2);
    pdfDocument.fontSize(12).text(`Patient Name: ${appointment.patient.name}`);
    pdfDocument.text(`Doctor Name: ${doctor.name}`);
    pdfDocument.text(`Specialization: ${doctor.specialization}`);
    pdfDocument.text(`Date: ${new Date().toDateString()}`);
    pdfDocument.moveDown();
    pdfDocument.fontSize(14).text("Findings");
    pdfDocument.fontSize(12).text(payload.findings);
    pdfDocument.moveDown();
    pdfDocument.fontSize(14).text("Medicines");
    pdfDocument.moveDown(0.5);
    for (let i = 0; i < payload.medicines.length; i++) {
        const medicine = payload.medicines[i];
        pdfDocument.fontSize(12).text(`${i + 1}. ${medicine.name}`);
        pdfDocument.text(`   Dosage: ${medicine.dosage}`);
        pdfDocument.text(`   Duration: ${medicine.duration}`);
        if (medicine.instructions) {
            pdfDocument.text(`   Instructions: ${medicine.instructions}`);
        }
        pdfDocument.moveDown(0.5);
    }
    pdfDocument.end();
    const pdfBuffer = await pdfReadyPromise;
    const uploadResult = await new Promise((resolve, reject) => {
        cloudinary_1.cloudinary.uploader
            .upload_stream({ resource_type: "raw", format: "pdf" }, (error, result) => {
            if (error) {
                return reject(error);
            }
            if (!result) {
                return reject(new appError_1.AppError(http_status_1.default.INTERNAL_SERVER_ERROR, "No Result Returned From Cloudinary"));
            }
            resolve(result);
        })
            .end(pdfBuffer);
    });
    const updatedAppointment = await prisma_1.prisma.appointment.update({
        where: { id: appointment.id },
        data: {
            prescriptionUrl: uploadResult.secure_url,
            prescriptionPublicId: uploadResult.public_id,
        },
    });
    await nodemailer_1.transporter.sendMail({
        from: config_1.default.email_sender,
        to: appointment.patient.email,
        subject: "Your Prescription - PH Healthcare System",
        text: "Please find your prescription attached.",
        attachments: [
            {
                filename: "prescription.pdf",
                content: pdfBuffer,
            },
        ],
    });
    return updatedAppointment;
};
const getSinglePrescription = async (appointmentId, user) => {
    const appointment = await prisma_1.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
            patient: { select: { id: true, name: true, userId: true } },
            doctor: { select: { id: true, name: true, userId: true } },
        },
    });
    if (!appointment) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Appointment Not Found");
    }
    if (user.role === enums_1.Role.PATIENT) {
        if (appointment.patient.userId !== user.userId) {
            throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "You Are Not Allowed To View This Appointment");
        }
    }
    if (user.role === enums_1.Role.DOCTOR) {
        if (appointment.doctor.userId !== user.userId) {
            throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "You Are Not Allowed To View This Appointment");
        }
    }
    if (!appointment.prescriptionUrl) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "No Prescription Has Been Written Yet");
    }
    return {
        appointment,
        prescription: appointment.prescriptionUrl
    };
};
exports.PrescriptionServices = {
    createPrescription,
    getSinglePrescription,
};
