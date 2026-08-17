import { createClient } from "redis";
import config from "../config";

export const redisClient = createClient({
	username: config.redis_user,
	password: config.redis_password,
	socket: {
		host: config.redis_host,
		port: Number(config.redis_port),
	},
});

// redisClient.on('error', err => console.log('Redis Client Error', err));

// await redisClient.connect();

// await redisClient.set('foo', 'bar');
// const result = await redisClient.get('foo');
// console.log(result)  // >>> bar
