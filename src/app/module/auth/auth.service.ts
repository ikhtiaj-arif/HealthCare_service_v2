/** biome-ignore-all lint/style/useConst: <explanation> */
import bcrypt from "bcryptjs";
import type { TokenPayload } from "google-auth-library";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import {
	AuthProvider,
	Role,
	UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import type {
	IForgotPasswordPayload,
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterPatientPayload,
	IRequestUser,
	IResetPasswordPayload,
	IVerifyPatientPayload,
} from "./auth.interface";
import crypto from "crypto";
import { redisClient } from "../../lib/redis";
import { transporter } from "../../lib/nodemailer";
import ejs from "ejs";
import path from "path";
 
import httpStatus from "http-status";
import { AppError } from "../../utils/appError";

const registerPatient = async (payload: IRegisterPatientPayload) => {
	const { name, password, patient: patientData } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new AppError(httpStatus.CONFLICT, "User with this email already exists");
	}

	const hashedPassword = await bcrypt.hash(password, 8);

	const otp = crypto.randomInt(100000, 1000000).toString();
	const otpKey = `patient-registration-otp:${email}`;

	await redisClient.set(otpKey, otp, {
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
	await redisClient.set(
		patientRegistrationKey,
		JSON.stringify(redisUserDataPayload),
		{
			expiration: {
				type: "EX",
				value: 5 * 60,
			},
		},
	);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/registration-user-otp.ejs",
	);
	const expSec = 5 * 60;

	const html = await ejs.renderFile(templatePath, {
		name,
		otp,
		expirationMinutes: expSec / 60,
	});

	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Email Verification",
		// text: `Your OTP Is: ${otp}`,
		html,
	});
};

const verifyPatientEmail = async (payload: IVerifyPatientPayload) => {
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists?.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is Blocked!");
	}
	if (isUserExists?.emailVerified) {
		throw new AppError(httpStatus.CONFLICT, "Email Already Verified!");
	}
	if (isUserExists?.status === UserStatus.DELETED || isUserExists?.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "User is Deleted!");
	}
	const otp = payload.otp;
	const otpKey = `patient-registration-otp:${email}`;
	const redisOTP = await redisClient.get(otpKey);

	if (!redisOTP) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
	}
	if (redisOTP !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP does not match");
	}
	await redisClient.del(otpKey);

	const patientRegistrationKey = `patient-registration-data:${email}`;
	const redisPatientData = await redisClient.get(patientRegistrationKey);
	if (!redisPatientData) {
		throw new AppError(httpStatus.NOT_FOUND, "User does not exists");
	}

	const patientPayload: IRegisterPatientPayload = JSON.parse(redisPatientData);

	const createdUser = await prisma.user.create({
		data: {
			name: patientPayload.name,
			email: patientPayload.email,
			password: patientPayload.password,
			role: Role.PATIENT,
			status: UserStatus.ACTIVE,
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

	await redisClient.del(patientRegistrationKey);
	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/patient-welcome-email.ejs",
	);
	const expSec = 5 * 60;

	const html = await ejs.renderFile(templatePath, {
		name: createdUser.name,
	});

	await transporter.sendMail({
		from: config.email_sender,
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

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		user,
		patient,
		accessToken,
		refreshToken,
	};
};

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		where: { email },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.NOT_FOUND, "User is deleted");
	}

	if (user.password === null && user.googleId !== null) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User Already Has Account Registered With Google. Try To Login With Google.",
		);
	}

	const isPasswordMatched = await bcrypt.compare(
		password,
		user.password as string,
	);

	if (!isPasswordMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const getMe = async (user: IRequestUser) => {
	const isUserExists = await prisma.user.findUnique({
		where: {
			id: user.userId,
		},
		include: {
			patient: true,
		},
		omit: {
			password: true,
		},
	});

	if (!isUserExists) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	return isUserExists;
};

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			config.node_env === "development"
				? verifiedRefreshToken.error
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await prisma.user.findUnique({
		where: { id: data.userId },
	});

	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
		throw new AppError(httpStatus.NOT_FOUND, "User is inactive or not found");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
	let googleIdTokenPayload: TokenPayload | null | undefined = null;
	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});

		googleIdTokenPayload = ticket.getPayload();
	} catch (error) {
		console.log("Google ID Token Verification Failed", error);
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid Or Expired Google Id Token");
	}

	if (!googleIdTokenPayload) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid Or Expired Google Id Token");
	}

	if (!googleIdTokenPayload.email) {
		throw new AppError(httpStatus.BAD_REQUEST, "Google Email Not Found");
	}
	if (!googleIdTokenPayload.name) {
		throw new AppError(httpStatus.BAD_REQUEST, "Google Email User Name Not Found");
	}

	const ifPatientExistWithGoogleAuth = await prisma.user.findUnique({
		where: {
			email: googleIdTokenPayload.email,
			role: Role.PATIENT,
			googleId: googleIdTokenPayload.sub,
		},
	});

	let user = ifPatientExistWithGoogleAuth;

	if (!ifPatientExistWithGoogleAuth) {
		const ifPatientExistWithCredentials = await prisma.user.findUnique({
			where: {
				email: googleIdTokenPayload.email,
				role: Role.PATIENT,
				authProvider: AuthProvider.CREDENTIAL,
			},
		});

		if (ifPatientExistWithCredentials) {
			if (!ifPatientExistWithCredentials.emailVerified) {
				throw new AppError(httpStatus.FORBIDDEN, "Email Not Verified");
			}

			if (ifPatientExistWithCredentials.status === UserStatus.BLOCKED) {
				throw new AppError(httpStatus.FORBIDDEN, "User Is Blocked");
			}

			if (
				ifPatientExistWithCredentials.isDeleted ||
				ifPatientExistWithCredentials.status === UserStatus.DELETED
			) {
				throw new AppError(httpStatus.NOT_FOUND, "User Is Deleted");
			}

			user = await prisma.user.update({
				where: {
					id: ifPatientExistWithCredentials.id,
				},

				data: {
					googleId: googleIdTokenPayload.sub,
				},
			});
		} else {
			// Google Register
			user = await prisma.user.create({
				data: {
					name: googleIdTokenPayload.name,
					email: googleIdTokenPayload.email,
					role: Role.PATIENT,
					googleId: googleIdTokenPayload.sub,
					authProvider: AuthProvider.GOOGLE,
					emailVerified: true,
					patient: {
						create: {
							name: googleIdTokenPayload.name,
							email: googleIdTokenPayload.email,
						},
					},
				},
			});
			const templatePath = path.join(
				process.cwd(),
				"src/app/templates/patient-welcome-email.ejs",
			);
			const html = await ejs.renderFile(templatePath, {
				name: user.name,
			});

			await transporter.sendMail({
				from: config.email_sender,
				to: user.email,
				subject: "Welcome to HealthCare System",
				// text: `Your OTP Is: ${otp}`,
				html,
			});
		}
	}

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User Not Found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User Is Blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.NOT_FOUND, "User Is Deleted");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const forgotPassword = async (payload: IForgotPasswordPayload) => {
	const { email } = payload;

	const isUserExists = await prisma.user.findUnique({
		where: {
			email,
		},
	});
	if (!isUserExists) {
		throw new AppError(httpStatus.NOT_FOUND, "User does not exist!");
	}
	if (!isUserExists.emailVerified) {
		throw new AppError(httpStatus.FORBIDDEN, "User not verified!");
	}
	if (isUserExists.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is Blocked!");
	}
	if (isUserExists.status === UserStatus.DELETED || isUserExists.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "User is Deleted!");
	}
	if (
		isUserExists.googleId &&
		isUserExists.authProvider === AuthProvider.GOOGLE
	) {
		throw new AppError(httpStatus.CONFLICT, "User Has account with google");
	}

	const otp = crypto.randomInt(100000, 1000000).toString();
	const key = `forgot_password-otp:${isUserExists.email}`;

	await redisClient.set(key, otp, {
		expiration: {
			type: "EX",
			value: 5 * 60,
		},
	});

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/forgot-password.ejs",
	);
	const expSec = 5 * 60;

	const html = await ejs.renderFile(templatePath, {
		name: isUserExists.name,
		otp,
		expirationMinutes: expSec / 60,
	});

	await transporter.sendMail({
		from: config.email_sender,
		to: isUserExists.email,
		subject: "Forgot Password",
		// text: `Your OTP Is: ${otp}`,
		html,
	});
};
const resetPassword = async (payload: IResetPasswordPayload) => {
	const { email, otp, newPassword } = payload;

	const isUserExists = await prisma.user.findUnique({
		where: {
			email,
		},
	});
	if (!isUserExists) {
		throw new AppError(httpStatus.NOT_FOUND, "User does not exist!");
	}
	if (!isUserExists.emailVerified) {
		throw new AppError(httpStatus.FORBIDDEN, "User not verified!");
	}
	if (isUserExists.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is Blocked!");
	}
	if (isUserExists.status === UserStatus.DELETED || isUserExists.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "User is Deleted!");
	}
	if (
		isUserExists.googleId &&
		isUserExists.authProvider === AuthProvider.GOOGLE
	) {
		throw new AppError(httpStatus.CONFLICT, "User Has account with google");
	}
	const key = `forgot_password-otp:${isUserExists.email}`;
	const redisOTP = await redisClient.get(key);

	if (!redisOTP) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
	}
	if (redisOTP !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP does not match");
	}

	const hashedNewPass = await bcrypt.hash(newPassword, 8);

	await prisma.user.update({
		where: {
			email: isUserExists.email,
		},
		data: {
			password: hashedNewPass,
		},
	});

	await redisClient.del([key]);
	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/reset-password-success.ejs",
	);
	const expSec = 5 * 60;

	const html = await ejs.renderFile(templatePath, {
		name: isUserExists.name,
	});
	await transporter.sendMail({
		from: config.email_sender,
		to: isUserExists.email,
		subject: "Forgot Updated",
		// text: `Your Password is updated`,
		html,
	});
};

export const AuthService = {
	registerPatient,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
	forgotPassword,
	resetPassword,
	verifyPatientEmail,
};
