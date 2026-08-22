import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { DoctorServices } from "./doctor.service";
import { sendResponse } from "../../utils/sendResponse";
import { Request, Response } from "express";
import { ApplyAsDoctorZodValidationSchema } from "./doctor.velidation";

const applyAsDoctor = catchAsync(async (req: Request, res: Response) => {

	const files = req.files as { [filename: string]: Express.Multer.File[] };
	
    const resume = files?.["resume"][0];
	const additionalFiles = files?.["additionalFiles"] || [];


	const zodValidationResult = ApplyAsDoctorZodValidationSchema.safeParse(JSON.parse(req.body.data))
	
	if(!zodValidationResult.success) throw new Error(zodValidationResult.error.issues[0].message);
	
	const payload= zodValidationResult.data


	console.log({
		resume,
		additionalFiles,
		payload,
	});
	const result = await DoctorServices.applyAsDoctor(payload, resume, additionalFiles);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Applied As Doctor Successfully",
		data: result,
	});
});

export const DoctorControllers = {
	applyAsDoctor,
};
