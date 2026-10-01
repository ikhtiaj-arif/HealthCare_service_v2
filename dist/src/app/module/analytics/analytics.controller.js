"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = require("../../utils/catchAsync");
const sendResponse_1 = require("../../utils/sendResponse");
const analytics_service_1 = require("./analytics.service");
const getPatientAnalytics = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    const result = await analytics_service_1.AnalyticsServices.getPatientAnalytics(user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Patient Analytics Retrieved Successfully",
        data: result,
    });
});
const getDoctorAnalytics = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    const result = await analytics_service_1.AnalyticsServices.getDoctorAnalytics(user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Doctor Analytics Retrieved Successfully",
        data: result,
    });
});
const getAdminAnalytics = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const result = await analytics_service_1.AnalyticsServices.getAdminAnalytics();
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Admin Analytics Retrieved Successfully",
        data: result,
    });
});
exports.AnalyticsController = {
    getPatientAnalytics,
    getDoctorAnalytics,
    getAdminAnalytics,
};
