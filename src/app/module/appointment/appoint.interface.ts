import { AppointmentStatus } from "../../../generated/prisma/enums";

export interface IBookAppointmentPayload {
  scheduleId: string;
}
export interface IPayAppointmentPayload {
  appointmentId: string;
}
export interface ICancelAppointmentPayload {
  appointmentId: string;
  refundReason: string;
}
export interface IUpdateAppointmentPayload {
  status: "ONGOING" | "COMPLETED";
}
