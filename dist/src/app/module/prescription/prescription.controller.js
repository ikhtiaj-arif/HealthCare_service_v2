"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrescriptionController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = require("../../utils/catchAsync");
const sendResponse_1 = require("../../utils/sendResponse");
const prescription_service_1 = require("./prescription.service");
const createPrescription = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const payload = req.body;
    const user = req.user;
    const result = await prescription_service_1.PrescriptionServices.createPrescription(payload, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Prescription Created And Emailed To Patient Successfully",
        data: result,
    });
});
const getSinglePrescription = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const appointmentId = req.params.appointmentId;
    const user = req.user;
    const result = await prescription_service_1.PrescriptionServices.getSinglePrescription(appointmentId, user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Prescription Retrieved Successfully",
        data: result,
    });
});
exports.PrescriptionController = {
    createPrescription,
    getSinglePrescription,
};
