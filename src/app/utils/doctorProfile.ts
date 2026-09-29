import httpStatus from "http-status";
import { prisma } from "../lib/prisma";
import { AppError } from "./appError";

/**
 * Resolves the caller's own Doctor profile.
 *
 * A DOCTOR user without a doctors row is a broken state, not a missing route:
 * the token is valid and the role check already passed. The 14 doctor lookups
 * this replaces each threw 404 with a copy-pasted message, which read as a
 * routing failure and gave the caller nothing to act on.
 *
 * Only use this for the caller's own profile. Lookups of a *target* doctor by
 * an explicit doctorId must keep their own 404.
 */
export const getDoctorProfileOrThrow = async (userId: string) => {
	const doctor = await prisma.doctor.findUnique({
		where: { userId },
	});

	if (!doctor) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Your doctor profile could not be found. Please contact support.",
		);
	}

	return doctor;
};
