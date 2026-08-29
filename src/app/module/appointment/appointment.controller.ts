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
const updateAppointmentStatus = catchAsync(
  async (req: Request, res: Response) => {
    const appointmentId = req.params.appointmentId as string;
    const payload = req.body;
    const user = req.user!;

    const result = await AppointmentServices.updateAppointmentStatus(
      appointmentId,
      payload,
      user,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Appointment Status Updated Successfully",
      data: result,
    });
  },
);

const getMyAppointments = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;

  const { data, meta } = await AppointmentServices.getMyAppointments(
    req.query,
    user,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Appointments Retrieved Successfully",
    data,
    meta,
  });
});

const getDoctorAppointments = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user!;

    const { data, meta } = await AppointmentServices.getDoctorAppointments(
      req.query,
      user,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Appointments Retrieved Successfully",
      data,
      meta,
    });
  },
);

const getAllAppointments = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const { data, meta } = await AppointmentServices.getAllAppointments(
    req.query,
    user,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Appointments Retrieved Successfully",
    data,
    meta,
  });
});

const getSingleAppointment = catchAsync(async (req: Request, res: Response) => {
  const appointmentId = req.params.appointmentId as string;
  const user = req.user!;

  const result = await AppointmentServices.getSingleAppointment(
    appointmentId,
    user,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Appointment Retrieved Successfully",
    data: result,
  });
});

export const AppointmentControllers = {
  bookAppointment,
  bookAppointmentCallback,
  payAppointment,
  cancelAppointment,
  updateAppointmentStatus,
  getMyAppointments,
  getDoctorAppointments,
  getAllAppointments,
  getSingleAppointment,
};
