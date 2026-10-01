"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = require("../../utils/catchAsync");
const sendResponse_1 = require("../../utils/sendResponse");
const user_service_1 = require("./user.service");
const appError_1 = require("../../utils/appError");
const uploadProfileImage = (0, catchAsync_1.catchAsync)(async (req, res) => {
    if (!req.file)
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "No file provided");
    const userId = req?.user?.userId;
    const result = await user_service_1.userService.uploadProfileImage(req?.file.buffer, userId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Profile Picture Updated ",
        data: result,
    });
});
exports.userController = {
    uploadProfileImage
};
