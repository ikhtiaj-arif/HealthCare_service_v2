"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const http_status_1 = __importDefault(require("http-status"));
const config_1 = __importDefault(require("./app/config"));
const globalErrorHandler_1 = require("./app/middleware/globalErrorHandler");
const notFound_1 = require("./app/middleware/notFound");
const auth_route_1 = require("./app/module/auth/auth.route");
const user_route_1 = require("./app/module/user/user.route");
const bkash_1 = require("./app/lib/bkash");
const appointment_route_1 = require("./app/module/appointment/appointment.route");
const doctor_routes_1 = require("./app/module/doctor/doctor.routes");
const schedule_route_1 = require("./app/module/schedule/schedule.route");
const payment_route_1 = require("./app/module/payment/payment.route");
const prescription_route_1 = require("./app/module/prescription/prescription.route");
const analytics_route_1 = require("./app/module/analytics/analytics.route");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: config_1.default.frontend_url,
    credentials: true,
}));
// Enable URL-encoded form data parsing
app.use(express_1.default.urlencoded({ extended: true }));
// Middleware to parse JSON bodies
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use("/api/v1/auth", auth_route_1.AuthRoutes);
app.use("/api/v1/user", user_route_1.UserRoutes);
app.use("/api/v1/appointment", appointment_route_1.AppointmentRoutes);
app.use("/api/v1/doctor", doctor_routes_1.DoctorRoutes);
app.use("/api/v1/schedule", schedule_route_1.ScheduleRoutes);
app.use("/api/v1/payment", payment_route_1.PaymentRoutes);
app.use("/api/v1/prescription", prescription_route_1.PrescriptionRoutes);
app.use("/api/v1/analytics", analytics_route_1.AnalyticsRoutes);
app.get("/test", async (req, res) => {
    try {
        const grantIdTOken = await (0, bkash_1.getBkashIdToken)();
        console.log(grantIdTOken);
        res.status(http_status_1.default.OK).json({
            success: true,
            message: "Welcome to HealthCare",
            data: null,
        });
    }
    catch (error) {
        console.log(error);
        res.status(http_status_1.default.BAD_REQUEST).json({
            success: true,
            message: "Error to HealthCare",
            data: error,
        });
    }
});
// Basic route
app.get("/", async (req, res) => {
    res.status(http_status_1.default.OK).json({
        success: true,
        message: "Welcome to PH Healthcare System Backend",
    });
});
app.use(globalErrorHandler_1.globalErrorHandler);
app.use(notFound_1.notFound);
exports.default = app;
