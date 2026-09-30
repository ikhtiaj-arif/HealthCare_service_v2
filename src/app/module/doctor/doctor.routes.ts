import { Router } from "express";
import { DoctorControllers } from "./doctor.controller";
import { upload } from "../../lib/multer";

import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import {
  ApproveDoctorZodSchema,
  UpdateDoctorProfileValidationZodSchema,
  VerifyDoctorEmailZodSchema,
} from "./doctor.velidation";

const router = Router();

router.post(
  "/apply-as-doctor",
  upload.fields([
    {
      name: "resume",
      maxCount: 1,
    },
    {
      name: "additionalFiles",
      maxCount: 5,
    },
  ]),

  DoctorControllers.applyAsDoctor,
);

router.post(
  "/apply-as-doctor/verify-email",
  validateRequest(VerifyDoctorEmailZodSchema),
  DoctorControllers.verifyDoctorEmail,
);
router.post(
  "/approve-doctor",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(ApproveDoctorZodSchema),
  DoctorControllers.approveDoctor,
);
router.get(
  "/all-doctors",
  auth(Role.ADMIN, Role.SUPER_ADMIN),

  DoctorControllers.getAllDoctors,
);
router.patch(
  "/update-my-profile",
  auth(Role.DOCTOR),
  validateRequest(UpdateDoctorProfileValidationZodSchema),
  DoctorControllers.updateDoctorProfile,
);

// Public doctor-discovery routes (no auth) — meant for patients browsing before login.
router.get(
  "/public/available-today",
  DoctorControllers.getAvailableDoctorByTodaysSchedule,
);

router.get("/public/all-doctors", DoctorControllers.getAllDoctorsListPublic);

router.get("/public/:doctorId", DoctorControllers.getSingleDoctorPublicProfile);

export const DoctorRoutes = router;
