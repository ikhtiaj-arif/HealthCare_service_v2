import {
  AppointmentStatus,
  PaymentStatus,
  ScheduleStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/appError";
import httpStatus from "http-status";
import { IBookAppointmentPayload } from "./appoint.interface";
import { addMinutes, isBefore, isSameDay } from "date-fns";
import app from "../../../app";
import { transporter } from "../../lib/nodemailer";
import  PDFDocument  from "pdfkit";
import { margins } from "pdfkit/js/page";

const bookAppointment = async (
  payload: IBookAppointmentPayload,
  user: RequestUser,
) => {
  // business logics

  // transaction = appointment --> bkash payment --> payment model create
  const transactionResult = await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findUnique({
      where: { userId: user.userId },
    });
    if (!patient)
      throw new AppError(httpStatus.NOT_FOUND, "Patient Profile not found");

    const schedule = await prisma.schedule.findUnique({
      where: { id: payload.scheduleId },
      include: { doctor: true },
    });

    if (!schedule || schedule.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, "Schedule Not Found");
    }

    if (schedule.status !== ScheduleStatus.PUBLISHED) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "This Schedule Is Not Published Yet",
      );
    }

    const now = new Date();

    if (!isSameDay(now, schedule.startDateTime)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "This Schedule Is Not Available Today",
      );
    }

    if (!isBefore(now, schedule.startDateTime)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "This Schedule Has Already Started",
      );
    }
    // if(isAfter(now, schedule.startDateTime)){
    // 	throw new AppError(
    // 		httpStatus.BAD_REQUEST,
    // 		"This Schedule Has Already Started",
    // 	);
    // }

    const existingAppointment = await tx.appointment.findFirst({
      where: {
        patientId: patient.id,
        scheduleId: schedule.id,
        // status : { not : AppointmentStatus.CANCELLED }
      },
    });

    if (existingAppointment?.status === AppointmentStatus.PENDING) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You already have a pending appointment.",
      );
    }
    if (existingAppointment?.status === AppointmentStatus.ONGOING) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You already have an Ongoing appointment.",
      );
    }
    if (existingAppointment?.status === AppointmentStatus.COMPLETED) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You already have completed the appointment.",
      );
    }
    if (existingAppointment?.status === AppointmentStatus.CONFIRMED) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You already have confirmed the appointment.",
      );
    }
    if (schedule.availableSlots === 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "This Schedule Is Fully Booked",
      );
    }

    if (!schedule.doctor.consultationFee) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Doctor Has Not Set A Consultation Fee Yet",
      );
    }

    // create appointment
    const amount = schedule.doctor.consultationFee.toString();

    const appointment = await tx.appointment.create({
      data: {
        status: AppointmentStatus.PENDING,
        patientId: patient.id,
        doctorId: schedule.doctor.id,
        scheduleId: schedule.id,
      },
    });

    const bkashIdToken = await getBkashIdToken();
    if (!bkashIdToken)
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "No Bkash Access Token Found!",
      );

    const bkashCreatePaymentResponse = await fetch(
      `${config.bkash_base_url}/tokenized/checkout/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: bkashIdToken,
          "X-App-Key": config.bkash_app_key,
        },
        body: JSON.stringify({
          // agreementID: "TokenizedMerchant01L3IKB6H1565072174986", // appointment id
          mode: "0011",
          // payerReference: "01723888888", // user email or phone number
          payerReference: user.email, // user email or phone number
          callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
          // merchantAssociationInfo: "MI05MID54RF09123456One",
          amount: amount,
          currency: "BDT",
          intent: "sale",
          // merchantInvoiceNumber: "Inv0124", // appointment id
          merchantInvoiceNumber: appointment.id, // appointment id
        }),
      },
    );

    const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

    // payment model create
    const payment = await tx.payment.create({
      data: {
        merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
        appointmentId: appointment.id,
        amount: amount,
        gatewayResponse: bkashCreatePaymentResult,
        bkashPaymentId: bkashCreatePaymentResult.paymentID,
        payerReference: user.email,
      },
    });

    return { paymentUrl: bkashCreatePaymentResult.bkashURL };
  });
  return transactionResult;
};

const payAppointment = async (payload: any, user: RequestUser) => {
  const { appointmentId } = payload;

  const existingAppointment = await prisma.appointment.findUnique({
    where: {
      id: appointmentId,
    },
    include: {
      schedule: {
        include: {
          doctor: true,
        },
      },
    },
  });
  if (!existingAppointment)
    throw new AppError(httpStatus.NOT_FOUND, "Appointment Does Not Exist");
  if (existingAppointment.status !== AppointmentStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Doctor has not set a consultation fee yet`,
    );
  }

  if (!existingAppointment?.schedule?.doctor?.consultationFee)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Appointment is Already ${existingAppointment.status.toUpperCase()}`,
    );

  const amount =
    existingAppointment?.schedule?.doctor?.consultationFee.toString();

  const bkashIdToken = await getBkashIdToken();
  if (!bkashIdToken)
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "No Bkash Access Token Found!",
    );

  const bkashCreatePaymentResponse = await fetch(
    `${config.bkash_base_url}/tokenized/checkout/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: bkashIdToken,
        "X-App-Key": config.bkash_app_key,
      },
      body: JSON.stringify({
        // agreementID: "TokenizedMerchant01L3IKB6H1565072174986", // appointment id
        mode: "0011",
        // payerReference: "01723888888", // user email or phone number
        payerReference: user.email, // user email or phone number
        callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
        // merchantAssociationInfo: "MI05MID54RF09123456One",
        amount: amount,
        currency: "BDT",
        intent: "sale",
        // merchantInvoiceNumber: "Inv0124", // appointment id
        merchantInvoiceNumber: existingAppointment.id, // appointment id
      }),
    },
  );

  const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

  await prisma.payment.update({
    where: {
      appointmentId: existingAppointment.id,
    },
    data: {
      merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
      gatewayResponse: bkashCreatePaymentResult,
      bkashPaymentId: bkashCreatePaymentResult.paymentID,
    },
  });
  return { paymentUrl: bkashCreatePaymentResult.bkashURL };
};

const cancelAppointment = async (payload: any, user: RequestUser) => {
  const transactionResult = await prisma.$transaction(async (tx) => {
    const { appointmentId, refundReason } = payload;
    const existingAppointment = await tx.appointment.findUnique({
      where: {
        id: appointmentId,
      },
      include: {
        payment: true,
      },
    });
    if (!existingAppointment)
      throw new AppError(httpStatus.NOT_FOUND, "Appointment Does Not Exist");

    if (
      existingAppointment.status === AppointmentStatus.ONGOING ||
      existingAppointment.status === AppointmentStatus.COMPLETED ||
      existingAppointment.status === AppointmentStatus.CANCELLED
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Appointment is Already ${existingAppointment.status.toUpperCase()}`,
      );
    }

    const updateAppointment = await tx.appointment.update({
      where: {
        id: existingAppointment.id,
      },
      data: { status: AppointmentStatus.CANCELLED },
    });

    const bkashIdToken = await getBkashIdToken();
    if (!bkashIdToken)
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "No Bkash Access Token Found!",
      );

    const bkashRefundPaymentResponse = await fetch(
      `${config.bkash_base_url}/tokenized/checkout/payment/refund`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: bkashIdToken,
          "X-App-Key": config.bkash_app_key,
        },
        body: JSON.stringify({
          paymentID: existingAppointment.payment?.bkashPaymentId,
          trxID: existingAppointment.payment?.bkashTrxId,
          amount: existingAppointment.payment?.amount.toString(),
          sku: "Appoint cancellation",
          reason: refundReason,
        }),
      },
    );

    const bkashRefundPaymentResult = await bkashRefundPaymentResponse.json();
    console.log("💰 bkashRefundPaymentResult:", { bkashRefundPaymentResult });

    // update payment and appointment model after refund
    const updatePayment = await tx.payment.update({
      where: {
        appointmentId: existingAppointment.id,
      },
      data: {
        refundTrxId: bkashRefundPaymentResult.refundTrxID,
        refundedAt: bkashRefundPaymentResult.completedTime,
        refundAmount: bkashRefundPaymentResult.amount,
        refundReason: refundReason,
        status: PaymentStatus.REFUNDED,
        gatewayResponse: bkashRefundPaymentResult,
      },
    });

    return {
      appointment: updateAppointment,
      payment: updatePayment,
    };
  });
  return transactionResult;
};
const bookAppointmentCallback = async (query: Record<string, any>) => {
  const transactionResult = await prisma.$transaction(async (tx) => {
    const paymentId = query.paymentID;
    if (!paymentId)
      throw new AppError(httpStatus.BAD_REQUEST, "Payment ID Missing");

    const status = query.status;
    if (!status)
      throw new AppError(httpStatus.BAD_REQUEST, "Payment Status Missing");

    const bkashIdToken = await getBkashIdToken();
    if (!bkashIdToken)
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "No Bkash Access Token Found!",
      );

    const executedPayment = await fetch(
      `${config.bkash_base_url}/tokenized/checkout/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: bkashIdToken,
          "X-App-Key": config.bkash_app_key,
        },
        body: JSON.stringify({
          paymentID: paymentId,
        }),
      },
    );

    const executedPaymentResult = await executedPayment.json();

    if (status === "success") {
      // create serial number
      const appointment = await prisma.appointment.findUnique({
        where: {
          id: executedPaymentResult.merchantInvoiceNumber,
        },
        include: {
          schedule: true,
          patient: true,
		  doctor: true
        },
      });
      if (!appointment)
        throw new AppError(httpStatus.NOT_FOUND, "appointment not found");

      // total slots = 3, available = 3
      //(total - available) + 1
      const alreadyBookedSlots =
        appointment.schedule.totalSlots - appointment.schedule.availableSlots;
      const serialNumber = alreadyBookedSlots + 1;

      // 25 August => 3:00 PM - 4:00 PM
      // 1st person joining time => startDateTime = 2026-08-25T15:00:00.436Z => 3:00 PM
      // serial number (1) - 1 * 20 => 0 minutes

      // 2nd person joining time => startDateTime = 2026-08-25T15:20:00.436Z => 3:00 PM
      // serial number (2) - 1 * 20 => 20 minutes

      // 3nd person joining time => startDateTime = 2026-08-25T15:40:00.436Z => 3:00 PM
      // serial number (3) - 1 * 20 => 40 minutes

      const joiningTime = addMinutes(
        appointment.schedule.startDateTime,
        (serialNumber - 1) * 20,
      );

      await tx.appointment.update({
        where: {
          id: executedPaymentResult.merchantInvoiceNumber,
        },
        data: {
          status: AppointmentStatus.CONFIRMED,
          joiningTime,
          serialNumber,
        },
      });
      const newAvailableSlots = appointment.schedule.availableSlots - 1;
      await tx.schedule.update({
        where: {
          id: appointment.schedule.id,
        },
        data: {
          availableSlots: newAvailableSlots,
        },
      });

      await tx.payment.update({
        where: {
          appointmentId: executedPaymentResult.merchantInvoiceNumber,
          bkashPaymentId: paymentId,
        },
        data: {
          status: PaymentStatus.PAID,
          bkashTrxId: executedPaymentResult.trxID,
          paidAt: executedPaymentResult.paymentExecuteTime,
          gatewayResponse: executedPaymentResult,
        },
      });

      //generate pdf
      const pdfDocument = new PDFDocument({ margin: 50 });
      const pdfChunks: Buffer[] = [];
      pdfDocument.on("data", (chunk: Buffer) => {
        pdfChunks.push(chunk);
      });

	  const pdfReadyPromise = new Promise<Buffer>((resolve) => {
		pdfDocument.on("end", ()=>{
			resolve(Buffer.concat(pdfChunks))
		})
	  })

      pdfDocument.fontSize(20).text("Healthcare System", { align: "center" });
      pdfDocument.fontSize(14).text("Appointment Invoice", { align: "center" });
      pdfDocument.moveDown(2);
      pdfDocument
        .fontSize(12)
        .text(`Patient Name: ${appointment.patient?.name}`);
      pdfDocument.text(`Patient Email: ${appointment.patient?.email}`);
      pdfDocument.moveDown();

      pdfDocument.text(`Doctor Name: ${appointment?.doctor?.name}`);
      pdfDocument.text(`Specialization: ${appointment.doctor?.specialization}`);
      pdfDocument.moveDown();

      pdfDocument.text(
        `Appointment Date: ${appointment.schedule.startDateTime.toDateString()}`,
      );
      pdfDocument.text(`Your Joining Time: ${joiningTime.toString()}`);
      pdfDocument.text(`Your Serial Number: ${serialNumber}`);
      pdfDocument.text(`Meeting Link: ${appointment.schedule.meetingLink}`);
      pdfDocument.moveDown();

      pdfDocument.text(`Amount Paid: ${executedPaymentResult.amount} BDT`);
      pdfDocument.text(`Payment Method: bKash`);
      pdfDocument.text(`Transaction Id: ${executedPaymentResult.trxID}`);
      pdfDocument.text(`Paid At: ${executedPaymentResult.paymentExecuteTime}`);

      pdfDocument.end();

	  const pdfBuffer = await pdfReadyPromise

      await transporter.sendMail({
        from: config.email_sender,
        to: appointment.patient.email,
        subject: "Your Appointment Invoice - Healthcare System",
        text: "Thank you for booking an appointment. Please find your invoice attached.",
		attachments: [
			{
				filename: "invoice.pdf",
				content: pdfBuffer
			}
		]
      });
      return {
        redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=success`,
      };
    } else if (status === "failure") {
      await tx.payment.update({
        where: {
          bkashPaymentId: paymentId,
        },
        data: {
          status: PaymentStatus.FAILED,
          gatewayResponse: executedPaymentResult,
        },
      });

      return {
        redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=failure`,
      };
    } else if (status === "cancel") {
      await tx.payment.update({
        where: {
          bkashPaymentId: paymentId,
        },
        data: {
          status: PaymentStatus.CANCELLED,
          gatewayResponse: executedPaymentResult,
        },
      });
      return {
        redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=cancel`,
      };
    } else {
      return {
        executedPaymentResult,
        redirectUrl: `${config.frontend_url}/dashboard/my-appointments?error=payment-failed`,
      };
    }
  });
  return transactionResult;
};

export const AppointmentServices = {
  bookAppointment,
  bookAppointmentCallback,
  payAppointment,
  cancelAppointment,
};
