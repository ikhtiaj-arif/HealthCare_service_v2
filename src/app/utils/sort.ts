import httpStatus from "http-status";
import type { IQuery } from "../interfaces";
import { AppError } from "./appError";

/**
 * Columns each list endpoint accepts in `sortBy`.
 *
 * These mirror the models in `prisma/schema/`, not the `select` of the query
 * that happens to use them — Prisma can order by any column on the model even
 * when the response omits it. Keep each list narrow: a list only needs the
 * columns a caller would plausibly sort on, and a wider list is a wider
 * surface to keep in sync.
 */
export const APPOINTMENT_SORTABLE_FIELDS = [
	"createdAt",
	"updatedAt",
	"status",
	"joiningTime",
	"serialNumber",
] as const;

export const DOCTOR_SORTABLE_FIELDS = [
	"createdAt",
	"updatedAt",
	"name",
	"specialization",
	"experienceYears",
	"consultationFee",
	"verificationStatus",
] as const;

export const SCHEDULE_SORTABLE_FIELDS = [
	"createdAt",
	"updatedAt",
	"startDateTime",
	"endDateTime",
	"totalSlots",
	"availableSlots",
	"status",
] as const;

export const PAYMENT_SORTABLE_FIELDS = [
	"createdAt",
	"updatedAt",
	"status",
	"amount",
	"currency",
	"paidAt",
	"refundAmount",
] as const;

/**
 * Validates the `sortBy` / `sortOrder` query params against an allow-list.
 *
 * These params used to be interpolated straight into Prisma's `orderBy`, so any
 * unknown field name reached the query builder and surfaced as a Prisma
 * validation error — a 500 that said nothing useful. Every list service now
 * passes the sortable columns of the model it actually queries, which turns a
 * typo into a 400 naming the field.
 *
 * Pass the union when one `sortBy` orders more than one model. For example
 * `getAvailableDoctorByTodaysSchedule` reuses the same `sortBy` for the doctor
 * and for its nested `schedules`, so it passes DOCTOR + SCHEDULE fields.
 *
 * `sortOrder` is not worth an error: an unrecognised value simply falls back to
 * the documented default.
 */
export const parseSort = <T extends string>(
	query: IQuery,
	allowedFields: readonly T[],
	fallbackField: T = "createdAt" as T,
) => {
	const { sortBy, sortOrder } = query;

	if (sortBy && !allowedFields.includes(sortBy as T)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot sort by "${sortBy}". Allowed fields: ${allowedFields.join(", ")}`,
		);
	}

	return {
		sortBy: (sortBy ?? fallbackField) as T,
		sortOrder: sortOrder === "asc" || sortOrder === "desc" ? sortOrder : "desc",
	} as const;
};
