import {
	AppointmentStatus,
	PaymentStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/appError";
import httpStatus from "http-status";

const bookAppointment = async (payload: any, user: RequestUser) => {
	// business logics

	// transaction = appointment --> bkash payment --> payment model create
	const transactionResult = await prisma.$transaction(async (tx) => {
		// create appointment
		const appointment = await tx.appointment.create({
			data: {
				status: AppointmentStatus.PENDING,
			},
		});

		const bkashIdToken = await getBkashIdToken();
		if (!bkashIdToken) throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "No Bkash Access Token Found!");

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
					amount: "1200",
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
				amount: "1200",
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
	});
	if (!existingAppointment) throw new AppError(httpStatus.NOT_FOUND, "Appointment Does Not Exist");
	if (existingAppointment.status !== AppointmentStatus.PENDING) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Appointment is Already ${existingAppointment.status.toUpperCase()}`,
		);
	}

	const bkashIdToken = await getBkashIdToken();
	if (!bkashIdToken) throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "No Bkash Access Token Found!");

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
				amount: "1200",
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
		if (!existingAppointment) throw new AppError(httpStatus.NOT_FOUND, "Appointment Does Not Exist");

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
		if (!bkashIdToken) throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "No Bkash Access Token Found!");

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
		console.log("💰 bkashRefundPaymentResult:", {bkashRefundPaymentResult});

		// update payment and appointment model after refund
		const updatePayment = await tx.payment.update({
			where: {
				appointmentId: existingAppointment.id
			},
			data: {
				refundTrxId: bkashRefundPaymentResult.refundTrxID,
				refundedAt: bkashRefundPaymentResult.completedTime,
				refundAmount: bkashRefundPaymentResult.amount,
				refundReason: refundReason,
				status: PaymentStatus.REFUNDED,
				gatewayResponse: bkashRefundPaymentResult
			}
		})
		
		return {
			appointment: updateAppointment,
			payment: updatePayment
		}
	});
	return transactionResult
};
const bookAppointmentCallback = async (query: Record<string, any>) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const paymentId = query.paymentID;
		if (!paymentId) throw new AppError(httpStatus.BAD_REQUEST, "Payment ID Missing");

		const status = query.status;
		if (!status) throw new AppError(httpStatus.BAD_REQUEST, "Payment Status Missing");

		const bkashIdToken = await getBkashIdToken();
		if (!bkashIdToken) throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "No Bkash Access Token Found!");

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
			await tx.appointment.update({
				where: {
					id: executedPaymentResult.merchantInvoiceNumber,
				},
				data: {
					status: AppointmentStatus.CONFIRMED,
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
