"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorServices = void 0;
const prisma_1 = require("../../lib/prisma");
const cloudinary_1 = require("../../lib/cloudinary");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const config_1 = __importDefault(require("../../config"));
const enums_1 = require("../../../generated/prisma/enums");
const crypto_1 = __importDefault(require("crypto"));
const redis_1 = require("../../lib/redis");
const path_1 = __importDefault(require("path"));
const nodemailer_1 = require("../../lib/nodemailer");
const ejs_1 = __importDefault(require("ejs"));
const appError_1 = require("../../utils/appError");
const sort_1 = require("../../utils/sort");
const doctorProfile_1 = require("../../utils/doctorProfile");
const getRandomPassword_1 = require("../../utils/getRandomPassword");
const devLog_1 = require("../../utils/devLog");
const http_status_1 = __importDefault(require("http-status"));
const date_fns_1 = require("date-fns");
const applyAsDoctor = async (payload, resume, additionalFiles) => {
    const isUserExists = await prisma_1.prisma.user.findUnique({
        where: { email: payload.user.email },
    });
    if (isUserExists)
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "User Already Exists With This Email");
    const resumeUploadResult = await new Promise((resolve, reject) => {
        cloudinary_1.cloudinary.uploader
            .upload_stream({
            resource_type: "auto",
        }, async (error, result) => {
            if (error) {
                console.log(error);
                return reject(error);
            }
            if (!result) {
                return reject(new appError_1.AppError(http_status_1.default.INTERNAL_SERVER_ERROR, "No result returned form cloudinary!"));
            }
            resolve(result);
        })
            .end(resume?.buffer);
    });
    const additionalFilesUploadResults = await Promise.all(additionalFiles.map((file) => {
        return new Promise((resolve, reject) => {
            cloudinary_1.cloudinary.uploader
                .upload_stream({
                resource_type: "auto",
            }, async (error, result) => {
                if (error) {
                    console.log(error);
                    return reject(error);
                }
                if (!result) {
                    return reject(new appError_1.AppError(http_status_1.default.INTERNAL_SERVER_ERROR, "No result returned form cloudinary!"));
                }
                resolve(result);
            })
                .end(file?.buffer);
        });
    }));
    const randomDoctorPassword = (0, getRandomPassword_1.getRandomPassword)(12);
    const hashedPassword = await bcryptjs_1.default.hash(randomDoctorPassword, Number(config_1.default.bcrypt_salt_rounds));
    const doctorApplication = await prisma_1.prisma.user.create({
        data: {
            ...payload.user,
            password: hashedPassword,
            role: enums_1.Role.DOCTOR,
            needPasswordChange: true,
            doctor: {
                create: {
                    name: payload.user.name,
                    email: payload.user.email,
                    ...payload.doctor,
                    resumeUrl: resumeUploadResult.secure_url,
                    resumePublicId: resumeUploadResult.public_id,
                    additionalFiles: additionalFilesUploadResults?.map((file) => ({
                        url: file.secure_url,
                        publicId: file.public_id,
                    })),
                },
            },
        },
        include: {
            doctor: true,
        },
    });
    const expirationSeconds = 60 * 60;
    const otpKey = `doctor-application-otp:${payload.user.email}`;
    const otpValue = crypto_1.default.randomInt(100000, 1000000).toString();
    (0, devLog_1.devLog)(payload.user.email, otpValue);
    await redis_1.redisClient.set(otpKey, otpValue, {
        expiration: {
            type: "EX",
            value: expirationSeconds,
        },
    });
    const templatePath = path_1.default.join(process.cwd(), "src/app/templates/patient-welcome-email.ejs");
    const templateData = {
        name: payload.user.name,
        email: payload.user.email,
        otp: otpValue,
        expirationMinutes: expirationSeconds / 60,
    };
    const html = await ejs_1.default.renderFile(templatePath, templateData);
    await nodemailer_1.transporter.sendMail({
        from: config_1.default.email_sender,
        to: payload.user.email,
        subject: "Welcome to HealthCare System",
        html,
    });
    return doctorApplication;
};
const verifyDoctorEmail = async (payload) => {
    const otp = payload.otp;
    const email = payload.email;
    const existingUser = await prisma_1.prisma.user.findUnique({
        where: {
            email,
            role: enums_1.Role.DOCTOR,
        },
    });
    if (!existingUser) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Doctor Application Not Found. Please Apply Again");
    }
    if (existingUser.emailVerified) {
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "Email Already Verified");
    }
    const otpKey = `doctor-application-otp:${email}`;
    const redisOtp = await redis_1.redisClient.get(otpKey);
    if (!redisOtp) {
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "OTP Expired. Your Application Window Has Closed. Please Try Again");
    }
    if (redisOtp !== otp) {
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "OTP Does Not Match");
    }
    await redis_1.redisClient.del(otpKey);
    const verifiedUser = await prisma_1.prisma.user.update({
        where: { id: existingUser.id },
        data: { emailVerified: true },
        omit: { password: true },
        include: { doctor: true },
    });
    return verifiedUser;
};
const approveDoctor = async (payload, reviewer) => {
    const { doctorId, verificationStatus, rejectionReason } = payload;
    const existingDoctor = await prisma_1.prisma.doctor.findUnique({
        where: {
            id: doctorId,
        },
        include: { user: true },
    });
    if (!existingDoctor) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Doctor Application Not Found.");
    }
    if (existingDoctor.isDeleted) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Doctor Application Has Been Deleted");
    }
    if (!existingDoctor.user.emailVerified) {
        throw new appError_1.AppError(http_status_1.default.FORBIDDEN, "Doctor Has Not Verified There Email Yet. Application Cannot Be Reviewed.");
    }
    if (existingDoctor.verificationStatus !== enums_1.DoctorVerificationStatus.PENDING) {
        throw new appError_1.AppError(http_status_1.default.CONFLICT, `Doctor Application Has Already Been ${existingDoctor.verificationStatus.toLocaleLowerCase()}`);
    }
    if (verificationStatus === enums_1.DoctorVerificationStatus.REJECTED &&
        !rejectionReason) {
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, `Rejection Reason In Required When Rejecting A Doctor Application.`);
    }
    const isApproved = verificationStatus === enums_1.DoctorVerificationStatus.APPROVED;
    let plainPassword = null;
    let hashedPassword = null;
    if (isApproved) {
        plainPassword = (0, getRandomPassword_1.getRandomPassword)(12);
        hashedPassword = await bcryptjs_1.default.hash(plainPassword, Number(config_1.default.bcrypt_salt_rounds));
        (0, devLog_1.devLog)(`doctor approved, generated password for ${existingDoctor.email} -> ${plainPassword}`);
    }
    const templatePath = path_1.default.join(process.cwd(), `src/app/templates/${isApproved ? "doctor-application-approved.ejs" : "doctor-application-rejected.ejs"}`);
    const templateData = {
        name: existingDoctor.name,
        email: existingDoctor.email,
        password: plainPassword,
        reason: isApproved ? null : rejectionReason,
    };
    const html = await ejs_1.default.renderFile(templatePath, templateData);
    const updateDoctor = await prisma_1.prisma.$transaction(async (tx) => {
        const reviewedDoctor = await tx.doctor.update({
            where: { id: doctorId },
            data: {
                verificationStatus,
                rejectionReason: isApproved ? null : rejectionReason,
                reviewedBy: reviewer.userId,
                reviewedAt: new Date(),
            },
        });
        if (hashedPassword) {
            await tx.user.update({
                where: { id: existingDoctor.user.id },
                data: {
                    password: hashedPassword,
                    needPasswordChange: true,
                },
            });
        }
        return reviewedDoctor;
    });
    await nodemailer_1.transporter.sendMail({
        from: config_1.default.email_sender,
        to: updateDoctor.email,
        subject: isApproved
            ? "Your Doctor Application Has Been Approved"
            : "Your Doctor Application Has Been Rejected",
        html,
    });
    return updateDoctor;
};
const getAllDoctors = async (query) => {
    //search filter sorting pagination
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const { sortBy, sortOrder } = (0, sort_1.parseSort)(query, sort_1.DOCTOR_SORTABLE_FIELDS);
    const andConditions = [];
    //Searching
    if (query.searchTerm) {
        andConditions.push({
            OR: [
                { name: { contains: query.searchTerm, mode: "insensitive" } },
                { email: { contains: query.searchTerm, mode: "insensitive" } },
                {
                    specialization: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    licenseNumber: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
            ],
        });
    }
    //filtering
    if (query.specialization) {
        andConditions.push({
            specialization: { equals: query.specialization, mode: "insensitive" },
        });
    }
    if (query.email) {
        andConditions.push({
            email: { contains: query.email, mode: "insensitive" },
        });
    }
    if (query.licenseNumber) {
        andConditions.push({
            licenseNumber: { equals: query.licenseNumber, mode: "insensitive" },
        });
    }
    if (query.verificationStatus) {
        andConditions.push({
            verificationStatus: query.verificationStatus,
        });
    }
    andConditions.push({ isDeleted: false });
    const allDoctors = await prisma_1.prisma.doctor.findMany({
        where: {
            AND: andConditions.length > 0 ? andConditions : undefined,
        },
        take: limit,
        skip: skip,
        orderBy: {
            // sortBy : sortOrder
            [sortBy]: sortOrder,
        },
        include: {
            user: {
                omit: {
                    password: true,
                },
            },
            // schedules: true,
            // appointments: true
            // prescriptions: true
        },
    });
    const totalDoctorCount = await prisma_1.prisma.doctor.count({
        where: {
            AND: andConditions,
        },
    });
    return {
        data: allDoctors,
        meta: {
            page: page,
            limit: limit,
            total: totalDoctorCount,
            totalPages: Math.ceil(totalDoctorCount / limit),
        },
    };
};
const updateDoctorProfile = async (payload, user) => {
    const existingDoctor = await (0, doctorProfile_1.getDoctorProfileOrThrow)(user.userId);
    const updatedDoctor = await prisma_1.prisma.doctor.update({
        where: { id: existingDoctor.id },
        data: payload,
    });
    return updatedDoctor;
};
const getAvailableDoctorByTodaysSchedule = async (query) => {
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    // This endpoint orders the doctor *and* its nested schedules, which are
    // different models with different columns, so the sort column is routed to
    // whichever model owns it instead of being applied to both.
    const { outerField, innerField, sortOrder } = (0, sort_1.parseRelationSort)(query, {
        fields: sort_1.DOCTOR_SORTABLE_FIELDS,
        fallback: "createdAt",
    }, {
        fields: sort_1.SCHEDULE_SORTABLE_FIELDS,
        fallback: "startDateTime",
    });
    const now = new Date();
    const startOfToday = (0, date_fns_1.startOfDay)(now);
    const startOfTomorrow = (0, date_fns_1.addDays)(startOfToday, 1);
    // A doctor is "available today" if they have at least one published,
    // not-yet-started schedule today with open slots left.
    const andConditions = [
        { isDeleted: false },
        { verificationStatus: enums_1.DoctorVerificationStatus.APPROVED },
        {
            schedules: {
                some: {
                    isDeleted: false,
                    status: enums_1.ScheduleStatus.PUBLISHED,
                    availableSlots: { gt: 0 },
                    startDateTime: {
                        gte: startOfToday,
                        lt: startOfTomorrow,
                        gt: now,
                    },
                },
            },
        },
    ];
    if (query.searchTerm) {
        andConditions.push({
            OR: [
                { name: { contains: query.searchTerm, mode: "insensitive" } },
                { specialization: { contains: query.searchTerm, mode: "insensitive" } },
            ],
        });
    }
    if (query.specialization) {
        andConditions.push({
            specialization: { equals: query.specialization, mode: "insensitive" },
        });
    }
    const availableDoctors = await prisma_1.prisma.doctor.findMany({
        where: {
            AND: andConditions,
        },
        take: limit,
        skip,
        orderBy: {
            [outerField]: sortOrder,
        },
        select: {
            id: true,
            name: true,
            specialization: true,
            licenseNumber: true,
            qualifications: true,
            experienceYears: true,
            bio: true,
            consultationFee: true,
            createdAt: true,
            schedules: {
                where: {
                    isDeleted: false,
                    status: enums_1.ScheduleStatus.PUBLISHED,
                    availableSlots: { gt: 0 },
                    startDateTime: {
                        gte: startOfToday,
                        lt: startOfTomorrow,
                        gt: now,
                    },
                },
                orderBy: { [innerField]: sortOrder },
                select: {
                    id: true,
                    startDateTime: true,
                    endDateTime: true,
                    availableSlots: true,
                    totalSlots: true,
                },
            },
        },
    });
    const totalAvailableDoctorCount = await prisma_1.prisma.doctor.count({
        where: { AND: andConditions },
    });
    return {
        data: availableDoctors,
        meta: {
            page,
            limit,
            total: totalAvailableDoctorCount,
            totalPages: Math.ceil(totalAvailableDoctorCount / limit),
        },
    };
};
const getAllDoctorsListPublic = async (query) => {
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const { sortBy, sortOrder } = (0, sort_1.parseSort)(query, sort_1.DOCTOR_SORTABLE_FIELDS);
    const andConditions = [
        { isDeleted: false },
        { verificationStatus: enums_1.DoctorVerificationStatus.APPROVED },
    ];
    if (query.searchTerm) {
        andConditions.push({
            OR: [
                { name: { contains: query.searchTerm, mode: "insensitive" } },
                { specialization: { contains: query.searchTerm, mode: "insensitive" } },
                { qualifications: { contains: query.searchTerm, mode: "insensitive" } },
            ],
        });
    }
    if (query.specialization) {
        andConditions.push({
            specialization: { equals: query.specialization, mode: "insensitive" },
        });
    }
    const allDoctors = await prisma_1.prisma.doctor.findMany({
        where: {
            AND: andConditions,
        },
        take: limit,
        skip,
        orderBy: {
            [sortBy]: sortOrder,
        },
        select: {
            id: true,
            name: true,
            specialization: true,
            licenseNumber: true,
            qualifications: true,
            experienceYears: true,
            bio: true,
            consultationFee: true,
            createdAt: true,
        },
    });
    const totalDoctorCount = await prisma_1.prisma.doctor.count({
        where: { AND: andConditions },
    });
    return {
        data: allDoctors,
        meta: {
            page,
            limit,
            total: totalDoctorCount,
            totalPages: Math.ceil(totalDoctorCount / limit),
        },
    };
};
const getSingleDoctorPublicProfile = async (doctorId) => {
    const doctor = await prisma_1.prisma.doctor.findUnique({
        where: {
            id: doctorId,
            isDeleted: false,
            verificationStatus: enums_1.DoctorVerificationStatus.APPROVED,
        },
        select: {
            id: true,
            name: true,
            specialization: true,
            licenseNumber: true,
            qualifications: true,
            experienceYears: true,
            bio: true,
            consultationFee: true,
            createdAt: true,
        },
    });
    if (!doctor) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Doctor Not Found");
    }
    return doctor;
};
exports.DoctorServices = {
    applyAsDoctor,
    verifyDoctorEmail,
    approveDoctor,
    getAllDoctors,
    updateDoctorProfile,
    getAvailableDoctorByTodaysSchedule,
    getSingleDoctorPublicProfile,
    getAllDoctorsListPublic,
};
