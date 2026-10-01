"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleServices = void 0;
const date_fns_1 = require("date-fns");
const prisma_1 = require("../../lib/prisma");
const appError_1 = require("../../utils/appError");
const sort_1 = require("../../utils/sort");
const doctorProfile_1 = require("../../utils/doctorProfile");
const http_status_1 = __importDefault(require("http-status"));
const enums_1 = require("../../../generated/prisma/enums");
const createSchedule = async (payload, user) => {
    const doctor = await (0, doctorProfile_1.getDoctorProfileOrThrow)(user.userId);
    if ((0, date_fns_1.isAfter)(payload.startDateTime, payload.endDateTime)) // 9 PM to 3 PM !it should be 3 PM to 9 PM
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "Start date time cannot be after End date time");
    if (!(0, date_fns_1.isSameDay)(payload.startDateTime, payload.endDateTime)) // 9 PM to 3 AM !it should on the same date 9 PM to 11:59 PM
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "Start date time and End date time must be on the same day");
    const startOfTheDay = (0, date_fns_1.startOfDay)(payload.startDateTime); // 29th aug => 12:00 AM
    const startOfNextDay = (0, date_fns_1.addDays)(startOfTheDay, 1); // 30th aug => 12:00 AM
    const existingScheduleOnThisDate = await prisma_1.prisma.schedule.findFirst({
        where: {
            doctorId: doctor.id,
            isDeleted: false,
            startDateTime: {
                gte: startOfTheDay,
                lt: startOfNextDay,
            },
        },
    });
    if (existingScheduleOnThisDate)
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "You already have a schedule for this date");
    const durationInMinutes = (0, date_fns_1.differenceInMinutes)(payload.endDateTime, payload.startDateTime);
    const MINUTES_ALLOCATED_PER_SLOT = 20;
    const totalSlots = Math.floor(durationInMinutes / MINUTES_ALLOCATED_PER_SLOT);
    const schedule = await prisma_1.prisma.schedule.create({
        data: {
            startDateTime: payload.startDateTime,
            endDateTime: payload.endDateTime,
            meetingLink: payload.meetingLink,
            totalSlots,
            availableSlots: totalSlots,
            doctorId: doctor.id,
        },
        include: {
            doctor: {
                select: {
                    name: true,
                    email: true,
                    contactNumber: true,
                    bio: true,
                    consultationFee: true,
                    experienceYears: true,
                },
            },
        },
    });
    return schedule;
};
const getMySchedules = async (query, user) => {
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const { sortBy, sortOrder } = (0, sort_1.parseSort)(query, sort_1.SCHEDULE_SORTABLE_FIELDS);
    // let limit = 10;
    // if (query.limit) {
    //     limit = Number(query.limit);
    // }
    // let page = 1;
    // if (query.page) {
    //     page = Number(query.page);
    // }
    // const skip = (page - 1) * limit;
    const doctor = await (0, doctorProfile_1.getDoctorProfileOrThrow)(user.userId);
    const andConditions = [
        {
            doctorId: doctor.id,
        },
        {
            isDeleted: false,
        },
    ];
    if (query.status) {
        andConditions.push({ status: query.status });
    }
    const schedules = await prisma_1.prisma.schedule.findMany({
        where: {
            AND: andConditions,
        },
        take: limit,
        skip,
        orderBy: {
            // sortBy : sortOrder
            [sortBy]: sortOrder,
        },
        include: {
            appointments: {
                include: {
                    patient: true,
                },
            },
        },
    });
    const total = await prisma_1.prisma.schedule.count({ where: { AND: andConditions } });
    return {
        data: schedules,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};
const getAllSchedules = async (query) => {
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const { sortBy, sortOrder } = (0, sort_1.parseSort)(query, sort_1.SCHEDULE_SORTABLE_FIELDS);
    const andConditions = [];
    andConditions.push({ isDeleted: false });
    if (query.doctorId) {
        andConditions.push({ doctorId: query.doctorId });
    }
    if (query.email) {
        andConditions.push({
            doctor: {
                email: query.email,
            },
        });
    }
    if (query.status) {
        andConditions.push({ status: query.status });
    }
    if (query.searchTerm) {
        andConditions.push({
            doctor: {
                OR: [
                    { name: { contains: query.searchTerm, mode: "insensitive" } },
                    { email: { contains: query.searchTerm, mode: "insensitive" } },
                    {
                        specialization: { contains: query.searchTerm, mode: "insensitive" },
                    },
                ],
            },
        });
    }
    const schedules = await prisma_1.prisma.schedule.findMany({
        where: {
            AND: andConditions,
        },
        take: limit,
        skip,
        orderBy: {
            // sortBy : sortOrder
            [sortBy]: sortOrder,
        },
        include: {
            appointments: {
                include: {
                    patient: true,
                },
            },
        },
    });
    const total = await prisma_1.prisma.schedule.count({ where: { AND: andConditions } });
    return {
        data: schedules,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};
const getScheduleById = async (scheduleId) => {
    const schedule = await prisma_1.prisma.schedule.findUnique({
        where: { id: scheduleId },
        include: {
            doctor: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    specialization: true,
                    userId: true,
                },
            },
            appointments: {
                include: {
                    patient: true,
                },
            },
        },
    });
    if (!schedule || schedule.isDeleted) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Schedule Not Found");
    }
    return schedule;
};
const updateSchedule = async (scheduleId, payload, user) => {
    const doctor = await (0, doctorProfile_1.getDoctorProfileOrThrow)(user.userId);
    const schedule = await prisma_1.prisma.schedule.findUnique({
        where: { id: scheduleId, doctorId: doctor.id },
    });
    if (!schedule || schedule.isDeleted) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Schedule Not Found");
    }
    if (schedule.status === enums_1.ScheduleStatus.PUBLISHED &&
        schedule.totalSlots !== schedule.availableSlots) {
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "Schedule Once Published And Appointment Booked Cannot Be Updated");
    }
    //   const updateData: IUpdateSchedulePayload = {};
    //   if (payload.meetingLink) {
    //     updateData.meetingLink = payload.meetingLink || schedule.meetingLink
    //   }
    payload.meetingLink = payload.meetingLink || schedule.meetingLink;
    payload.startDateTime = payload.startDateTime || schedule.startDateTime;
    payload.endDateTime = payload.endDateTime || schedule.endDateTime;
    if ((0, date_fns_1.isAfter)(payload.startDateTime, payload.endDateTime)) // 9 PM to 3 PM !it should be 3 PM to 9 PM
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "Start date time cannot be after End date time");
    if (!(0, date_fns_1.isSameDay)(payload.startDateTime, payload.endDateTime)) // 9 PM to 3 AM !it should on the same date 9 PM to 11:59 PM
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "Start date time and End date time must be on the same day");
    //startDateTime = 2026-08-25T13:30:00.436Z => 1:30 PM
    const startOfTheDay = (0, date_fns_1.startOfDay)(payload.startDateTime); // 25 August => 12:00 AM => 2026-08-25T00:00:00.436Z
    const startOfNextDay = (0, date_fns_1.addDays)(startOfTheDay, 1); // 26 August => 12:00 AM => 2026-08-26T00:00:00.436Z
    const existingScheduleOnThisDate = await prisma_1.prisma.schedule.findFirst({
        where: {
            id: { not: scheduleId },
            doctorId: doctor.id,
            isDeleted: false,
            startDateTime: {
                gte: startOfTheDay,
                lt: startOfNextDay,
            },
        },
    });
    if (existingScheduleOnThisDate) {
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "You Already Have A Schedule For This Date");
    }
    const durationInMinutes = (0, date_fns_1.differenceInMinutes)(payload.endDateTime, payload.startDateTime);
    const MINUTES_ALLOCATED_PER_SLOT = 20;
    const totalSlots = Math.floor(durationInMinutes / MINUTES_ALLOCATED_PER_SLOT);
    if (totalSlots < 1) {
        throw new appError_1.AppError(http_status_1.default.CONFLICT, `Schedule Must Be At Least ${MINUTES_ALLOCATED_PER_SLOT} Minutes Long To Fit One Slot`);
    }
    const updatedSchedule = await prisma_1.prisma.schedule.update({
        where: {
            id: schedule.id,
        },
        data: {
            startDateTime: payload.startDateTime,
            endDateTime: payload.endDateTime,
            meetingLink: payload.meetingLink,
            totalSlots,
            availableSlots: totalSlots,
            doctorId: doctor.id,
        },
        include: {
            doctor: {
                select: {
                    name: true,
                    email: true,
                    contactNumber: true,
                },
            },
        },
    });
    return updatedSchedule;
};
const publishSchedule = async (scheduleId, user) => {
    const doctor = await (0, doctorProfile_1.getDoctorProfileOrThrow)(user.userId);
    const schedule = await prisma_1.prisma.schedule.findUnique({
        where: { id: scheduleId, doctorId: doctor.id },
    });
    if (!schedule || schedule.isDeleted) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Schedule Not Found");
    }
    if (schedule.status === enums_1.ScheduleStatus.PUBLISHED) {
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "Schedule Is Already Published");
    }
    const publishedSchedule = await prisma_1.prisma.schedule.update({
        where: { id: schedule.id },
        data: { status: enums_1.ScheduleStatus.PUBLISHED },
    });
    return publishedSchedule;
};
const deleteSchedule = async (scheduleId, user) => {
    const doctor = await (0, doctorProfile_1.getDoctorProfileOrThrow)(user.userId);
    const schedule = await prisma_1.prisma.schedule.findUnique({
        where: { id: scheduleId, doctorId: doctor.id },
    });
    if (!schedule || schedule.isDeleted) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Schedule Not Found");
    }
    if (schedule.status === enums_1.ScheduleStatus.PUBLISHED &&
        schedule.totalSlots !== schedule.availableSlots) {
        throw new appError_1.AppError(http_status_1.default.CONFLICT, "Schedule Once Published And Appoinement Booked Cannot Be Deleted");
    }
    const deletedSchedule = await prisma_1.prisma.schedule.update({
        where: { id: schedule.id },
        data: { isDeleted: true, deletedAt: new Date() },
    });
    return deletedSchedule;
};
const getTodaysSchedules = async (query) => {
    if (!query.doctorId) {
        // 404 would blame a doctor that was never looked up; this is a bad request.
        throw new appError_1.AppError(http_status_1.default.BAD_REQUEST, "doctorId Must Be Provided In Query");
    }
    const doctor = await prisma_1.prisma.doctor.findUnique({
        where: { id: query.doctorId },
    });
    if (!doctor) {
        throw new appError_1.AppError(http_status_1.default.NOT_FOUND, "Doctor Profile Not Found");
    }
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const { sortBy, sortOrder } = (0, sort_1.parseSort)(query, sort_1.SCHEDULE_SORTABLE_FIELDS);
    const startOfToday = (0, date_fns_1.startOfDay)(new Date());
    const startOfTomorrow = (0, date_fns_1.addDays)(startOfToday, 1);
    const andConditions = [
        {
            doctorId: query.doctorId,
        },
        {
            isDeleted: false,
        },
        {
            status: enums_1.ScheduleStatus.PUBLISHED,
        },
        {
            startDateTime: {
                gte: startOfToday,
                lt: startOfTomorrow,
            },
        },
        {
            availableSlots: { gt: 0 },
        },
    ];
    const schedules = await prisma_1.prisma.schedule.findMany({
        where: {
            AND: andConditions,
        },
        take: limit,
        skip,
        orderBy: {
            // sortBy : sortOrder
            [sortBy]: sortOrder,
        },
    });
    const total = await prisma_1.prisma.schedule.count({ where: { AND: andConditions } });
    return {
        data: schedules,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};
exports.ScheduleServices = {
    createSchedule,
    getMySchedules,
    getAllSchedules,
    getScheduleById,
    updateSchedule,
    publishSchedule,
    deleteSchedule,
    getTodaysSchedules,
};
