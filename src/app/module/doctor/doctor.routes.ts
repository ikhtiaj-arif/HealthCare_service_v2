import { Router } from "express"; 
import { DoctorControllers } from "./doctor.controller";
import { upload } from "../../lib/multer";

const router = Router();

router.post(
	"/apply-as-doctor",
    upload.fields([
        {
            name: "resume",
            maxCount: 1
        }, 
        {
            name: "additionalFiles",
            maxCount: 5
        }
    ]),
 
	DoctorControllers.applyAsDoctor,
);

export const DoctorRoutes = router;
