import bcrypt from "bcryptjs";
import { DoctorVerificationStatus, Role } from "../../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import config from "../config";
 
import httpStatus from "http-status";
import { AppError } from "./appError";

export const seedSuperAdmin = async () => {
	try {
		const isSuperAdminExists = await prisma.user.findFirst({
			where: {
				role: Role.SUPER_ADMIN,
			},
		});

		if (isSuperAdminExists) {
			console.log("Super Admin Already Exists!");
			return;
		}

		const name = config.super_admin_name as string;
		const email = config.super_admin_email as string;
		const password = config.super_admin_password as string;

		if (!name || !email || !password) {
			throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "Super admin credentials missing in .env file!");
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const superAdmin = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.SUPER_ADMIN,
				needPasswordChange: false,
				emailVerified: true,
			},
		});
		console.log("super admin created:", superAdmin);
	} catch (error) {
		console.log("Error seeding super admin", error);
		await prisma.user.delete({
			where: {
				email: config.super_admin_email,
			},
		});
	}
};

export const seedTesterAdmin = async () => {
	try {
		const isTesterAdminExist = await prisma.user.findUnique({
			where: {
				email: config.tester_admin_email,
			},
		});

		if (isTesterAdminExist) {
			console.log("Tester Admin Already Exists!");
			return;
		}

		const name = config.tester_admin_name;
		const email = config.tester_admin_email;
		const password = config.tester_admin_password;

		if (!name || !email || !password) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Tester Admin Name , Email, Password Missing In Env File!!!",
			);
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const testerAdmin = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.ADMIN,
				needPasswordChange: false,
				emailVerified: true,
			},
		});

		console.log("Tester Admin Created : ", testerAdmin);
	} catch (error) {
		console.log("Error Seeding Tester Admin : ", error);

		await prisma.user.delete({
			where: {
				email: config.tester_admin_email,
			},
		});
	}
};

// create tester doctor

const testerDoctorProfile = (name: string, email: string) => ({
	email,
	name,
	experienceYears: 4,
	licenseNumber: "BMDC0000",
	qualifications: "MBBS",
	specialization: "Neurology",
	verificationStatus: DoctorVerificationStatus.APPROVED,
});

export const seedTesterDoctor = async () => {
	try {
		const isTesterDoctorExist = await prisma.user.findUnique({
			where: {
				email: config.tester_doctor_email,
			},
			include: {
				doctor: true,
			},
		});

		const name = config.tester_doctor_name;
		const email = config.tester_doctor_email;
		const password = config.tester_doctor_password;

		if (isTesterDoctorExist) {
			if (isTesterDoctorExist.doctor) {
				console.log("Tester Doctor Already Exists!");
				return;
			}

			// The user row survived but its doctor profile did not (deleted by hand, or
			// created before this seed nested a profile). Every doctor-only endpoint
			// 404s/403s without it, so backfill it instead of returning early.
			// Deliberately not using the outer catch below: that one deletes the user
			// row, which would destroy the account we are trying to repair.
			try {
				const repairedProfile = await prisma.doctor.create({
					data: {
						...testerDoctorProfile(name, email),
						userId: isTesterDoctorExist.id,
					},
				});

				console.log("Tester Doctor Profile Repaired : ", repairedProfile);
			} catch (repairError) {
				console.log(
					"Error Repairing Tester Doctor Profile (user left intact) : ",
					repairError,
				);
			}

			return;
		}

		if (!name || !email || !password) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Tester Doctor Name , Email, Password Missing In Env File!!!",
			);
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const testerDoctor = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.DOCTOR,
				needPasswordChange: false,
				emailVerified: true,
				doctor: {
					create: testerDoctorProfile(name, email),
				}
			},
		});

		console.log("Tester Doctor Created : ", testerDoctor);
	} catch (error) {
		console.log("Error Seeding Tester Doctor : ", error);

		await prisma.user.delete({
			where: {
				email: config.tester_doctor_email,
			},
		});
	}
};
