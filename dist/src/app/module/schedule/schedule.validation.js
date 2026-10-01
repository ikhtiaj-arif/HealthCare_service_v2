"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateScheduleValidationZodSchema = exports.CreateScheduleValidationZodSchema = void 0;
const zod_1 = require("zod");
exports.CreateScheduleValidationZodSchema = zod_1.z
    .object({
    startDateTime: zod_1.z.coerce.date("Invalid Start Date Time"),
    endDateTime: zod_1.z.coerce.date("Invalid End Date Time"),
    meetingLink: zod_1.z.url("Invalid Meeting Link").trim(),
});
exports.UpdateScheduleValidationZodSchema = zod_1.z
    .object({
    startDateTime: zod_1.z.coerce.date("Invalid Start Date Time").optional(),
    endDateTime: zod_1.z.coerce.date("Invalid End Date Time").optional(),
    meetingLink: zod_1.z.url("Invalid Meeting Link").trim().optional(),
});
