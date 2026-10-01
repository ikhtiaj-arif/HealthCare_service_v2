"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDoctorProfileOrThrow = void 0;
const http_status_1 = __importDefault(require("http-status"));
const prisma_1 = require("../lib/prisma");
const appError_1 = require("./appError");
/**
 * Resolves the caller's own Doctor profile.
 *
 * A DOCTOR user without a doctors row is a broken state, not a missing route:
 * the token is valid and the role check already passed. The 14 doctor lookups
 * this replaces each threw 404 with a copy-pasted message, which read as a
 * routing failure and gave the caller nothing to act on.
 *
 * Only use this for the caller's own profile. Lookups of a *target* doctor by
 * an explicit doctorId must keep their own 404.
 */
const getDoctorProfileOrThrow = async (userId) => {
    const doctor = await prisma_1.prisma.doctor.findUnique({
        where: { userId },
    });
    if (!doctor) {
        throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "Your doctor profile could not be found. Please contact support.");
    }
    return doctor;
};
exports.getDoctorProfileOrThrow = getDoctorProfileOrThrow;
