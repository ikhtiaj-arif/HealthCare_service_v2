import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import httpStatus from "http-status";
import { sendResponse } from "../../utils/sendResponse";
import { AppointmentServices } from "./appointment.service";

const bookAppointment = catchAsync(async (req: Request, res: Response) => {
	const result = await AppointmentServices.bookAppointment();

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Verification OTP sent!",
		data: result,
	});
});
const bookAppointmentCallback = catchAsync(
	async (req: Request, res: Response) => {
		const { executedPaymentResult, redirectUrl } =
			await AppointmentServices.bookAppointmentCallback(req.query);
		console.log("callback controller: ", executedPaymentResult);
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
};
