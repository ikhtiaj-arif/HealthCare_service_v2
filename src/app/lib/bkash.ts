import config from "../config";
import { redisClient } from "./redis";

export const getBkashIdToken = async () => {
	try {
		const IdTokenKey = "bkash:idToken";
		const RefreshTokenKey = "bkash:refreshToken";

		let bkashIdToken = await redisClient.get(IdTokenKey);
        const bkashIdTokenTTL = await redisClient.ttl(IdTokenKey)
        
		let bkashRefreshToken = await redisClient.get(RefreshTokenKey);
        const bkashRefreshTokenTTL = await redisClient.ttl(RefreshTokenKey)

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

			const refreshTokenResponse = await fetch(
				`${config.bkash_base_url}/tokenized/checkout/token/refresh`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
						username: config.bkash_user_name,
						password: config.bkash_password,
					},
					body: JSON.stringify({
						app_key: config.bkash_app_key,
						app_secret: config.bkash_app_secret,
						refresh_token: bkashRefreshToken,
					}),
				},
			);
			if (!refreshTokenResponse.ok) {
			throw new Error("Bkash Access Token Grant Failed!");
		}
			const bkashRefreshTokenResult = await refreshTokenResponse.json();

			bkashIdToken = bkashRefreshTokenResult.id_token as string;
            
            await redisClient.set(IdTokenKey, bkashIdToken, {
                expiration: {
                    type: "EX",
                    value: 60 * 60
                }
            })

			return bkashIdToken;
		}

		//? if id token exists on redis with more then 10min validity, return id token
		if (bkashIdTokenTTL > 600) return bkashIdToken;

		//? when no token exists on redis
		const response = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/token/grant`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					username: config.bkash_user_name,
					password: config.bkash_password,
				},
				body: JSON.stringify({
					app_key: config.bkash_app_key,
					app_secret: config.bkash_app_secret,
				}),
			},
		);
		if (!response.ok) {
			throw new Error("Bkash Access Token Grant Failed!");
		}
		const result = await response.json();

		// bkash id token set
		await redisClient.set(IdTokenKey, result.id_token, {
			expiration: {
				type: "EX",
				value: 60 * 60,
			},
		});

		//bkash refresh token set
		await redisClient.set(RefreshTokenKey, result.refresh_token, {
			expiration: {
				type: "EX",
				value: 60 * 60 * 24 * 28,
			},
		});

		bkashIdToken = result.id_token;

		return bkashIdToken;
	} catch (error: any) {
		throw new Error(error.message);
	}
};
