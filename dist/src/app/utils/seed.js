"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedTesterDoctor = exports.seedTesterAdmin = exports.seedSuperAdmin = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const enums_1 = require("../../generated/prisma/enums");
const prisma_1 = require("../lib/prisma");
const config_1 = __importDefault(require("../config"));
const http_status_1 = __importDefault(require("http-status"));
const appError_1 = require("./appError");
const seedSuperAdmin = async () => {
    try {
        const isSuperAdminExists = await prisma_1.prisma.user.findFirst({
            where: {
                role: enums_1.Role.SUPER_ADMIN,
            },
        });
        if (isSuperAdminExists) {
            console.log("Super Admin Already Exists!");
            return;
        }
        const name = config_1.default.super_admin_name;
        const email = config_1.default.super_admin_email;
        const password = config_1.default.super_admin_password;
        if (!name || !email || !password) {
            throw new appError_1.AppError(http_status_1.default.INTERNAL_SERVER_ERROR, "Super admin credentials missing in .env file!");
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, Number(config_1.default.bcrypt_salt_rounds));
        const superAdmin = await prisma_1.prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: enums_1.Role.SUPER_ADMIN,
                needPasswordChange: false,
                emailVerified: true,
            },
        });
        console.log("super admin created:", superAdmin);
    }
    catch (error) {
        console.log("Error seeding super admin", error);
        await prisma_1.prisma.user.delete({
            where: {
                email: config_1.default.super_admin_email,
            },
        });
    }
};
exports.seedSuperAdmin = seedSuperAdmin;
const seedTesterAdmin = async () => {
    try {
        const isTesterAdminExist = await prisma_1.prisma.user.findUnique({
            where: {
                email: config_1.default.tester_admin_email,
            },
        });
        if (isTesterAdminExist) {
            console.log("Tester Admin Already Exists!");
            return;
        }
        const name = config_1.default.tester_admin_name;
        const email = config_1.default.tester_admin_email;
        const password = config_1.default.tester_admin_password;
        if (!name || !email || !password) {
            throw new appError_1.AppError(http_status_1.default.INTERNAL_SERVER_ERROR, "Tester Admin Name , Email, Password Missing In Env File!!!");
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, Number(config_1.default.bcrypt_salt_rounds));
        const testerAdmin = await prisma_1.prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: enums_1.Role.ADMIN,
                needPasswordChange: false,
                emailVerified: true,
            },
        });
        console.log("Tester Admin Created : ", testerAdmin);
    }
    catch (error) {
        console.log("Error Seeding Tester Admin : ", error);
        await prisma_1.prisma.user.delete({
            where: {
                email: config_1.default.tester_admin_email,
            },
        });
    }
};
exports.seedTesterAdmin = seedTesterAdmin;
// create tester doctor
const testerDoctorProfile = (name, email) => ({
    email,
    name,
    experienceYears: 4,
    licenseNumber: "BMDC0000",
    qualifications: "MBBS",
    specialization: "Neurology",
    verificationStatus: enums_1.DoctorVerificationStatus.APPROVED,
});
const seedTesterDoctor = async () => {
    try {
        const isTesterDoctorExist = await prisma_1.prisma.user.findUnique({
            where: {
                email: config_1.default.tester_doctor_email,
            },
            include: {
                doctor: true,
            },
        });
        const name = config_1.default.tester_doctor_name;
        const email = config_1.default.tester_doctor_email;
        const password = config_1.default.tester_doctor_password;
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
                const repairedProfile = await prisma_1.prisma.doctor.create({
                    data: {
                        ...testerDoctorProfile(name, email),
                        userId: isTesterDoctorExist.id,
                    },
                });
                console.log("Tester Doctor Profile Repaired : ", repairedProfile);
            }
            catch (repairError) {
                console.log("Error Repairing Tester Doctor Profile (user left intact) : ", repairError);
            }
            return;
        }
        if (!name || !email || !password) {
            throw new appError_1.AppError(http_status_1.default.INTERNAL_SERVER_ERROR, "Tester Doctor Name , Email, Password Missing In Env File!!!");
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, Number(config_1.default.bcrypt_salt_rounds));
        const testerDoctor = await prisma_1.prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: enums_1.Role.DOCTOR,
                needPasswordChange: false,
                emailVerified: true,
                doctor: {
                    create: testerDoctorProfile(name, email),
                }
            },
        });
        console.log("Tester Doctor Created : ", testerDoctor);
    }
    catch (error) {
        console.log("Error Seeding Tester Doctor : ", error);
        await prisma_1.prisma.user.delete({
            where: {
                email: config_1.default.tester_doctor_email,
            },
        });
    }
};
exports.seedTesterDoctor = seedTesterDoctor;
