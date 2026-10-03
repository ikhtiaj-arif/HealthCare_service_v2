import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../src/app";
import { deleteUnverifiedDoctors } from "../src/app/lib/cron";
import { transporter } from "../src/app/lib/nodemailer";
import { prisma } from "../src/app/lib/prisma";
import { redisClient } from "../src/app/lib/redis";
import {
	seedSuperAdmin,
	seedTesterAdmin,
	seedTesterDoctor,
} from "../src/app/utils/seed";

/**
 * Vercel serverless entry. Local `npm run dev` still boots through
 * `src/server.ts` (listen + the same init sequence).
 *
 * Cold start runs the same fail-fast chain as server.ts so routes that need
 * Prisma / Redis / SMTP do not race an unready client. Seeds stay idempotent.
 */
let boot: Promise<void> | null = null;

function ensureBooted() {
	boot ??= (async () => {
		await prisma.$connect();
		if (!redisClient.isOpen) {
			await redisClient.connect();
		}
		await transporter.verify();
		await seedSuperAdmin();
		await seedTesterAdmin();
		await seedTesterDoctor();
		await deleteUnverifiedDoctors();
	})();
	return boot;
}

export default async function handler(
	req: IncomingMessage,
	res: ServerResponse,
) {
	await ensureBooted();
	return app(req, res);
}
