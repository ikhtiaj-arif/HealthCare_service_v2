import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { DoctorServices } from "./doctor.service";
import { sendResponse } from "../../utils/sendResponse";
import { ApplyAsDoctorZodValidationSchema } from "./doctor.velidation";
import httpStatus from "http-status";
import { AppError } from "../../utils/appError";

const applyAsDoctor = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as { [filename: string]: Express.Multer.File[] };

  // `files?.["resume"][0]` only guarded `files` itself, so a multipart body
  // that carried additionalFiles but no resume part threw a TypeError here and
  // surfaced as a 500.
  const resume = files?.["resume"]?.[0];

  if (!resume)
    throw new AppError(httpStatus.BAD_REQUEST, "No resume file provided");

  const additionalFiles = files?.["additionalFiles"] || [];

  // This route is multipart, so the JSON payload travels in a `data` form field
  // and cannot go through validateRequest. Parse it here and report a missing or
  // malformed field as a 400 rather than letting JSON.parse throw.
  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(req.body.data);
  } catch {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Request body must include a `data` form field containing the JSON payload",
    );
  }

  const zodValidationResult = ApplyAsDoctorZodValidationSchema.safeParse(rawPayload);

  if (!zodValidationResult.success)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      zodValidationResult.error.issues[0].message,
    );

  const payload = zodValidationResult.data;

  const result = await DoctorServices.applyAsDoctor(
    payload,
    resume,
    additionalFiles,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Applied As Doctor Successfully",
    data: result,
  });
});
const verifyDoctorEmail = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  const result = await DoctorServices.verifyDoctorEmail(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Doctor Email Verified Successfully",
    data: result,
  });
});
const approveDoctor = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const reviewer = req.user!;
  const result = await DoctorServices.approveDoctor(payload, reviewer);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Doctor Reviewed Successfully",
    data: result,
  });
});
const getAllDoctors = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await DoctorServices.getAllDoctors(req.query);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Doctor Retrieved Successfully",
    data,
    meta,
  });
});
const updateDoctorProfile = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const user = req.user!;

  const result = await DoctorServices.updateDoctorProfile(payload, user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Doctor Profile Updated Successfully",
    data: result,
  });
});

const getAvailableDoctorByTodaysSchedule = catchAsync(
  async (req: Request, res: Response) => {
    const { data, meta } =
      await DoctorServices.getAvailableDoctorByTodaysSchedule(req.query);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Today's Available Doctors Retrieved Successfully",
      data,
      meta,
    });
  },
);

const getAllDoctorsListPublic = catchAsync(
  async (req: Request, res: Response) => {
    const { data, meta } = await DoctorServices.getAllDoctorsListPublic(
      req.query,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Doctors Retrieved Successfully",
      data,
      meta,
    });
  },
);

const getSingleDoctorPublicProfile = catchAsync(
  async (req: Request, res: Response) => {
    const doctorId = req.params.doctorId as string;

    const result = await DoctorServices.getSingleDoctorPublicProfile(doctorId);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Doctor Profile Retrieved Successfully",
      data: result,
    });
  },
);

export const DoctorControllers = {
  applyAsDoctor,
  verifyDoctorEmail,
  approveDoctor,
  getAllDoctors,
  updateDoctorProfile,
  getAvailableDoctorByTodaysSchedule,
  getAllDoctorsListPublic,
  getSingleDoctorPublicProfile,
};
