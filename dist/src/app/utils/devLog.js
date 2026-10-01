"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.devLog = exports.isDev = void 0;
const config_1 = __importDefault(require("../config"));
const isDev = () => config_1.default.node_env === "development";
exports.isDev = isDev;
const devLog = (...args) => {
    if ((0, exports.isDev)()) {
        console.log("[dev]:", ...args);
    }
};
exports.devLog = devLog;
