import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import httpStatus from "http-status";
import { sendResponse } from "../../utils/sendResponse";
import { AppointmentServices } from "./appointment.service";

const bookAppointment = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;
	const result = await AppointmentServices.bookAppointment(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Appointment Initiated Successfully!",
		data: result,
	});
});
const payAppointment = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;
	const result = await AppointmentServices.payAppointment(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Appointment Initiated Successfully!",
		data: result,
	});
});
const cancelAppointment = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;
	const result = await AppointmentServices.cancelAppointment(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Appointment Canceled and Refunded Successfully!",
		data: result,
	});
});
const bookAppointmentCallback = catchAsync(
	async (req: Request, res: Response) => {
		const { redirectUrl } = await AppointmentServices.bookAppointmentCallback(
			req.query,
		);
		res.redirect(redirectUrl);

		// sendResponse(res, {
		// 	statusCode: httpStatus.CREATED,
		// 	success: true,
		// 	message: "Verification OTP sent!",
		// 	data: result,

		// });
	},
);

export const AppointmentControllers = {
	bookAppointment,
	bookAppointmentCallback,
	payAppointment,
	cancelAppointment
};
