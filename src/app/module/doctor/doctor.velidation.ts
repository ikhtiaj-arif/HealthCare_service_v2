import { z } from "zod";

 

export const ApplyAsDoctorZodValidationSchema = z.object({
 	user: z.object({
			name: z
				.string()
				.min(2, "Name must be at least 2 characters")
				.max(50, "Name cannot exceed 50 characters")
				.trim(),

			email: z.email("Invalid email address").trim().toLowerCase(),
		}),

		// ==========================================
		// DOCTOR PROFILE FIELDS
		// ==========================================
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

			experienceYears: z.number().int("Experience must be a valid number"),

			bio: z
				.string()
				.max(1000, "Bio cannot exceed 1000 characters")
				.nullable()
				.optional(),

			consultationFee: z
				.number()
				.min(0, "Consultation fee must be a valid number")
				.optional(),
			contactNumber: z
				.string().trim()
				.min(5, "Contact number is invalid")
				.optional(),
		}),
});

