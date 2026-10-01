"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancelAppointmentValidationZodSchema = exports.PayAppointmentValidationZodSchema = exports.UpdateAppointmentStatusValidationZodSchema = exports.BookAppointmentValidationZodSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.BookAppointmentValidationZodSchema = zod_1.default.object({
    scheduleId: zod_1.default.string().min(1, "Schedule Id Is Required"),
});
exports.UpdateAppointmentStatusValidationZodSchema = zod_1.default.object({
    status: zod_1.default.enum(["ONGOING", "COMPLETED"], "Status Must Be Either ONGOING Or COMPLETED"),
});
exports.PayAppointmentValidationZodSchema = zod_1.default.object({
    appointmentId: zod_1.default.string().min(1, "Appointment Id Is Required"),
});
exports.CancelAppointmentValidationZodSchema = zod_1.default.object({
    appointmentId: zod_1.default.string().min(1, "Appointment Id Is Required"),
    refundReason: zod_1.default
        .string()
        .trim()
        .min(3, "Please give a reason for cancelling")
        .max(500, "Refund reason cannot exceed 500 characters"),
});
