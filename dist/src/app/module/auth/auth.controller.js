"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const catchAsync_1 = require("../../utils/catchAsync");
const http_status_1 = __importDefault(require("http-status"));
const sendResponse_1 = require("../../utils/sendResponse");
const appError_1 = require("../../utils/appError");
const devLog_1 = require("../../utils/devLog");
const registerPatient = (0, catchAsync_1.catchAsync)(async (req, res) => {
    // const payload = PatientRegistrationZodSchema.safeParse(req.body);
    // if (!payload.success) {
    // 	throw new Error(payload.error.message);
    // }
    const payload = req.body;
    const result = await auth_service_1.AuthService.registerPatient(payload);
    // const { accessToken, refreshToken, user, patient } = result;
    // res.cookie("accessToken", accessToken, {
    // 	httpOnly: true,
    // 	secure: false,
    // 	sameSite: "none",
    // 	maxAge: 1000 * 60 * 60 * 24, // 24 hour or 1 day
    // });
    // res.cookie("refreshToken", refreshToken, {
    // 	httpOnly: true,
    // 	secure: false,
    // 	sameSite: "none",
    // 	maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    // });
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Verification OTP sent!",
        data: null,
        // data: {
        // 	accessToken,
        // 	refreshToken,
        // 	user,
        // 	patient,
        // },
    });
});
const verifyPatientEmail = (0, catchAsync_1.catchAsync)(async (req, res) => {
    // const payload = PatientRegistrationZodSchema.safeParse(req.body);
    // if (!payload.success) {
    // 	throw new Error(payload.error.message);
    // }
    const payload = req.body;
    const result = await auth_service_1.AuthService.verifyPatientEmail(payload);
    const { accessToken, refreshToken, user, patient } = result;
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: (0, devLog_1.isDev)() ? false : true,
        sameSite: (0, devLog_1.isDev)() ? "lax" : "none",
        maxAge: 1000 * 60 * 60 * 24, // 24 hour or 1 day
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: (0, devLog_1.isDev)() ? false : true,
        sameSite: (0, devLog_1.isDev)() ? "lax" : "none",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Email verification successful!",
        data: {
            accessToken,
            refreshToken,
            user,
            patient,
        },
    });
});
const loginUser = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const payload = req.body;
    const result = await auth_service_1.AuthService.loginUser(payload);
    const { accessToken, refreshToken } = result;
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: (0, devLog_1.isDev)() ? false : true,
        sameSite: (0, devLog_1.isDev)() ? "lax" : "none",
        maxAge: 1000 * 60 * 60 * 24, // 24 hour or 1 day
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: (0, devLog_1.isDev)() ? false : true,
        sameSite: (0, devLog_1.isDev)() ? "lax" : "none",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "User logged in successfully",
        data: {
            accessToken,
            refreshToken,
        },
    });
});
const logoutUser = (0, catchAsync_1.catchAsync)(async (req, res) => {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "User logged out successfully",
        data: null,
    });
});
const getMe = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    if (!user) {
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "User information is missing in the request");
    }
    const result = await auth_service_1.AuthService.getMe(user);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "User profile fetched successfully",
        data: result,
    });
});
const refreshToken = (0, catchAsync_1.catchAsync)(async (req, res) => {
    if (!req.cookies.refreshToken) {
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "Refresh token is missing");
    }
    const result = await auth_service_1.AuthService.refreshToken(req.cookies.refreshToken);
    const { accessToken, refreshToken: newRefreshToken } = result;
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: (0, devLog_1.isDev)() ? false : true,
        sameSite: (0, devLog_1.isDev)() ? "lax" : "none",
        maxAge: 1000 * 60 * 60 * 24, // 24 hour or 1 day
    });
    res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: (0, devLog_1.isDev)() ? false : true,
        sameSite: (0, devLog_1.isDev)() ? "lax" : "none",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "New tokens generated successfully",
        data: {
            accessToken,
            refreshToken: newRefreshToken,
        },
    });
});
const googleLogin = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const payload = req.body;
    const result = await auth_service_1.AuthService.googleLogin(payload);
    const { accessToken, refreshToken } = result;
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: (0, devLog_1.isDev)() ? false : true,
        sameSite: (0, devLog_1.isDev)() ? "lax" : "none",
        maxAge: 1000 * 60 * 60 * 24, // 24 hour or 1 day
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: (0, devLog_1.isDev)() ? false : true,
        sameSite: (0, devLog_1.isDev)() ? "lax" : "none",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "User logged in successfully",
        data: {
            accessToken,
            refreshToken,
        },
    });
});
const forgotPassword = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const payload = req.body;
    await auth_service_1.AuthService.forgotPassword(payload);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: `OTP sent to email: ${payload.email}`,
        data: null,
    });
});
const resetPassword = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const payload = req.body;
    await auth_service_1.AuthService.resetPassword(payload);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Password changed successfully!",
        data: null,
    });
});
exports.AuthController = {
    registerPatient,
    loginUser,
    getMe,
    refreshToken,
    googleLogin,
    forgotPassword,
    resetPassword,
    verifyPatientEmail,
    logoutUser
};
