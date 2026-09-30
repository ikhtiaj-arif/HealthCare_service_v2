import z from "zod";

export const BookAppointmentValidationZodSchema = z.object({
    scheduleId: z.string().min(1, "Schedule Id Is Required"),
});

export const UpdateAppointmentStatusValidationZodSchema = z.object({
    status: z.enum(
        ["ONGOING", "COMPLETED"],
        "Status Must Be Either ONGOING Or COMPLETED",
    ),
});

export const PayAppointmentValidationZodSchema = z.object({
    appointmentId: z.string().min(1, "Appointment Id Is Required"),
});

export const CancelAppointmentValidationZodSchema = z.object({
    appointmentId: z.string().min(1, "Appointment Id Is Required"),
    refundReason: z
        .string()
        .trim()
        .min(3, "Please give a reason for cancelling")
        .max(500, "Refund reason cannot exceed 500 characters"),
});