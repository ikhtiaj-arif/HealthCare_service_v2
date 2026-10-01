"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorRoutes = void 0;
const express_1 = require("express");
const doctor_controller_1 = require("./doctor.controller");
const multer_1 = require("../../lib/multer");
const enums_1 = require("../../../generated/prisma/enums");
const checkAuth_1 = require("../../middleware/checkAuth");
const validateRequest_1 = require("../../middleware/validateRequest");
const doctor_velidation_1 = require("./doctor.velidation");
const router = (0, express_1.Router)();
router.post("/apply-as-doctor", multer_1.upload.fields([
    {
        name: "resume",
        maxCount: 1,
    },
    {
        name: "additionalFiles",
        maxCount: 5,
    },
]), doctor_controller_1.DoctorControllers.applyAsDoctor);
router.post("/apply-as-doctor/verify-email", (0, validateRequest_1.validateRequest)(doctor_velidation_1.VerifyDoctorEmailZodSchema), doctor_controller_1.DoctorControllers.verifyDoctorEmail);
router.post("/approve-doctor", (0, checkAuth_1.auth)(enums_1.Role.ADMIN, enums_1.Role.SUPER_ADMIN), (0, validateRequest_1.validateRequest)(doctor_velidation_1.ApproveDoctorZodSchema), doctor_controller_1.DoctorControllers.approveDoctor);
router.get("/all-doctors", (0, checkAuth_1.auth)(enums_1.Role.ADMIN, enums_1.Role.SUPER_ADMIN), doctor_controller_1.DoctorControllers.getAllDoctors);
router.patch("/update-my-profile", (0, checkAuth_1.auth)(enums_1.Role.DOCTOR), (0, validateRequest_1.validateRequest)(doctor_velidation_1.UpdateDoctorProfileValidationZodSchema), doctor_controller_1.DoctorControllers.updateDoctorProfile);
// Public doctor-discovery routes (no auth) — meant for patients browsing before login.
router.get("/public/available-today", doctor_controller_1.DoctorControllers.getAvailableDoctorByTodaysSchedule);
router.get("/public/all-doctors", doctor_controller_1.DoctorControllers.getAllDoctorsListPublic);
router.get("/public/:doctorId", doctor_controller_1.DoctorControllers.getSingleDoctorPublicProfile);
exports.DoctorRoutes = router;
