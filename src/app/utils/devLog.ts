import config from "../config";

export const isDev = () => config.node_env === "development";

export const devLog = (...args: unknown[]) => {
	if (isDev()) {
		console.log("[dev]:", ...args);
	}
};
