# AGENTS.md

Express 5 + TypeScript + Prisma 7 (Postgres) backend for a doctor-appointment platform.
Single package, no monorepo, no CI, no git hooks.

## Commands

```bash
npm run dev            # tsx watch src/server.ts — the only working way to run the app
npx tsc --noEmit       # verification gate; passes clean today
npm run lint-check     # Biome; ~49 warnings + 73 infos are pre-existing
npm run format-fix     # Biome --write (see Conventions before running)
```

- `npm run start` (`node dist/src/server.js`) is **broken** — `tsc` emits extensionless ESM
  imports (`from "./app/config"`), which Node rejects with `ERR_UNSUPPORTED_DIR_IMPORT`.
  Treat `dist/` as typecheck output only; `npm run build` is a typecheck, not a deploy step.
- `npm test` intentionally exits 1. There is no test suite and no `*.test.ts` anywhere
  (vitest is a devDependency but unwired). Don't invent a test command.
- No npm wrappers for Prisma — call the CLI directly: `npx prisma generate`,
  `npx prisma migrate dev`, `npx prisma studio`.
- Lint/format is **Biome only**. The `eslint-disable` comments in `src/` are vestigial;
  no ESLint or Prettier is installed.
- Verification order when changing code: `npx tsc --noEmit`, then `npm run lint-check`
  and only look at diagnostics in files you touched.

## Runtime prerequisites

`src/server.ts:16` boots strictly fail-fast, in this order:
`prisma.$connect()` → `redisClient.connect()` → `transporter.verify()` → seed → cron → `listen`.

- **Postgres and Redis must both be up before `npm run dev`**, or the process exits(1)
  and never listens. Bad SMTP creds do the same.
- `src/app/utils/seed.ts` runs on *every* boot and upserts the `SUPER_ADMIN`, `ADMIN`,
  and `DOCTOR` users from `SUPER_ADMIN_*` / `TESTER_ADMIN_*` / `TESTER_DOCTOR_*` env vars.
  Its `catch` block **deletes the user row by email** on any failure — a half-configured
  seed can remove an existing account.
- Redis stores all ephemeral state: registration/OTP keys (`patient-registration-otp:`,
  `doctor-application-otp:`, `forgot_password-otp:`) and the bkash id/refresh tokens.
  Redis outages therefore fail auth flows mid-request, not at boot.
- `.env.example` is **incomplete** — it omits all six `BKASH_*` vars that
  `src/app/config/index.ts:49` and the bkash payment flow need. Take keys from `.env`.
- Env access: import `config` from `src/app/config/index.ts`. Only `src/app/lib/prisma.ts`
  reads `process.env` directly, and `prisma.config.ts` loads dotenv separately for the
  Prisma CLI. `config` has no startup validation — a missing var stays `undefined` and
  surfaces later as a confusing runtime error.
- Auth cookies are `sameSite: "lax"` + `secure: false` in dev, `none` + `secure: true`
  in prod (`src/app/module/auth/auth.controller.ts:58`). For local testing, use the
  `accessToken` from the JSON body with `Authorization: Bearer`, not the cookies.

## Architecture

- Feature modules live in `src/app/module/<name>/`: `route` → `controller` → `service`.
  Controllers never call Prisma; services never touch `req`/`res` — pass the
  `{ userId, email, name, role }` shape (`req.user`) instead.
- Every controller handler is wrapped in `catchAsync` and replies through `sendResponse`
  with `{ success, statusCode, message, data, meta }`. Throw `AppError` for expected
  failures; `globalErrorHandler` maps Prisma error codes and honours `AppError.statusCode`.
- Request validation is zod, in `<name>.validation.ts`, applied via `validateRequest(...)`
  listed **after** `auth(...)` in the route chain. (`README.md` still claims there is no
  validation layer — it is stale.)
- `auth(...roles)` in `src/app/middleware/checkAuth.ts` reads the cookie then the
  `Authorization` header, checks the role from the **token payload**, then re-queries the
  user on `id + email + name + role` all at once. Renaming a user or changing their role
  silently invalidates every issued token.
- Routes are mounted in `src/app.ts` under `/api/v1/*`; new modules need a line there.
- Prisma client is generated to `src/generated/prisma` (gitignored) and imported as
  `../../generated/prisma/client` and `../../generated/prisma/enums`. The schema is split
  across `prisma/schema/*.prisma` and wired by `prisma.config.ts`.
- `prisma/schema/schema.prisma` intentionally has **no `url` on the datasource** — the
  connection string arrives through the `@prisma/adapter-pg` driver adapter. Adding a
  `url` there breaks the Prisma 7 setup.

## Conventions

- **Indentation is mixed.** `biome.json` configures tabs + double quotes, but roughly half
  of `src/` (the analytics, appointment, doctor, payment, prescription, and schedule
  modules) is written with 4 spaces. Running `format-fix` reformats the whole repo.
  Match the file you are editing; do not reformat files you did not touch.
- **Module naming drifts, and is currently inconsistent.** Routes: `doctor.routes.ts` is
  plural where every other module uses `<name>.route.ts`; the doctor's validation file is
  misspelled `doctor.velidation.ts`. Exports vary too: `AuthController`/`AuthServices`,
  `AppointmentControllers`, `ScheduleController`, `userController`/`userService`.
  Follow the sibling module you are in; do not normalise names as a drive-by change.
- Biome skips `src/app/templates` (the `.ejs` email templates) and `src/generated`.
  Don't "fix" template formatting.
- `globalErrorHandler` is registered *before* `notFound` in `src/app.ts:76` — a known
  ordering oddity called out in `steps.md`. Leave it unless you're fixing it deliberately.
- `package-lock.json`, `dist/`, `.env`, and `src/generated/` are all gitignored, so
  dependency resolution is not pinned in git.

## Docs

- `Project Requirements.md` — the product spec. It is ahead of the code; don't treat it as
  a description of current behaviour.
- `steps.md` — numbered per-feature build log (what/why/how/edge cases). Append a new
  numbered section when you add a feature.
- `README.md` — **partly stale.** It claims auth is the only module, that there is no
  validation, that all errors return HTTP 500, and that `npm start` runs through tsx.
  Trust the code over the README.
- `HealthCare.postman_collection.json` — existing request examples worth checking before
  writing new curl calls.
