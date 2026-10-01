"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserValidation = void 0;
const zod_1 = __importDefault(require("zod"));
/**
 * Shared by register, login and reset-password so the rules cannot drift apart.
 * The messages are the ones registration already returned, unchanged.
 */
const PasswordZodSchema = zod_1.default
    .string()
    .min(8, "Password Must Minimum 8 Characters Long.")
    .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
    .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")
    .regex(/[0-9]/, "Password must contain atleast 1 Number")
    .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character");
const PatientRegistrationZodSchema = zod_1.default.object({
    name: zod_1.default
        .string("Not A String!!!!!")
        .min(3, "Name must atleast 3 characters long!!!")
        .max(20),
    email: zod_1.default.email("Not email!!"),
    password: PasswordZodSchema,
    patient: zod_1.default
        .object({
        contactNumber: zod_1.default.string().optional(),
    })
        .optional(),
});
const PatientVerifyEmailZodSchema = zod_1.default.object({
    email: zod_1.default.email("Not email!!"), otp: zod_1.default.string().length(6)
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
const LoginZodSchema = zod_1.default.object({
    email: zod_1.default.email(),
    password: zod_1.default.string().min(1, "Password is required"),
});
const GoogleLoginZodSchema = zod_1.default.object({
    idToken: zod_1.default.string().min(1, "idToken is required"),
});
const ForgotPasswordZodSchema = zod_1.default.object({
    email: zod_1.default.email("Not email!!"),
});
const ResetPasswordZodSchema = zod_1.default.object({
    email: zod_1.default.email("Not email!!"),
    otp: zod_1.default.string().length(6, "OTP must be 6 characters long"),
    newPassword: PasswordZodSchema,
});
exports.UserValidation = {
    PatientRegistrationZodSchema,
    LoginZodSchema,
    PatientVerifyEmailZodSchema,
    GoogleLoginZodSchema,
    ForgotPasswordZodSchema,
    ResetPasswordZodSchema,
};
