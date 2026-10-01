"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentControllers = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = require("../../utils/sendResponse");
const appointment_service_1 = require("./appointment.service");
const bookAppointment = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const payload = req.body;
    const user = req.user;
    const result = await appointment_service_1.AppointmentServices.bookAppointment(payload, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Appointment Initiated Successfully!",
        data: result,
    });
});
const payAppointment = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const payload = req.body;
    const user = req.user;
    const result = await appointment_service_1.AppointmentServices.payAppointment(payload, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Appointment Initiated Successfully!",
        data: result,
    });
});
const cancelAppointment = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const payload = req.body;
    const user = req.user;
    const result = await appointment_service_1.AppointmentServices.cancelAppointment(payload, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Appointment Canceled and Refunded Successfully!",
        data: result,
    });
});
const bookAppointmentCallback = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { redirectUrl } = await appointment_service_1.AppointmentServices.bookAppointmentCallback(req.query);
    res.redirect(redirectUrl);
    // sendResponse(res, {
    // 	statusCode: httpStatus.CREATED,
    // 	success: true,
    // 	message: "Verification OTP sent!",
    // 	data: result,
    // });
});
const updateAppointmentStatus = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const appointmentId = req.params.appointmentId;
    const payload = req.body;
    const user = req.user;
    const result = await appointment_service_1.AppointmentServices.updateAppointmentStatus(appointmentId, payload, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Appointment Status Updated Successfully",
        data: result,
    });
});
const getMyAppointments = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    const { data, meta } = await appointment_service_1.AppointmentServices.getMyAppointments(req.query, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Appointments Retrieved Successfully",
        data,
        meta,
    });
});
const getDoctorAppointments = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    const { data, meta } = await appointment_service_1.AppointmentServices.getDoctorAppointments(req.query, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Appointments Retrieved Successfully",
        data,
        meta,
    });
});
const getAllAppointments = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    const { data, meta } = await appointment_service_1.AppointmentServices.getAllAppointments(req.query, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Appointments Retrieved Successfully",
        data,
        meta,
    });
});
const getSingleAppointment = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const appointmentId = req.params.appointmentId;
    const user = req.user;
    const result = await appointment_service_1.AppointmentServices.getSingleAppointment(appointmentId, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Appointment Retrieved Successfully",
        data: result,
    });
});
exports.AppointmentControllers = {
    bookAppointment,
    bookAppointmentCallback,
    payAppointment,
    cancelAppointment,
    updateAppointmentStatus,
    getMyAppointments,
    getDoctorAppointments,
    getAllAppointments,
    getSingleAppointment,
};
