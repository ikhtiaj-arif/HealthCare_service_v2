"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUnverifiedDoctors = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = require("./prisma");
const enums_1 = require("../../generated/prisma/enums");
const deleteUnverifiedDoctors = async () => {
    node_cron_1.default.schedule("*/10 * * * *", async () => {
        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const deletedDoctors = await prisma_1.prisma.user.deleteMany({
                where: {
                    role: enums_1.Role.DOCTOR,
                    emailVerified: false,
                    createdAt: {
                        lt: oneHourAgo,
                    },
                    doctor: {
                        verificationStatus: enums_1.DoctorVerificationStatus.PENDING,
                    },
                },
            });
            if (deletedDoctors.count > 0) {
                console.log(`Cron: Deleted ${deletedDoctors.count} unverified email doctor applications older then 1 hour`);
            }
        }
        catch (error) {
            console.log("Cron: failed to delete unverified doctor applications", error);
        }
        console.log("Doctor delete cron schedule (every 10 minutes)");
    });
};
exports.deleteUnverifiedDoctors = deleteUnverifiedDoctors;
