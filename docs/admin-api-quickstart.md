# PicPeak Admin API Quickstart

This guide explains how to authenticate against the PicPeak Admin API, use the OpenAPI documentation, and exercise the three automation endpoints (`create event`, `photo upload`, `resend email`) that now ship with machine-readable docs.

> **Prerequisites**
>
> - PicPeak backend running (Docker or local `node backend/server.js`)
> - An admin account (see `data/ADMIN_CREDENTIALS.txt` for the seeded defaults)
> - API base URL (defaults to `http://localhost:3001/api`)

---

## 1. Obtain an Admin API Token

1. Determine whether reCAPTCHA is enabled in **Admin → Settings → Security**. If disabled (the default), you can skip the `recaptchaToken` field shown below.
2. Authenticate with your admin username/email and password:

```bash
curl --fail --silent --show-error \
  -X POST "http://localhost:3001/api/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "BoldTiger5872%",
    "recaptchaToken": ""
  }' | jq
```

Successful responses look like:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "mustChangePassword": false
  }
}
```

- PicPeak also sets the `admin_token` cookie; however, when scripting you typically pass the token in an `Authorization: Bearer <token>` header.
- Tokens expire after 24 hours. Log in again to refresh them.

---

## 2. Use the OpenAPI Documentation

The machine-readable spec lives at `docs/picpeak-admin-api.openapi.yaml`. You can:

- Preview it interactively with Redocly:

  ```bash
  npx --yes @redocly/cli preview-docs docs/picpeak-admin-api.openapi.yaml
  ```

- Import it into Postman, Insomnia, or VS Code REST client.
- Validate changes as part of CI with:

  ```bash
  npx --yes @apidevtools/swagger-cli@4.0.4 validate docs/picpeak-admin-api.openapi.yaml
  ```

Keep this file in sync whenever the backend endpoints evolve.

---

## 3. Call the Key Admin Endpoints

Below are minimal `curl` examples that rely on the bearer token captured earlier.

### 3.1 Create an Event

```bash
API_URL="http://localhost:3001/api"
TOKEN="REPLACE_WITH_JWT"

curl --fail --silent --show-error \
  -X POST "$API_URL/admin/events" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "wedding",
    "event_name": "Emily & Jordan Celebration",
    "event_date": "2025-06-07",
    "customer_name": "Emily Carter",
    "customer_email": "emily@example.com",
    "admin_email": "studio@example.com",
    "require_password": true,
    "password": "Shutter123",
    "expiration_days": 45
  }' | jq
```

### 3.2 Upload Photos to the Event

```bash
EVENT_ID=512

curl --fail --silent --show-error \
  -X POST "$API_URL/admin/events/$EVENT_ID/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "photos=@/path/to/DSC_2031.jpg" \
  -F "photos=@/path/to/DSC_2032.jpg" \
  -F "category_id=individual" | jq
```

- Files must be JPEG/PNG/WebP, each ≤ 50 MB.
- The per-request file count respects the `general_max_files_per_upload` admin setting (default 500).

### 3.3 Resend the Gallery Email

```bash
curl --fail --silent --show-error \
  -X POST "$API_URL/admin/events/$EVENT_ID/resend-email" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password": "Shutter123"}' | jq
```

Omit `"password"` to send the standard security message instead.

---

## 4. Quick Testing Checklist

- ✅ Login succeeds and returns a token (HTTP 200).
- ✅ Creating an event returns `id`, `slug`, and `share_link`.
- ✅ Uploading more files than allowed returns HTTP 400 with a helpful message.
- ✅ Resending email for a missing event returns HTTP 404.
- ✅ `swagger-cli validate` passes after any spec edits.

Automate these checks using your preferred test harness or CI pipeline to catch regressions early.

---

## 5. Migrating From `host_*`

- Run backend migrations to add the new `customer_name` / `customer_email` columns: `npm --prefix backend run migrate` (or your existing deployment flow). The migration copies legacy data automatically, so upgrades remain seamless.
- All admin APIs now require the `customer_*` fields. Older `host_*` payloads are rejected, which makes downstream client issues obvious during testing instead of silently dropping data.
- API responses still mirror `customer_*` even if migrations have not run yet (the server falls back to legacy columns until the upgrade is complete), so existing frontends can move over incrementally.
- Once every consumer writes and reads the new fields, you can safely plan the removal of the legacy `host_*` columns in a future release.

---

Need deeper integration examples or language-specific SDKs? Import the OpenAPI spec into code generators such as `openapi-generator` or `orval` to scaffold API clients quickly.
