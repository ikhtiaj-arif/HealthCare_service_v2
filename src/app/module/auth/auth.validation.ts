import z from "zod";

/**
 * Shared by register, login and reset-password so the rules cannot drift apart.
 * The messages are the ones registration already returned, unchanged.
 */
const PasswordZodSchema = z
	.string()
	.min(8, "Password Must Minimum 8 Characters Long.")
	.regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
	.regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")
	.regex(/[0-9]/, "Password must contain atleast 1 Number")
	.regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character");

const PatientRegistrationZodSchema = z.object({
	name: z
		.string("Not A String!!!!!")
		.min(3, "Name must atleast 3 characters long!!!")
		.max(20),
	email: z.email("Not email!!"),
	password: PasswordZodSchema,
	patient: z
		.object({
			contactNumber: z.string().optional(),
		})
		.optional(),
});
const PatientVerifyEmailZodSchema = z.object({
	email: z.email("Not email!!"),otp:z.string().length(6)
});

/**
 * Login checks the *shape* of the credentials, not the password policy.
 *
 * Policy belongs on the routes where a password is being chosen (register,
 * reset-password). Re-checking complexity here would lock any account out of its
 * own password — including the seeded SUPER_ADMIN / TESTER_* accounts, which
 * `utils/seed.ts` hashes straight from the env with no complexity check.
 * `LoginForm` already enforces the rules client-side as a UX guard.
 */
const LoginZodSchema = z.object({
	email: z.email(),
	password: z.string().min(1, "Password is required"),
});

const GoogleLoginZodSchema = z.object({
	idToken: z.string().min(1, "idToken is required"),
});

const ForgotPasswordZodSchema = z.object({
	email: z.email("Not email!!"),
});

const ResetPasswordZodSchema = z.object({
	email: z.email("Not email!!"),
	otp: z.string().length(6, "OTP must be 6 characters long"),
	newPassword: PasswordZodSchema,
});

export const UserValidation = {
	PatientRegistrationZodSchema,
	LoginZodSchema,
	PatientVerifyEmailZodSchema,
	GoogleLoginZodSchema,
	ForgotPasswordZodSchema,
	ResetPasswordZodSchema,
};
