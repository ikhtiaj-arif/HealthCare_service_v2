import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { DoctorServices } from "./doctor.service";
import { sendResponse } from "../../utils/sendResponse";
import { ApplyAsDoctorZodValidationSchema } from "./doctor.velidation";
import httpStatus from "http-status";

const applyAsDoctor = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as { [filename: string]: Express.Multer.File[] };

  const resume = files?.["resume"][0];
  const additionalFiles = files?.["additionalFiles"] || [];

  const zodValidationResult = ApplyAsDoctorZodValidationSchema.safeParse(
    JSON.parse(req.body.data),
  );

  if (!zodValidationResult.success)
    throw new Error(zodValidationResult.error.issues[0].message);

  const payload = zodValidationResult.data;

  console.log({
    resume,
    additionalFiles,
    payload,
  });
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
    message: "Doctor Email Verified Successfully",
    data: result,
  });
});

export const DoctorControllers = {
  applyAsDoctor,
  verifyDoctorEmail,
  approveDoctor,
};
