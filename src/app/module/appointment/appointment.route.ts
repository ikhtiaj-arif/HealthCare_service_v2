import { Router } from "express";
import { AppointmentControllers } from "./appointment.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";
import { BookAppointmentValidationZodSchema, UpdateAppointmentStatusValidationZodSchema } from "./appointment.validation";

const router = Router();

router.post(
	"/book-appointment",
	auth(Role.PATIENT),
 validateRequest(BookAppointmentValidationZodSchema),
	AppointmentControllers.bookAppointment,
);
router.post(
	"/pay-appointment",
	auth(Role.PATIENT),
	AppointmentControllers.payAppointment,
);
router.post(
	"/cancel-appointment",
	auth(Role.PATIENT, Role.ADMIN, Role.SUPER_ADMIN),
	AppointmentControllers.cancelAppointment,
);

//book appointment callback url
router.get(
	"/book-appointment/payment/callback",
	AppointmentControllers.bookAppointmentCallback,
);


router.patch(
	"/update-status/:appointmentId",
	auth(Role.DOCTOR),
	validateRequest(UpdateAppointmentStatusValidationZodSchema),
	AppointmentControllers.updateAppointmentStatus,
);

router.get(
	"/my-appointments",
	auth(Role.PATIENT),
	AppointmentControllers.getMyAppointments,
);

router.get(
	"/doctor-appointments",
	auth(Role.DOCTOR),
	AppointmentControllers.getDoctorAppointments,
);

router.get(
	"/all-appointments",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	AppointmentControllers.getAllAppointments,
);

router.get(
	"/:appointmentId",
	auth(Role.PATIENT, Role.DOCTOR, Role.ADMIN, Role.SUPER_ADMIN),
	AppointmentControllers.getSingleAppointment,
);


export const AppointmentRoutes = router;
