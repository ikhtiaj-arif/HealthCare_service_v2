import { Router } from "express";
import { DoctorControllers } from "./doctor.controller";
import { upload } from "../../lib/multer";

import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";

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

  DoctorControllers.verifyDoctorEmail,
);
router.post(
  "/approve-doctor",
  auth(Role.ADMIN, Role.SUPER_ADMIN),

  DoctorControllers.approveDoctor,
);

export const DoctorRoutes = router;
