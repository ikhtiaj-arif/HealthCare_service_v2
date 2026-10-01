"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateDoctorProfileValidationZodSchema = exports.ApplyAsDoctorZodValidationSchema = exports.ApproveDoctorZodSchema = exports.VerifyDoctorEmailZodSchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("../../../generated/prisma/enums");
exports.VerifyDoctorEmailZodSchema = zod_1.z.object({
    email: zod_1.z.email("Not a valid email"),
    otp: zod_1.z.string().length(6, "OTP must be 6 characters long"),
});
exports.ApproveDoctorZodSchema = zod_1.z.object({
    doctorId: zod_1.z.string().uuid("doctorId must be a valid id"),
    verificationStatus: zod_1.z.enum(enums_1.DoctorVerificationStatus),
    // Only the service knows the reason is mandatory when REJECTED; this just
    // caps the length so a stray payload cannot store an unbounded string.
    rejectionReason: zod_1.z
        .string()
        .trim()
        .max(500, "Rejection reason cannot exceed 500 characters")
        .optional(),
});
exports.ApplyAsDoctorZodValidationSchema = zod_1.z.object({
    user: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(2, "Name must be at least 2 characters")
            .max(50, "Name cannot exceed 50 characters")
            .trim(),
        email: zod_1.z.email("Invalid email address").trim().toLowerCase(),
    }),
    doctor: zod_1.z.object({
        address: zod_1.z
            .string()
            .min(5, "Address must be at least 5 characters")
            .max(255, "Address cannot exceed 255 characters")
            .nullable()
            .optional(),
        specialization: zod_1.z
            .string()
            .min(2, "Specialization must be at least 2 characters")
            .trim(),
        licenseNumber: zod_1.z
            .string()
            .min(3, "License number must be at least 3 characters")
            .trim(),
        qualifications: zod_1.z
            .string()
            .min(2, "Please provide your degrees (e.g., MD, MBBS)")
            .trim(),
        experienceYears: zod_1.z
            .number()
            .int("Experience must be a valid number")
            .min(0, "Experience years cannot be negative "),
        bio: zod_1.z.string().max(1000, "Bio cannot exceed 1000 characters"),
        consultationFee: zod_1.z
            .number()
            .min(0, "Consultation fee must be a valid number")
            .optional(),
        contactNumber: zod_1.z
            .string()
            .trim()
            .min(5, "Contact number is invalid")
            .optional(),
    }),
});
exports.UpdateDoctorProfileValidationZodSchema = zod_1.z.object({
    address: zod_1.z
        .string()
        .trim()
        .min(5, "Address must be at least 5 characters long")
        .optional(),
    bio: zod_1.z
        .string()
        .trim()
        .max(1000, "Bio cannot exceed 1000 characters")
        .optional(),
    consultationFee: zod_1.z
        .number()
        .min(0, "Consultation fee cannot be negative")
        .optional(),
    contactNumber: zod_1.z
        .string()
        .trim()
        .min(5, "Contact number is invalid")
        .optional(),
});
