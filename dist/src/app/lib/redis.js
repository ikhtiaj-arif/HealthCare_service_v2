"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
const redis_1 = require("redis");
const config_1 = __importDefault(require("../config"));
exports.redisClient = (0, redis_1.createClient)({
    username: config_1.default.redis_user,
    password: config_1.default.redis_password,
    socket: {
        host: config_1.default.redis_host,
        port: Number(config_1.default.redis_port),
    },
});
// redisClient.on('error', err => console.log('Redis Client Error', err));
// await redisClient.connect();
// await redisClient.set('foo', 'bar');
// const result = await redisClient.get('foo');
// console.log(result)  // >>> bar
