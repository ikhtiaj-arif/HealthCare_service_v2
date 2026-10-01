"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBkashIdToken = void 0;
const config_1 = __importDefault(require("../config"));
const redis_1 = require("./redis");
const appError_1 = require("../utils/appError");
const http_status_1 = __importDefault(require("http-status"));
const getBkashIdToken = async () => {
    try {
        const IdTokenKey = "bkash:idToken";
        const RefreshTokenKey = "bkash:refreshToken";
        let bkashIdToken = await redis_1.redisClient.get(IdTokenKey);
        const bkashIdTokenTTL = await redis_1.redisClient.ttl(IdTokenKey);
        let bkashRefreshToken = await redis_1.redisClient.get(RefreshTokenKey);
        const bkashRefreshTokenTTL = await redis_1.redisClient.ttl(RefreshTokenKey);
        // console.log(
        // 	{
        // 		bkashIdToken,
        // 		bkashIdTokenTTL,
        // 		bkashRefreshToken,
        // 		bkashRefreshTokenTTL
        // 	}
        // );
        //? bkash id token remaining time is less or equal to 10 minutes or expired id token
        //? bkash refresh token must exists
        //? bkash refresh token remaining time is more then 10 minutes
        if ((bkashIdTokenTTL <= 600 || !bkashIdToken) && bkashRefreshToken && bkashRefreshTokenTTL > 600) {
            const refreshTokenResponse = await fetch(`${config_1.default.bkash_base_url}/tokenized/checkout/token/refresh`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    username: config_1.default.bkash_user_name,
                    password: config_1.default.bkash_password,
                },
                body: JSON.stringify({
                    app_key: config_1.default.bkash_app_key,
                    app_secret: config_1.default.bkash_app_secret,
                    refresh_token: bkashRefreshToken,
                }),
            });
            if (!refreshTokenResponse.ok) {
                throw new appError_1.AppError(http_status_1.default.INTERNAL_SERVER_ERROR, "Bkash Access Token Grant Failed!");
            }
            const bkashRefreshTokenResult = await refreshTokenResponse.json();
            bkashIdToken = bkashRefreshTokenResult.id_token;
            await redis_1.redisClient.set(IdTokenKey, bkashIdToken, {
                expiration: {
                    type: "EX",
                    value: 60 * 60
                }
            });
            return bkashIdToken;
        }
        //? if id token exists on redis with more then 10min validity, return id token
        if (bkashIdTokenTTL > 600)
            return bkashIdToken;
        //? when no token exists on redis
        const response = await fetch(`${config_1.default.bkash_base_url}/tokenized/checkout/token/grant`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                username: config_1.default.bkash_user_name,
                password: config_1.default.bkash_password,
            },
            body: JSON.stringify({
                app_key: config_1.default.bkash_app_key,
                app_secret: config_1.default.bkash_app_secret,
            }),
        });
        if (!response.ok) {
            throw new appError_1.AppError(http_status_1.default.INTERNAL_SERVER_ERROR, "Bkash Access Token Grant Failed!");
        }
        const result = await response.json();
        // bkash id token set
        await redis_1.redisClient.set(IdTokenKey, result.id_token, {
            expiration: {
                type: "EX",
                value: 60 * 60,
            },
        });
        //bkash refresh token set
        await redis_1.redisClient.set(RefreshTokenKey, result.refresh_token, {
            expiration: {
                type: "EX",
                value: 60 * 60 * 24 * 28,
            },
        });
        bkashIdToken = result.id_token;
        return bkashIdToken;
    }
    catch (error) {
        throw new appError_1.AppError(http_status_1.default.INTERNAL_SERVER_ERROR, error.message);
    }
};
exports.getBkashIdToken = getBkashIdToken;
