"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = __importDefault(require("./app/config"));
const cron_1 = require("./app/lib/cron");
const nodemailer_1 = require("./app/lib/nodemailer");
const prisma_1 = require("./app/lib/prisma");
const redis_1 = require("./app/lib/redis");
const seed_1 = require("./app/utils/seed");
const PORT = config_1.default.port;
const main = async () => {
    try {
        await prisma_1.prisma.$connect();
        console.log("Connected to the database successfully.");
        await redis_1.redisClient.connect();
        console.log("Connected to redis successfully.", config_1.default.redis_port);
        await nodemailer_1.transporter.verify();
        console.log("Connected to nodemailer.");
        await (0, seed_1.seedSuperAdmin)();
        await (0, seed_1.seedTesterAdmin)();
        await (0, seed_1.seedTesterDoctor)();
        await (0, cron_1.deleteUnverifiedDoctors)();
        app_1.default.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error("Error starting the server:", error);
        await prisma_1.prisma.$disconnect();
        process.exit(1);
    }
};
main();
