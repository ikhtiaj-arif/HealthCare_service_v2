import { addDays, differenceInMinutes, startOfDay } from "date-fns";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/appError";
import { ICreateSchedulePayload } from "./schedule.interface";
import httpStatus from "http-status";

const createSchedule = async (
  payload: ICreateSchedulePayload,
  user: RequestUser,
) => {
  const doctor = await prisma.doctor.findUnique({
    where: {
      userId: user.userId,
    },
  });
  if (!doctor)
    throw new AppError(httpStatus.NOT_FOUND, "Doctor profile not found");

  const startOfTheDay = startOfDay(payload.startDateTime); // 29th aug => 12:00 AM
  const startOfNextDay = addDays(startOfTheDay, 1); // 30th aug => 12:00 AM

  const existingScheduleOnThisDate = await prisma.schedule.findFirst({
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
    throw new AppError(
      httpStatus.CONFLICT,
      "You already have a schedule for this date",
    );

  const durationInMinutes = differenceInMinutes(
    payload.startDateTime,
    payload.endDateTime,
  );

  const MINUTES_ALLOCATED_PER_SLOT = 20;
  const totalSlots = Math.floor(durationInMinutes / MINUTES_ALLOCATED_PER_SLOT);

  const schedule = await prisma.schedule.create({
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
                experienceYears: true
            }
        }
    }
  });
  return schedule
};

export const ScheduleServices = {
  createSchedule,
};
