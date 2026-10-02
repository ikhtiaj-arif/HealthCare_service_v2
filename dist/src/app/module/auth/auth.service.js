"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
/** biome-ignore-all lint/style/useConst: <explanation> */
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const enums_1 = require("../../../generated/prisma/enums");
const config_1 = __importDefault(require("../../config"));
const googleAuth_1 = require("../../lib/googleAuth");
const prisma_1 = require("../../lib/prisma");
const jwt_1 = require("../../utils/jwt");
const crypto_1 = __importDefault(require("crypto"));
const redis_1 = require("../../lib/redis");
const nodemailer_1 = require("../../lib/nodemailer");
const ejs_1 = __importDefault(require("ejs"));
const path_1 = __importDefault(require("path"));
const http_status_1 = __importDefault(require("http-status"));
const appError_1 = require("../../utils/appError");
const devLog_1 = require("../../utils/devLog");
const registerPatient = async (payload) => {
    const { name, password, patient: patientData } = payload;
    const email = payload.email.trim().toLowerCase();
    const isUserExists = await prisma_1.prisma.user.findUnique({
        where: { email },
    });
    if (isUserExists) {
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "User with this email already exists");
    }
    const hashedPassword = await bcryptjs_1.default.hash(password, 8);
    const otp = crypto_1.default.randomInt(100000, 1000000).toString();
    const otpKey = `patient-registration-otp:${email}`;
    (0, devLog_1.devLog)(email, otp);
    await redis_1.redisClient.set(otpKey, otp, {
        expiration: {
            type: "EX",
            value: 5 * 60,
        },
    });
    const patientRegistrationKey = `patient-registration-data:${email}`;
    const redisUserDataPayload = {
        name,
        email,
        password: hashedPassword,
        patient: patientData,
    };
    await redis_1.redisClient.set(patientRegistrationKey, JSON.stringify(redisUserDataPayload), {
        expiration: {
            type: "EX",
            value: 5 * 60,
        },
    });
    const templatePath = path_1.default.join(process.cwd(), "src/app/templates/registration-user-otp.ejs");
    const expSec = 5 * 60;
    const html = await ejs_1.default.renderFile(templatePath, {
        name,
        otp,
        expirationMinutes: expSec / 60,
    });
    await nodemailer_1.transporter.sendMail({
        from: config_1.default.email_sender,
        to: email,
        subject: "Email Verification",
        // text: `Your OTP Is: ${otp}`,
        html,
    });
};
const verifyPatientEmail = async (payload) => {
    const email = payload.email.trim().toLowerCase();
    const isUserExists = await prisma_1.prisma.user.findUnique({
        where: { email },
    });
    if (isUserExists?.status === enums_1.UserStatus.BLOCKED) {
        throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "User is Blocked!");
    }
    if (isUserExists?.emailVerified) {
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "Email Already Verified!");
    }
    if (isUserExists?.status === enums_1.UserStatus.DELETED || isUserExists?.isDeleted) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "User is Deleted!");
    }
    const otp = payload.otp;
    const otpKey = `patient-registration-otp:${email}`;
    const redisOTP = await redis_1.redisClient.get(otpKey);
    if (!redisOTP) {
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "Invalid OTP");
    }
    if (redisOTP !== otp) {
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "OTP does not match");
    }
    await redis_1.redisClient.del(otpKey);
    const patientRegistrationKey = `patient-registration-data:${email}`;
    const redisPatientData = await redis_1.redisClient.get(patientRegistrationKey);
    if (!redisPatientData) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "User does not exists");
    }
    const patientPayload = JSON.parse(redisPatientData);
    const createdUser = await prisma_1.prisma.user.create({
        data: {
            name: patientPayload.name,
            email: patientPayload.email,
            password: patientPayload.password,
            role: enums_1.Role.PATIENT,
            status: enums_1.UserStatus.ACTIVE,
            emailVerified: true,
            patient: {
                create: {
                    name: patientPayload.name,
                    email: patientPayload.email,
                    contactNumber: patientPayload?.patient?.contactNumber || "",
                },
            },
        },
        omit: { password: true },
        include: { patient: true },
    });
    await redis_1.redisClient.del(patientRegistrationKey);
    const templatePath = path_1.default.join(process.cwd(), "src/app/templates/patient-welcome-email.ejs");
    const expSec = 5 * 60;
    const html = await ejs_1.default.renderFile(templatePath, {
        name: createdUser.name,
    });
    await nodemailer_1.transporter.sendMail({
        from: config_1.default.email_sender,
        to: email,
        subject: "Welcome to HealthCare System",
        // text: `Your OTP Is: ${otp}`,
        html,
    });
    const { patient, ...user } = createdUser;
    const jwtPayload = {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
    };
    const accessToken = jwt_1.jwtUtils.createToken(jwtPayload, config_1.default.jwt_access_secret, config_1.default.jwt_access_expires_in);
    const refreshToken = jwt_1.jwtUtils.createToken(jwtPayload, config_1.default.jwt_refresh_secret, config_1.default.jwt_refresh_expires_in);
    return {
        user,
        patient,
        accessToken,
        refreshToken,
    };
};
const loginUser = async (payload) => {
    const { password } = payload;
    const email = payload.email.trim().toLowerCase();
    const user = await prisma_1.prisma.user.findUnique({
        where: { email },
    });
    if (!user) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "User not found");
    }
    if (user.status === enums_1.UserStatus.BLOCKED) {
        throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "User is blocked");
    }
    if (user.isDeleted || user.status === enums_1.UserStatus.DELETED) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "User is deleted");
    }
    if (user.password === null && user.googleId !== null) {
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "User Already Has Account Registered With Google. Try To Login With Google.");
    }
    const isPasswordMatched = await bcryptjs_1.default.compare(password, user.password);
    if (!isPasswordMatched) {
        throw new appError_1.AppError(http_status_1.default.UNAUTHORIZED, "Invalid credentials");
    }
    const jwtPayload = {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
    };
    const accessToken = jwt_1.jwtUtils.createToken(jwtPayload, config_1.default.jwt_access_secret, config_1.default.jwt_access_expires_in);
    const refreshToken = jwt_1.jwtUtils.createToken(jwtPayload, config_1.default.jwt_refresh_secret, config_1.default.jwt_refresh_expires_in);
    return {
        accessToken,
        refreshToken,
    };
};
const getMe = async (user) => {
    const isUserExists = await prisma_1.prisma.user.findUnique({
        where: {
            id: user.userId,
        },
        include: {
            patient: true,
            // The client uses this as a positive signal that a DOCTOR has a profile,
            // so every doctor-only screen can explain itself instead of failing a
            // request. The extra columns are the ones the doctor can edit on their
            // profile page — the public profile omits address and contact number,
            // and 404s until the doctor is approved.
            doctor: {
                select: {
                    id: true,
                    name: true,
                    specialization: true,
                    verificationStatus: true,
                    address: true,
                    bio: true,
                    consultationFee: true,
                    contactNumber: true,
                },
            },
        },
        omit: {
            password: true,
        },
    });
    if (!isUserExists) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "User not found");
    }
    return isUserExists;
};
const refreshToken = async (token) => {
    const verifiedRefreshToken = jwt_1.jwtUtils.verifyToken(token, config_1.default.jwt_refresh_secret);
    if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
        throw new appError_1.AppError(http_status_1.default.UNAUTHORIZED, (0, devLog_1.isDev)() ? verifiedRefreshToken.error : "Invalid refresh token");
    }
    const data = verifiedRefreshToken.data;
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: data.userId },
    });
    if (!user || user.isDeleted || user.status !== enums_1.UserStatus.ACTIVE) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "User is inactive or not found");
    }
    const jwtPayload = {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
    };
    const accessToken = jwt_1.jwtUtils.createToken(jwtPayload, config_1.default.jwt_access_secret, config_1.default.jwt_access_expires_in);
    const refreshToken = jwt_1.jwtUtils.createToken(jwtPayload, config_1.default.jwt_refresh_secret, config_1.default.jwt_refresh_expires_in);
    return {
        accessToken,
        refreshToken,
    };
};
const googleLogin = async (payload) => {
    let googleIdTokenPayload = null;
    try {
        const ticket = await googleAuth_1.googleClient.verifyIdToken({
            idToken: payload.idToken,
            audience: config_1.default.google_client_id,
        });
        googleIdTokenPayload = ticket.getPayload();
    }
    catch (error) {
        console.log("Google ID Token Verification Failed", error);
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "Invalid Or Expired Google Id Token");
    }
    if (!googleIdTokenPayload) {
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "Invalid Or Expired Google Id Token");
    }
    if (!googleIdTokenPayload.email) {
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "Google Email Not Found");
    }
    if (!googleIdTokenPayload.name) {
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "Google Email User Name Not Found");
    }
    const ifPatientExistWithGoogleAuth = await prisma_1.prisma.user.findUnique({
        where: {
            email: googleIdTokenPayload.email,
            role: enums_1.Role.PATIENT,
            googleId: googleIdTokenPayload.sub,
        },
    });
    let user = ifPatientExistWithGoogleAuth;
    if (!ifPatientExistWithGoogleAuth) {
        const ifPatientExistWithCredentials = await prisma_1.prisma.user.findUnique({
            where: {
                email: googleIdTokenPayload.email,
                role: enums_1.Role.PATIENT,
                authProvider: enums_1.AuthProvider.CREDENTIAL,
            },
        });
        if (ifPatientExistWithCredentials) {
            if (!ifPatientExistWithCredentials.emailVerified) {
                throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "Email Not Verified");
            }
            if (ifPatientExistWithCredentials.status === enums_1.UserStatus.BLOCKED) {
                throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "User Is Blocked");
            }
            if (ifPatientExistWithCredentials.isDeleted ||
                ifPatientExistWithCredentials.status === enums_1.UserStatus.DELETED) {
                throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "User Is Deleted");
            }
            user = await prisma_1.prisma.user.update({
                where: {
                    id: ifPatientExistWithCredentials.id,
                },
                data: {
                    googleId: googleIdTokenPayload.sub,
                },
            });
        }
        else {
            // Google Register
            user = await prisma_1.prisma.user.create({
                data: {
                    name: googleIdTokenPayload.name,
                    email: googleIdTokenPayload.email,
                    role: enums_1.Role.PATIENT,
                    googleId: googleIdTokenPayload.sub,
                    authProvider: enums_1.AuthProvider.GOOGLE,
                    emailVerified: true,
                    patient: {
                        create: {
                            name: googleIdTokenPayload.name,
                            email: googleIdTokenPayload.email,
                        },
                    },
                },
            });
            const templatePath = path_1.default.join(process.cwd(), "src/app/templates/patient-welcome-email.ejs");
            const html = await ejs_1.default.renderFile(templatePath, {
                name: user.name,
            });
            await nodemailer_1.transporter.sendMail({
                from: config_1.default.email_sender,
                to: user.email,
                subject: "Welcome to HealthCare System",
                // text: `Your OTP Is: ${otp}`,
                html,
            });
        }
    }
    if (!user) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "User Not Found");
    }
    if (user.status === enums_1.UserStatus.BLOCKED) {
        throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "User Is Blocked");
    }
    if (user.isDeleted || user.status === enums_1.UserStatus.DELETED) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "User Is Deleted");
    }
    const jwtPayload = {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
    };
    const accessToken = jwt_1.jwtUtils.createToken(jwtPayload, config_1.default.jwt_access_secret, config_1.default.jwt_access_expires_in);
    const refreshToken = jwt_1.jwtUtils.createToken(jwtPayload, config_1.default.jwt_refresh_secret, config_1.default.jwt_refresh_expires_in);
    return {
        accessToken,
        refreshToken,
    };
};
const forgotPassword = async (payload) => {
    const { email } = payload;
    const isUserExists = await prisma_1.prisma.user.findUnique({
        where: {
            email,
        },
    });
    if (!isUserExists) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "User does not exist!");
    }
    if (!isUserExists.emailVerified) {
        throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "User not verified!");
    }
    if (isUserExists.status === enums_1.UserStatus.BLOCKED) {
        throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "User is Blocked!");
    }
    if (isUserExists.status === enums_1.UserStatus.DELETED || isUserExists.isDeleted) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "User is Deleted!");
    }
    if (isUserExists.googleId &&
        isUserExists.authProvider === enums_1.AuthProvider.GOOGLE) {
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "User Has account with google");
    }
    const otp = crypto_1.default.randomInt(100000, 1000000).toString();
    const key = `forgot_password-otp:${isUserExists.email}`;
    (0, devLog_1.devLog)(isUserExists.email, otp);
    await redis_1.redisClient.set(key, otp, {
        expiration: {
            type: "EX",
            value: 5 * 60,
        },
    });
    const templatePath = path_1.default.join(process.cwd(), "src/app/templates/forgot-password.ejs");
    const expSec = 5 * 60;
    const html = await ejs_1.default.renderFile(templatePath, {
        name: isUserExists.name,
        otp,
        expirationMinutes: expSec / 60,
    });
    await nodemailer_1.transporter.sendMail({
        from: config_1.default.email_sender,
        to: isUserExists.email,
        subject: "Forgot Password",
        // text: `Your OTP Is: ${otp}`,
        html,
    });
};
const resetPassword = async (payload) => {
    const { email, otp, newPassword } = payload;
    const isUserExists = await prisma_1.prisma.user.findUnique({
        where: {
            email,
        },
    });
    if (!isUserExists) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "User does not exist!");
    }
    if (!isUserExists.emailVerified) {
        throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "User not verified!");
    }
    if (isUserExists.status === enums_1.UserStatus.BLOCKED) {
        throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "User is Blocked!");
    }
    if (isUserExists.status === enums_1.UserStatus.DELETED || isUserExists.isDeleted) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "User is Deleted!");
    }
    if (isUserExists.googleId &&
        isUserExists.authProvider === enums_1.AuthProvider.GOOGLE) {
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "User Has account with google");
    }
    const key = `forgot_password-otp:${isUserExists.email}`;
    const redisOTP = await redis_1.redisClient.get(key);
    if (!redisOTP) {
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "Invalid OTP");
    }
    if (redisOTP !== otp) {
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "OTP does not match");
    }
    const hashedNewPass = await bcryptjs_1.default.hash(newPassword, 8);
    await prisma_1.prisma.user.update({
        where: {
            email: isUserExists.email,
        },
        data: {
            password: hashedNewPass,
        },
    });
    await redis_1.redisClient.del([key]);
    const templatePath = path_1.default.join(process.cwd(), "src/app/templates/reset-password-success.ejs");
    const expSec = 5 * 60;
    const html = await ejs_1.default.renderFile(templatePath, {
        name: isUserExists.name,
    });
    await nodemailer_1.transporter.sendMail({
        from: config_1.default.email_sender,
        to: isUserExists.email,
        subject: "Forgot Updated",
        // text: `Your Password is updated`,
        html,
    });
};
exports.AuthService = {
    registerPatient,
    loginUser,
    getMe,
    refreshToken,
    googleLogin,
    forgotPassword,
    resetPassword,
    verifyPatientEmail,
};
