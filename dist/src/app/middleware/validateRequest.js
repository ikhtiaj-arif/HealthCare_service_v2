"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = require("../utils/appError");
const http_status_1 = __importDefault(require("http-status"));
const validateRequest = (zodSchema) => {
    return (0, catchAsync_1.catchAsync)((req, res, next) => {
        const payload = req.body ?? {};
        const result = zodSchema.safeParse(payload);
        if (!result.success) {
            throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, result.error.issues[0].message);
        }
        req.body = result.data;
        next();
    });
};
exports.validateRequest = validateRequest;
