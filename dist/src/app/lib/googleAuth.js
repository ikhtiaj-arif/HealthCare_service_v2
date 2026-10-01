"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleClient = void 0;
const google_auth_library_1 = require("google-auth-library");
const config_1 = __importDefault(require("../config"));
exports.googleClient = new google_auth_library_1.OAuth2Client({
    client_id: config_1.default.google_client_id,
});
