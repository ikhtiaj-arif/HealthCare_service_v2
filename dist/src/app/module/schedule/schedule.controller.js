"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = require("../../utils/catchAsync");
const sendResponse_1 = require("../../utils/sendResponse");
const schedule_service_1 = require("./schedule.service");
const createSchedule = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const payload = req.body;
    const user = req.user;
    const result = await schedule_service_1.ScheduleServices.createSchedule(payload, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Schedule Created Successfully",
        data: result,
    });
});
const getMySchedules = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    const { data, meta } = await schedule_service_1.ScheduleServices.getMySchedules(req.query, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Schedules Retrieved Successfully",
        data,
        meta,
    });
});
const getAllSchedules = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { data, meta } = await schedule_service_1.ScheduleServices.getAllSchedules(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Schedules Retrieved Successfully",
        data,
        meta,
    });
});
const getTodaysSchedules = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { data, meta } = await schedule_service_1.ScheduleServices.getTodaysSchedules(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Today's Schedules Retrieved Successfully",
        data,
        meta,
    });
});
const getScheduleById = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const scheduleId = req.params.scheduleId;
    const result = await schedule_service_1.ScheduleServices.getScheduleById(scheduleId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Schedule Retrieved Successfully",
        data: result,
    });
});
const updateSchedule = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const scheduleId = req.params.scheduleId;
    const payload = req.body;
    const user = req.user;
    const result = await schedule_service_1.ScheduleServices.updateSchedule(scheduleId, payload, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Schedule Updated Successfully",
        data: result,
    });
});
const publishSchedule = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const scheduleId = req.params.scheduleId;
    const user = req.user;
    const result = await schedule_service_1.ScheduleServices.publishSchedule(scheduleId, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Schedule Published Successfully",
        data: result,
    });
});
const deleteSchedule = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const scheduleId = req.params.scheduleId;
    const user = req.user;
    const result = await schedule_service_1.ScheduleServices.deleteSchedule(scheduleId, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Schedule Deleted Successfully",
        data: result,
    });
});
exports.ScheduleController = {
    createSchedule,
    getMySchedules,
    getAllSchedules,
    getTodaysSchedules,
    getScheduleById,
    updateSchedule,
    publishSchedule,
    deleteSchedule,
};
