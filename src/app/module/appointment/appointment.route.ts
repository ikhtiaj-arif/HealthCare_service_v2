import { Router } from "express";
import { AppointmentControllers } from "./appointment.controller";

const router = Router();

router.post("/book-appointment", AppointmentControllers.bookAppointment);

//book appointment callback url
router.get("/book-appointment/callback", AppointmentControllers.bookAppointmentCallback);

export const AppointmentRoutes = router;
