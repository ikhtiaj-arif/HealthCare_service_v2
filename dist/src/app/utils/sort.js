"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRelationSort = exports.parseSort = exports.PAYMENT_SORTABLE_FIELDS = exports.SCHEDULE_SORTABLE_FIELDS = exports.DOCTOR_SORTABLE_FIELDS = exports.APPOINTMENT_SORTABLE_FIELDS = void 0;
const http_status_1 = __importDefault(require("http-status"));
const appError_1 = require("./appError");
/**
 * Columns each list endpoint accepts in `sortBy`.
 *
 * These mirror the models in `prisma/schema/`, not the `select` of the query
 * that happens to use them — Prisma can order by any column on the model even
 * when the response omits it. Keep each list narrow: a list only needs the
 * columns a caller would plausibly sort on, and a wider list is a wider
 * surface to keep in sync.
 */
exports.APPOINTMENT_SORTABLE_FIELDS = [
    "createdAt",
    "updatedAt",
    "status",
    "joiningTime",
    "serialNumber",
];
exports.DOCTOR_SORTABLE_FIELDS = [
    "createdAt",
    "updatedAt",
    "name",
    "specialization",
    "experienceYears",
    "consultationFee",
    "verificationStatus",
];
exports.SCHEDULE_SORTABLE_FIELDS = [
    "createdAt",
    "updatedAt",
    "startDateTime",
    "endDateTime",
    "totalSlots",
    "availableSlots",
    "status",
];
exports.PAYMENT_SORTABLE_FIELDS = [
    "createdAt",
    "updatedAt",
    "status",
    "amount",
    "currency",
    "paidAt",
    "refundAmount",
];
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
const parseSort = (query, allowedFields, fallbackField = "createdAt") => {
    const { sortBy, sortOrder } = query;
    if (sortBy && !allowedFields.includes(sortBy)) {
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, `Cannot sort by "${sortBy}". Allowed fields: ${allowedFields.join(", ")}`);
    }
    return {
        sortBy: (sortBy ?? fallbackField),
        sortOrder: sortOrder === "asc" || sortOrder === "desc" ? sortOrder : "desc",
    };
};
exports.parseSort = parseSort;
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
const parseRelationSort = (query, outer, inner) => {
    const { sortBy } = query;
    const sortOrder = query.sortOrder === "asc" || query.sortOrder === "desc"
        ? query.sortOrder
        : "desc";
    if (sortBy) {
        const inOuter = outer.fields.includes(sortBy);
        const inInner = inner.fields.includes(sortBy);
        if (!inOuter && !inInner) {
            // createdAt/updatedAt/status are on both models, so de-duplicate or the
            // error names the same column twice.
            const allowed = [...new Set([...outer.fields, ...inner.fields])];
            throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, `Cannot sort by "${sortBy}". Allowed fields: ${allowed.join(", ")}`);
        }
        return {
            outerField: (inOuter ? sortBy : outer.fallback),
            innerField: (inInner ? sortBy : inner.fallback),
            sortBy: sortBy,
            sortOrder,
        };
    }
    return {
        outerField: outer.fallback,
        innerField: inner.fallback,
        sortBy: undefined,
        sortOrder,
    };
};
exports.parseRelationSort = parseRelationSort;
