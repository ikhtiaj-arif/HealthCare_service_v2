"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const sendResponse_1 = require("../../utils/sendResponse");
const payment_service_1 = require("./payment.service");
const http_status_1 = __importDefault(require("http-status"));
const getMyPayments = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    const { data, meta } = await payment_service_1.PaymentServices.getMyPayments(req.query, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Payments Retrieved Successfully",
        data,
        meta,
    });
});
const getAllPayments = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { data, meta } = await payment_service_1.PaymentServices.getAllPayments(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Payments Retrieved Successfully",
        data,
        meta,
    });
});
const getSinglePayment = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const paymentId = req.params.paymentId;
    const user = req.user;
    const result = await payment_service_1.PaymentServices.getSinglePayment(paymentId, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Payment Retrieved Successfully",
        data: result,
    });
});
exports.PaymentController = {
    getMyPayments,
    getAllPayments,
    getSinglePayment,
};
