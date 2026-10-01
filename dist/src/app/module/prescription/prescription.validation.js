"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePrescriptionValidationZodSchema = void 0;
const zod_1 = require("zod");
// A doctor writes this after an appointment is COMPLETED (Project
// Requirements section 9): key findings, plus a list of prescribed medicines.
exports.CreatePrescriptionValidationZodSchema = zod_1.z.object({
    appointmentId: zod_1.z.string().min(1, "Appointment Id Is Required"),
    findings: zod_1.z
        .string()
        .trim()
        .min(5, "Findings Must Be At Least 5 Characters Long"),
    medicines: zod_1.z
        .array(zod_1.z.object({
        name: zod_1.z.string().trim().min(1, "Medicine Name Is Required"),
        dosage: zod_1.z.string().trim().min(1, "Dosage Is Required"),
        duration: zod_1.z.string().trim().min(1, "Duration Is Required"),
        instructions: zod_1.z.string().trim().optional(),
    }))
        .min(1, "At Least One Medicine Is Required"),
});
