"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorControllers = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const doctor_service_1 = require("./doctor.service");
const sendResponse_1 = require("../../utils/sendResponse");
const doctor_velidation_1 = require("./doctor.velidation");
const http_status_1 = __importDefault(require("http-status"));
const appError_1 = require("../../utils/appError");
const applyAsDoctor = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const files = req.files;
    // `files?.["resume"][0]` only guarded `files` itself, so a multipart body
    // that carried additionalFiles but no resume part threw a TypeError here and
    // surfaced as a 500.
    const resume = files?.["resume"]?.[0];
    if (!resume)
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "No resume file provided");
    const additionalFiles = files?.["additionalFiles"] || [];
    // This route is multipart, so the JSON payload travels in a `data` form field
    // and cannot go through validateRequest. Parse it here and report a missing or
    // malformed field as a 400 rather than letting JSON.parse throw.
    let rawPayload;
    try {
        rawPayload = JSON.parse(req.body.data);
    }
    catch {
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "Request body must include a `data` form field containing the JSON payload");
    }
    const zodValidationResult = doctor_velidation_1.ApplyAsDoctorZodValidationSchema.safeParse(rawPayload);
    if (!zodValidationResult.success)
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, zodValidationResult.error.issues[0].message);
    const payload = zodValidationResult.data;
    const result = await doctor_service_1.DoctorServices.applyAsDoctor(payload, resume, additionalFiles);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Applied As Doctor Successfully",
        data: result,
    });
});
const verifyDoctorEmail = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const payload = req.body;
    const result = await doctor_service_1.DoctorServices.verifyDoctorEmail(payload);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Doctor Email Verified Successfully",
        data: result,
    });
});
const approveDoctor = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const payload = req.body;
    const reviewer = req.user;
    const result = await doctor_service_1.DoctorServices.approveDoctor(payload, reviewer);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Doctor Reviewed Successfully",
        data: result,
    });
});
const getAllDoctors = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { data, meta } = await doctor_service_1.DoctorServices.getAllDoctors(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Doctor Retrieved Successfully",
        data,
        meta,
    });
});
const updateDoctorProfile = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const payload = req.body;
    const user = req.user;
    const result = await doctor_service_1.DoctorServices.updateDoctorProfile(payload, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Doctor Profile Updated Successfully",
        data: result,
    });
});
const getAvailableDoctorByTodaysSchedule = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { data, meta } = await doctor_service_1.DoctorServices.getAvailableDoctorByTodaysSchedule(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Today's Available Doctors Retrieved Successfully",
        data,
        meta,
    });
});
const getAllDoctorsListPublic = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { data, meta } = await doctor_service_1.DoctorServices.getAllDoctorsListPublic(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Doctors Retrieved Successfully",
        data,
        meta,
    });
});
const getSingleDoctorPublicProfile = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const doctorId = req.params.doctorId;
    const result = await doctor_service_1.DoctorServices.getSingleDoctorPublicProfile(doctorId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Doctor Profile Retrieved Successfully",
        data: result,
    });
});
exports.DoctorControllers = {
    applyAsDoctor,
    verifyDoctorEmail,
    approveDoctor,
    getAllDoctors,
    updateDoctorProfile,
    getAvailableDoctorByTodaysSchedule,
    getAllDoctorsListPublic,
    getSingleDoctorPublicProfile,
};
