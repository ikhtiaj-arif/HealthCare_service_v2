"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtUtils = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const createToken = (payload, secret, expiresIn) => {
    const token = jsonwebtoken_1.default.sign(payload, secret, {
        expiresIn,
    });
    return token;
};
const verifyToken = (token, secret) => {
    try {
        const verifiedToken = jsonwebtoken_1.default.verify(token, secret);
        return {
            success: true,
            data: verifiedToken,
        };
    }
    catch (error) {
        console.log("Token verification failed:", error);
        return {
            success: false,
            error: error.message,
        };
    }
};
exports.jwtUtils = {
    createToken,
    verifyToken,
};
