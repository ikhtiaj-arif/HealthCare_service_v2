import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { Prisma } from "../../generated/prisma/client";
import { AppError } from "../utils/appError";
import { devLog, isDev } from "../utils/devLog";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const globalErrorHandler = async (
	err: any,
	_req: Request,
	res: Response,
	_next: NextFunction,
) => {
	devLog("Error from Global Error Handler", err);

	let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
	let errorMessage = err.message || "Internal Server Error";
	const errorName = err.name || "Internal Server Error";
	// Intentional client-facing copy (AppError, mapped Prisma). Unexpected
	// Error.message stays masked in production so internals do not leak.
	let exposeToClient = false;

	if (err instanceof Prisma.PrismaClientValidationError) {
		statusCode = httpStatus.BAD_REQUEST;
		errorMessage = "You have provided incorrect field type or missing fields";
		exposeToClient = true;
	} else if (err instanceof Prisma.PrismaClientKnownRequestError) {
		if (err.code === "P2002") {
			statusCode = httpStatus.BAD_REQUEST;
			errorMessage = "Duplicate Key Error";
			exposeToClient = true;
		} else if (err.code === "P2003") {
			statusCode = httpStatus.BAD_REQUEST;
			errorMessage = "Foreign key constraint failed";
			exposeToClient = true;
		} else if (err.code === "P2025") {
			statusCode = httpStatus.BAD_REQUEST;
			errorMessage =
				"An operation failed because it depends on one or more records that were required but not found.";
			exposeToClient = true;
		}
	} else if (err instanceof Prisma.PrismaClientInitializationError) {
		if (err.errorCode === "P1000") {
			statusCode = httpStatus.UNAUTHORIZED;
			errorMessage =
				"Authentication failed against database server. Please Check Your Credentials";
			exposeToClient = true;
		} else if (err.errorCode === "P1001") {
			statusCode = httpStatus.BAD_REQUEST;
			errorMessage = "Can't reach database server";
			exposeToClient = true;
		}
	} else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
		statusCode = httpStatus.INTERNAL_SERVER_ERROR;
		errorMessage = "Error occurred during query execution";
		exposeToClient = true;
	} else if (err instanceof AppError) {
		errorMessage = err.message;
		statusCode = err.statusCode;
		exposeToClient = true;
	} else if (err instanceof Error) {
		errorMessage = err.message;
	}

	res.status(statusCode).json({
		success: false,
		statusCode: statusCode || httpStatus.INTERNAL_SERVER_ERROR,
		name: isDev() ? errorName : "Error",
		message:
			isDev() || exposeToClient ? errorMessage : "Internal Server Error",
		error: isDev() ? err : undefined,
		stack: isDev() ? err.stack : undefined,
	});
};
