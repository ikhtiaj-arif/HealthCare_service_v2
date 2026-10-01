"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomPassword = void 0;
const crypto_1 = __importDefault(require("crypto"));
const UPPERCASE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE_CHARS = "abcdefghijklmnopqrstuvwxyz";
const NUMBER_CHARS = "0123456789";
const SPECIAL_CHARS = "!@#$%^&*()-_=+[]{}<>?";
const ALL_CHARS = UPPERCASE_CHARS + LOWERCASE_CHARS + NUMBER_CHARS + SPECIAL_CHARS;
const REQUIRED_CHARSETS = [
    UPPERCASE_CHARS,
    LOWERCASE_CHARS,
    NUMBER_CHARS,
    SPECIAL_CHARS,
];
const pickRandomChar = (chars) => chars[crypto_1.default.randomInt(0, chars.length)];
const shuffleChars = (value) => {
    const chars = value.split("");
    for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto_1.default.randomInt(0, i + 1);
        const temp = chars[i];
        chars[i] = chars[j];
        chars[j] = temp;
    }
    return chars.join("");
};
const getRandomPassword = (length = 12) => {
    if (length < REQUIRED_CHARSETS.length) {
        throw new Error(`Password length must be at least ${REQUIRED_CHARSETS.length} to include an uppercase letter, a lowercase letter, a number and a special character.`);
    }
    const guaranteedChars = REQUIRED_CHARSETS.map(pickRandomChar);
    const remainingChars = Array.from({ length: length - guaranteedChars.length }, () => pickRandomChar(ALL_CHARS));
    return shuffleChars([...guaranteedChars, ...remainingChars].join(""));
};
exports.getRandomPassword = getRandomPassword;
