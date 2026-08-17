import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { userService } from "./user.service";


const uploadProfileImage = catchAsync(async (req: Request, res: Response) => {
 
	if(!req.file) throw new Error("No file provided")
        const userId = req?.user?.userId as string
   const result = await userService.uploadProfileImage(req?.file.buffer, userId)
 
 

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Profile Picture Updated ",
	 
		data:result,
	});
});


export const userController= {
    uploadProfileImage
}