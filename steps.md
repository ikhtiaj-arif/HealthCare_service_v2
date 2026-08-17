# HealthCare Backend — Build Log

This document tracks each feature implemented in the project: what it does, why it was needed, how it was built, and the edge cases it handles (plus edge cases still missing).

---

## 1. Linter & Formatter (Biome)

**What to do**
Set up Biome as a single tool for both linting and code formatting across the codebase.

**Why to do it**
- When multiple people (or the same person over time) touch a codebase, inconsistent indentation, quote style, and semicolon usage create noisy diffs and slow down reviews.
- A linter catches common mistakes and enforces best-practice patterns before they reach production.
- Using one tool (Biome) instead of separate ESLint + Prettier configs keeps setup and CI simple and fast.

**How it is done**
- `biome.json` added at the project root configuring formatting and linting rules.
- Runs as a dev-time/CI step (not wired into a git hook currently).

**Edge cases / gaps**
- No pre-commit hook (e.g. Husky + lint-staged) enforcing this automatically — a developer can still commit unformatted/lint-failing code.
- No CI workflow file found in the repo, so linting isn't enforced on PRs yet.

---

## 2. Google OAuth Login

**What to do**
Let a patient sign in/register using their Google account instead of email+password.

**Why to do it**
- Reduces signup friction (no password to invent/remember).
- Offloads identity verification to Google, which is already a trusted, verified email source.

**How it is done**
- `src/app/lib/googleAuth.ts` creates an `OAuth2Client` from `google-auth-library` using `GOOGLE_CLIENT_ID`.
- `POST /api/v1/auth/google-login` (`googleLogin` in `auth.controller.ts`) accepts an `idToken` from the frontend.
- `AuthService.googleLogin`:
  1. Verifies the ID token with `googleClient.verifyIdToken`.
  2. Extracts `email`, `name`, `sub` (Google user id) from the verified payload.
  3. Looks for an existing `PATIENT` user with that `email` **and** matching `googleId` — if found, logs them in directly.
  4. If not found, checks for an existing `PATIENT` with `CREDENTIAL` auth (i.e. they registered with email/password earlier). If found and verified/active, **links** the Google id to that existing account (account linking) instead of creating a duplicate.
  5. If neither exists, creates a brand-new user with `authProvider: GOOGLE`, `emailVerified: true`, and an associated `Patient` record, then sends a welcome email.
  6. Issues access/refresh JWTs and sets them as httpOnly cookies.

**Edge cases handled**
- Invalid/expired Google ID token → rejected with a clear error.
- Missing email or name in the Google payload → rejected.
- Linking flow checks the existing credential-based account is verified, not blocked, and not deleted before linking.
- Blocked/deleted users are rejected even after successful Google verification.

**Edge cases still missing**
- The lookup filters `role: Role.PATIENT` — a `DOCTOR`/`ADMIN`/`SUPER_ADMIN` account with the same email is never found by this query, so if such an account exists, this flow will try to create a **second** user with the same email. Since `User.email` is `@unique`, that throws a raw Prisma unique-constraint error instead of a clean "email already registered under a different role" message.
- `googleClient` uses only `client_id`, not `client_secret` — fine for ID-token verification, but confirm this is intentional if the frontend ever needs the auth-code flow instead of the implicit/ID-token flow.
- No rate limiting on this endpoint — someone could hammer it with junk tokens.

---

## 3. Validation & Sanitization (Zod)

**What to do**
Validate and sanitize every incoming request body before it reaches business logic.

**Why to do it**
- Prevents malformed/malicious payloads (wrong types, missing fields, injection attempts) from reaching the database layer.
- Centralizes validation rules so error messages are consistent and controllers stay thin.

**How it is done**
1. `zod` installed as the schema library.
2. Schemas defined per module, e.g. `auth.validation.ts` → `PatientRegistrationZodSchema`, `PatientVerifyEmailZodSchema`, `LoginZodSchema` (name length, email format, strong-password regex requiring lower/upper/number/special char, OTP exactly 6 chars).
3. A higher-order middleware, `validateRequest(zodSchema)` (`src/app/middleware/validateRequest.ts`), wraps `catchAsync`, runs `zodSchema.safeParse(req.body)`, throws on failure, and otherwise replaces `req.body` with the **parsed/sanitized** data before calling `next()`.
4. Wired into routes, e.g. `router.post("/register", validateRequest(UserValidation.PatientRegistrationZodSchema), AuthController.registerPatient)`.

**Edge cases handled**
- Missing `req.body` defaults to `{}` instead of throwing on `undefined`.
- Only the **first** validation error message is surfaced (`result.error.issues[0].message`) — simple and readable, though it means the client doesn't see every failing field at once.

**Edge cases still missing**
- `LoginZodSchema` exists but is **not applied** to `POST /login` in `auth.route.ts` — login currently accepts any shape of body straight into `AuthService.loginUser`, bypassing email-format and password-strength checks at the boundary.
- No validation schema/middleware applied to `google-login`, `forgot-password`, `reset-password`, or the profile-image upload route — a malformed `idToken`, `email`, or `otp` only fails deep inside the service/DB layer with a less predictable error.
- `PatientRegistrationZodSchema` caps `name` at a **max of 10 characters**, which looks unintentionally low for real names (likely meant to be larger, e.g. 100).

---

## 4. Forgot Password Flow (Redis-backed OTP)

**What to do**
Let a user reset their password via a time-limited OTP sent to their email, without storing long-lived reset tokens in the primary database.

**Why to do it**
- Redis gives natural TTL-based expiry (`EX`) so OTPs auto-expire without a cleanup job.
- Keeps transient, sensitive one-time secrets out of the permanent Postgres database.

**How it is done**
1. `src/app/lib/redis.ts` creates a Redis client from `REDIS_HOST/PORT/USER/PASSWORD`, connected once at server startup (`server.ts`).
2. `AuthService.forgotPassword(email)`:
   - Confirms the user exists, is email-verified, not blocked, not deleted, and isn't a Google-only account.
   - Generates a 6-digit numeric OTP via `crypto.randomInt(100000, 1000000)`.
   - Stores it in Redis under `forgot_password-otp:<email>` with a 5-minute TTL.
   - Emails the OTP using the `forgot-password.ejs` template.
3. `AuthService.resetPassword({ email, otp, newPassword })`:
   - Re-runs the same account-state checks.
   - Fetches the OTP from Redis, throws if missing or mismatched.
   - Hashes the new password (`bcrypt`, 8 salt rounds) and updates the `User` row.
   - Deletes the OTP key from Redis (single-use).
   - Sends a "password updated" confirmation email.

**Edge cases handled**
- Rejects reset attempts for unverified, blocked, deleted, or Google-only accounts.
- OTP is single-use (deleted after successful verification) and time-bound (5 minutes).

**Edge cases still missing**
- No **attempt limiting** — an attacker who obtains/guesses the 6-digit OTP can retry `resetPassword` freely until it expires (a fairly wide guessing window for a 6-digit code with no lockout).
- No invalidation of existing access/refresh JWTs after a password reset — a token issued before the reset stays valid until its own expiry, which is a real gap for "I think my account was compromised" scenarios.
- `resetPassword` doesn't enforce the same password-strength rules as registration, since no validation middleware is attached to this route at all (see section 3).
- No re-request/resend cooldown — `forgotPassword` can be called repeatedly to spam OTP emails to the same address.

---

## 5. Send OTP via Gmail (Nodemailer)

**What to do**
Deliver OTPs and transactional emails (verification, welcome, password-reset confirmation) through Gmail SMTP.

**Why to do it**
- A reliable, zero-infra way to send transactional email without standing up a dedicated email service at this stage.
- Gmail App Passwords allow SMTP auth without exposing the real account password.

**How it is done**
- `src/app/lib/nodemailer.ts` creates a `nodemailer` transporter with `service: "gmail"` using `SMTP_USER` / `SMTP_PASSWORD` (a Google App Password, not the account login password).
- `transporter.verify()` is called once at server boot (`server.ts`) to fail fast if credentials are wrong, before accepting traffic.
- Used across registration, forgot-password, reset-password, and Google-registration-welcome flows.

**Edge cases handled**
- Startup fails loudly (`process.exit(1)`) if the mail transporter can't authenticate, instead of silently failing on the first real user request.

**Edge cases still missing**
- No retry/fallback if `sendMail` fails mid-request — e.g. in `registerPatient`, if the Redis writes succeed but the email send throws, the OTP/pending data sits in Redis but the user never receives anything, and there's no resend endpoint.
- Gmail SMTP has sending-volume limits — fine for dev/testing, worth swapping to a dedicated provider (SES, Resend, SendGrid) before real production traffic.

---

## 6. Email Verification (Registration via OTP)

**What to do**
Require a user to prove ownership of their email before their account becomes real/queryable in the primary database.

**Why to do it**
- Prevents fake/typo'd emails from creating permanent accounts.
- Keeps unverified signups out of the `users` table entirely — nothing is written to Postgres until verification succeeds.

**How it is done**
1. `POST /register` → `AuthService.registerPatient`:
   - Checks no `User` already exists with that email.
   - Hashes the password (`bcrypt`, 8 rounds).
   - Generates a 6-digit OTP, stores it in Redis (`patient-registration-otp:<email>`, 5-min TTL).
   - Stores the **entire pending user payload** (name, email, hashed password, patient sub-fields) as JSON in Redis (`patient-registration-data:<email>`, 5-min TTL) — nothing touches Postgres yet.
   - Emails the OTP via `registration-user-otp.ejs`.
2. `POST /verify-email` → `AuthService.verifyPatientEmail`:
   - Guards against an already-existing/blocked/deleted user record.
   - Compares submitted OTP to the Redis value; deletes the OTP key on success.
   - Reads back the pending JSON payload from Redis, parses it.
   - Creates the `User` **and** nested `Patient` record in a single Prisma write (`patient: { create: {...} }`).
   - Deletes the pending-data Redis key.
   - Sends a welcome email (`patient-welcome-email.ejs`).
   - Issues access/refresh JWTs and sets them as httpOnly cookies — the user is auto-logged-in immediately after verifying.

**Edge cases handled**
- OTP mismatch and missing/expired OTP both throw distinct, clear errors.
- Missing pending-data (e.g. the 5-minute window expired) throws "User does not exists" rather than crashing on `JSON.parse(null)`.

**Edge cases still missing**
- `verifyPatientEmail`'s guard checks `User.emailVerified` / `.status === BLOCKED` / `.isDeleted` — but at this point the user normally doesn't exist in Postgres yet (only in Redis). These checks only bite if a user with the same email already exists via a *different* path (e.g. Google signup). Worth confirming this interaction is intentional, since a Google-registered account with the same email would currently block credential-based verification with a somewhat misleading error.
- No resend-OTP endpoint — if the 5-minute window lapses, the user must restart the entire `register` call rather than just requesting a fresh OTP.
- No rate limit on OTP verification attempts (brute-forcing a 6-digit code within the 5-minute window is feasible without throttling).
- If `sendMail` fails after the Redis writes in `registerPatient`, the pending registration silently sits in Redis with no email ever delivered and no way for the user to retry without waiting for TTL expiry.

---

## 7. Login & Token Refresh (JWT + httpOnly Cookies)

**What to do**
Authenticate returning users and keep them signed in with short-lived access tokens backed by longer-lived refresh tokens.

**Why to do it**
- Short-lived access tokens limit the damage window if a token leaks; refresh tokens let the user stay logged in without re-entering credentials.
- httpOnly cookies keep tokens out of reach of client-side JavaScript (XSS mitigation).

**How it is done**
- `AuthService.loginUser`: looks up by email, rejects blocked/deleted users, rejects Google-only accounts trying to use a password, compares the password hash with `bcrypt.compare`, then issues both tokens via `jwtUtils.createToken` (`src/app/utils/jwt.ts`, wraps `jsonwebtoken`).
- Both tokens are set as cookies: `accessToken` (24h), `refreshToken` (7d).
- `POST /refresh-token` (`AuthService.refreshToken`) verifies the refresh token, re-checks the user is still active/not deleted, and issues a **new pair** of tokens (refresh token rotation).
- `checkAuth.ts` (`auth()` middleware) reads the token from the cookie first, falling back to an `Authorization: Bearer` header; verifies it; re-fetches the user from the DB (not just trusting the JWT payload) to catch since-blocked accounts; attaches `req.user`.

**Edge cases handled**
- Login explicitly detects and rejects the "you registered with Google, use Google login" case.
- `refreshToken` re-validates the user is still `ACTIVE` and not deleted — a token issued before a ban still gets rejected on refresh.
- `auth()` middleware re-checks `status === "BLOCKED"` against the live DB row, not just the JWT claims, so a ban takes effect immediately rather than waiting for token expiry.

**Edge cases still missing — highest priority to fix**
- **Cookie flags are insecure and self-contradictory**: every cookie is set with `secure: false` and `sameSite: "none"`. Browsers reject `sameSite: "none"` cookies unless they're also `secure: true`, so over real HTTPS/cross-site deployments these cookies may simply be **silently dropped**, breaking login entirely. Should be `secure: true, sameSite: "none"` in production (or `secure: false, sameSite: "lax"` for same-site local dev).
- `checkAuth`'s DB lookup uses a compound `where: { id, email, name, role }` inside `findUnique`. Since only `id` is actually unique on `User`, tying the lookup to `name`/`role`/`email` from a possibly-stale JWT means if the user's name changed after the token was issued, this lookup can fail even for a perfectly valid account. Simpler and safer to look up by `id` alone and compare the rest from the fresh DB record.
- No visible logout endpoint clearing cookies, and no server-side token invalidation — a JWT remains valid until natural expiry even after "logout."
- Refresh token rotation issues a new refresh token but never invalidates the old one server-side, so a stolen refresh token stays usable until it naturally expires.

---

## 8. Role-Based Access Control

**What to do**
Restrict specific routes to specific user roles (`SUPER_ADMIN`, `ADMIN`, `DOCTOR`, `PATIENT`).

**Why to do it**
- A healthcare system needs strict separation of who can reach which endpoints.

**How it is done**
- `auth(...requiredRoles: Role[])` is a factory middleware — call it with an allow-list, e.g. `auth(Role.ADMIN, Role.DOCTOR, Role.PATIENT, Role.SUPER_ADMIN)`. If `requiredRoles` is empty, any authenticated role passes.
- Currently used on `/auth/me` and `/user/profile-image`, both open to all four roles (effectively just "must be logged in" today).

**Edge cases still missing**
- No route in the current codebase actually restricts to a *subset* of roles yet (e.g. an admin-only route) — worth confirming this is planned for upcoming admin/doctor modules rather than an oversight.

---

## 9. Global Error Handling & 404s

**What to do**
Centralize error formatting so every thrown error (Prisma errors, validation errors, plain `Error`s) returns a consistent JSON shape.

**Why to do it**
- Keeps controllers free of try/catch boilerplate.
- Prevents leaking internal details to clients in production while staying verbose in development.

**How it is done**
- `catchAsync` (`src/app/utils/catchAsync.ts`) wraps every controller/middleware and forwards thrown errors to `next(error)`.
- `globalErrorHandler` (registered last in `app.ts`) pattern-matches on Prisma error subclasses (`PrismaClientValidationError`, `PrismaClientKnownRequestError` codes `P2002`/`P2003`/`P2025`, `PrismaClientInitializationError` codes `P1000`/`P1001`, `PrismaClientUnknownRequestError`) to produce friendlier messages and status codes, falling back to a generic 500 for anything else. Full error/stack is only included when `NODE_ENV === "development"`.
- `notFound` middleware returns a structured 404 for unmatched routes.

**Edge cases still missing**
- **Bug:** the final response line hardcodes `res.status(httpStatus.INTERNAL_SERVER_ERROR)` instead of `res.status(statusCode)`. Even a correctly-detected `400 Bad Request` (e.g. duplicate email, `P2002`) always goes out as HTTP `500`, even though the JSON body correctly says `"statusCode": 400`. Any frontend that checks the HTTP status code (rather than the JSON body) will see 500s everywhere.
- **Ordering:** `notFound` is registered *after* `globalErrorHandler` in `app.ts`. Conventionally `notFound` should come first, so it's unambiguous which middleware is "last resort for unmatched routes" vs. "last resort for thrown errors" — worth double-checking real request behavior here, since middleware order is a common source of subtle bugs.
- No custom `AppError` class carrying its own status code — every application-level throw (`"User not found"`, `"Invalid credentials"`, etc.) is a plain `Error`, so it falls into the generic `else if (err instanceof Error)` branch and never overrides the seeded `INTERNAL_SERVER_ERROR` status. In practice, "Invalid credentials" on login currently reports as a 500 in the JSON body too, not a 401. A dedicated `AppError` class with a status code would fix this at the root rather than special-casing only Prisma errors.

---

## 10. Profile Image Upload (Multer + Cloudinary)

**What to do**
Let an authenticated user upload/replace their profile picture.

**Why to do it**
- Needed multipart/form-data handling (Multer) plus persistent image hosting with a CDN URL (Cloudinary), rather than storing binary blobs in Postgres.

**How it is done**
1. `src/app/lib/multer.ts`: `multer.memoryStorage()` — files are kept in RAM as a `Buffer`, never written to local disk (works well for ephemeral/serverless-style hosts and avoids disk cleanup).
2. `PATCH /user/profile-image`, protected by `auth(...)`, then `upload.single("profileImage")` parses the multipart field into `req.file`.
3. `userController.uploadProfileImage`: rejects if no file is present; pulls `userId` from `req.user` (set by the `auth` middleware); delegates to the service.
4. `userService.uploadProfileImage(buffer, userId)`:
   - Looks up the user's **current** `imageUrl` / `image_public_id` first (needed for cleanup).
   - Uploads the buffer to Cloudinary via `cloudinary.uploader.upload_stream(...).end(buffer)`, wrapped in a `Promise` since the Cloudinary SDK uses a callback pattern.
   - Updates the `User` row with the new `secure_url` and `public_id`.
   - **After** the update succeeds, deletes the *old* Cloudinary asset (`cloudinary.uploader.destroy`) if one existed — prevents orphaned images accumulating in Cloudinary storage.

**Edge cases handled**
- Old image is cleaned up after a successful replace, not before, so a failed upload doesn't leave the user with no image at all.
- Missing file on the request is explicitly rejected with a clear error rather than crashing on `req.file.buffer`.

**Edge cases still missing**
- No file-type or file-size validation/limit on the Multer instance (`multer({ storage })` has no `limits` or `fileFilter`) — a user could upload an oversized file or a non-image, and it goes straight to Cloudinary.
- `resource_type: "auto"` in the Cloudinary upload options means non-image files (video, raw) are also accepted as a "profile image" without restriction.
- If the Cloudinary upload succeeds but the subsequent `prisma.user.update` fails, the new asset is orphaned in Cloudinary with nothing pointing to it (no rollback of the upload in that failure path).
- Old-image deletion isn't wrapped in its own try/catch — if `cloudinary.uploader.destroy` throws (e.g. transient network issue), it currently propagates up as a request failure even though the *primary* goal (saving the new image) already succeeded.

---

## 11. Database Schema & Seeding

**What to do**
Model core entities and pre-populate known accounts needed to test each role.

**Why to do it**
- Splitting the Prisma schema into `schema.prisma` / `enums.prisma` / `user.prisma` / `patient.prisma` keeps larger future schemas (Doctor, Appointment, etc.) manageable per-domain instead of one giant file.
- Seeding a Super Admin, a tester Admin, and a tester Doctor at boot makes role-gated routes testable immediately without a manual signup flow.

**How it is done**
- `User` ↔ `Patient` is a 1:1 relation (`Patient.userId @unique`) with `onDelete: Cascade`, so deleting a `User` cleans up their `Patient` row automatically.
- Enums (`Role`, `UserStatus`, `Gender`, `AuthProvider`) centralize allowed values.
- Indexes added on `Patient.email` and `Patient.isDeleted` for common query patterns (lookup by email, filter out soft-deleted patients).
- `seed.ts`'s three functions run sequentially in `server.ts` before `app.listen`, each checking for an existing record first (idempotent — safe to restart the server repeatedly without duplicate seed data).

**Edge cases handled**
- Idempotent seeding (checks existence before creating).

**Edge cases still missing**
- Each seed function's `catch` block calls `prisma.user.delete(...)` on failure — but if the original failure was itself a DB connectivity issue (a very plausible cause), this delete call will also throw, and that secondary error isn't caught, producing a confusing crash instead of a clean log of the real problem. Similarly, if `user.create` fails for a reason unrelated to "already exists" (e.g. a config typo), the cleanup delete will fail too since there's nothing to delete.
- `Patient.email` is `@unique` and `User.email` is also `@unique`, but there's no constraint tying them to always match — a future direct write to `Patient` (bypassing the nested-create pattern used today) could desync the two.
- `Gender` enum exists in the schema but isn't used anywhere in `Patient` yet — likely intentional for a future field, just flagging it's currently unused.

---

## Summary of the highest-priority fixes found during this review

1. **Cookie flags** (`secure:false` + `sameSite:"none"`) — likely breaks cookie-based auth entirely over HTTPS; fix per environment.
2. **`globalErrorHandler` always returns HTTP 500** regardless of the computed `statusCode` — breaks any frontend that checks HTTP status codes.
3. **No `AppError` class with status codes** — every domain error (invalid credentials, not found, forbidden, etc.) is a generic `Error` and currently reports as 500 in the response status.
4. **`LoginZodSchema` defined but never wired to `/login`** — login bypasses validation entirely.
5. **No file-type/size limits on profile image upload** — open to abuse.
6. **No OTP attempt-rate-limiting** anywhere (registration verify, password reset) — brute-forceable within the 5-minute TTL window.