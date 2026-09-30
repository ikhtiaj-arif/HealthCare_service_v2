import { z } from "zod";
import { DoctorVerificationStatus } from "../../../generated/prisma/enums";

export const VerifyDoctorEmailZodSchema = z.object({
	email: z.email("Not a valid email"),
	otp: z.string().length(6, "OTP must be 6 characters long"),
});

export const ApproveDoctorZodSchema = z.object({
	doctorId: z.string().uuid("doctorId must be a valid id"),
	verificationStatus: z.enum(DoctorVerificationStatus),
	// Only the service knows the reason is mandatory when REJECTED; this just
	// caps the length so a stray payload cannot store an unbounded string.
	rejectionReason: z
		.string()
		.trim()
		.max(500, "Rejection reason cannot exceed 500 characters")
		.optional(),
});

export const ApplyAsDoctorZodValidationSchema = z.object({
	user: z.object({
		name: z
			.string()
			.min(2, "Name must be at least 2 characters")
			.max(50, "Name cannot exceed 50 characters")
			.trim(),

		email: z.email("Invalid email address").trim().toLowerCase(),
	}),

	doctor: z.object({
		address: z
			.string()
			.min(5, "Address must be at least 5 characters")
			.max(255, "Address cannot exceed 255 characters")
			.nullable()
			.optional(),

		specialization: z
			.string()
			.min(2, "Specialization must be at least 2 characters")
			.trim(),

		licenseNumber: z
			.string()
			.min(3, "License number must be at least 3 characters")
			.trim(),

		qualifications: z
			.string()
			.min(2, "Please provide your degrees (e.g., MD, MBBS)")
			.trim(),

		experienceYears: z
			.number()
			.int("Experience must be a valid number")
			.min(0, "Experience years cannot be negative "),

		bio: z.string().max(1000, "Bio cannot exceed 1000 characters"),
		consultationFee: z
			.number()
			.min(0, "Consultation fee must be a valid number")
			.optional(),
		contactNumber: z
			.string()
			.trim()
			.min(5, "Contact number is invalid")
			.optional(),
	}),
});
export const UpdateDoctorProfileValidationZodSchema = z.object({
	address: z
		.string()
		.trim()
		.min(5, "Address must be at least 5 characters long")
		.optional(),

	bio: z
		.string()
		.trim()
		.max(1000, "Bio cannot exceed 1000 characters")
		.optional(),

	consultationFee: z
		.number()
		.min(0, "Consultation fee cannot be negative")
		.optional(),

	contactNumber: z
		.string()
		.trim()
		.min(5, "Contact number is invalid")
		.optional(),
});
