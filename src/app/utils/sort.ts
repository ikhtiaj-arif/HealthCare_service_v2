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
 * Pass the union when one `sortBy` orders more than one model — but prefer
 * `parseRelationSort` there. Validating against a union and applying the result
 * to every model lets an inner-model column reach the outer query.
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

/**
 * Routes one `sortBy` to whichever of two models actually owns that column.
 *
 * `getAvailableDoctorByTodaysSchedule` orders the doctor *and* its nested
 * schedules, and the two models have different columns. It used to validate
 * against the union of both lists and then apply the result to both models, so a
 * perfectly legal `?sortBy=startDateTime` passed validation, reached
 * `prisma.doctor.findMany`, and failed Prisma's own validation as a 500 that
 * said nothing useful. The allow-list made a bad field a 400 but did not stop
 * this case.
 *
 * A column belonging to the inner model orders only the inner relation, and
 * vice versa; the other one falls back to its own default. Sorting the
 * schedules by start time should not also reshuffle the doctors arbitrarily.
 *
 * Returns the resolved field names rather than `orderBy` objects so the caller
 * builds those at the call site, where the computed-key pattern already
 * typechecks against Prisma's generated types.
 */
export const parseRelationSort = <D extends string, S extends string>(
	query: IQuery,
	outer: { fields: readonly D[]; fallback: D },
	inner: { fields: readonly S[]; fallback: S },
) => {
	const { sortBy } = query;
	const sortOrder =
		query.sortOrder === "asc" || query.sortOrder === "desc"
			? query.sortOrder
			: "desc";

	if (sortBy) {
		const inOuter = outer.fields.includes(sortBy as D);
		const inInner = inner.fields.includes(sortBy as S);

		if (!inOuter && !inInner) {
			// createdAt/updatedAt/status are on both models, so de-duplicate or the
			// error names the same column twice.
			const allowed = [...new Set([...outer.fields, ...inner.fields])];
			throw new AppError(
				httpStatus.BAD_REQUEST,
				`Cannot sort by "${sortBy}". Allowed fields: ${allowed.join(", ")}`,
			);
		}

		return {
			outerField: (inOuter ? sortBy : outer.fallback) as D,
			innerField: (inInner ? sortBy : inner.fallback) as S,
			sortBy: sortBy as D | S,
			sortOrder,
		} as const;
	}

	return {
		outerField: outer.fallback,
		innerField: inner.fallback,
		sortBy: undefined,
		sortOrder,
	} as const;
};
