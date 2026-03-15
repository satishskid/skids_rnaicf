# SKIDS Screen V3 Mobile APK — API Endpoint Test Results

**Date:** 2026-03-13
**API Base:** `https://skids-api.satish-9f4.workers.dev`
**ONNX Model CDN:** `https://pub-skids-models.r2.dev`

---

## Summary

| Category | Status |
|----------|--------|
| API Health | PASS |
| Auth Endpoints | PASS |
| Protected Endpoints (Auth Guard) | PASS |
| ONNX Model R2 CDN | FAIL |
| CORS | PASS |

**Overall: 4/5 categories passing. R2 CDN for ONNX model is blocking Tier 2 AI inference.**

---

## Detailed Results

### 1. Health Check — PASS

| Endpoint | Method | Status | Response Time |
|----------|--------|--------|---------------|
| `/api/health` | GET | 200 OK | 0.38s |

- API version: `3.0.0`
- Services: API ok, Database ok
- DB latency: 291ms

### 2. Authentication Endpoints — PASS

| Endpoint | Method | Status | Response |
|----------|--------|--------|----------|
| `/api/auth/get-session` | GET | 200 | `null` (no session, expected) |
| `/api/auth/sign-in/email` | POST | 401 | `INVALID_EMAIL_OR_PASSWORD` (expected for bad creds) |
| `/api/auth/sign-up/email` | POST | 400 | `PASSWORD_TOO_SHORT` (validation works) |
| `/api/pin-auth/login` | POST | 400 | `pin and orgCode are required` (validation works) |

All auth endpoints respond correctly with proper error codes and messages.

### 3. Protected Endpoints (Auth Guard) — PASS

These endpoints correctly reject unauthenticated requests with 401:

| Endpoint | Method | Status | Response |
|----------|--------|--------|----------|
| `/api/campaigns` | GET | 401 | `Unauthorized — please sign in` |
| `/api/campaigns/TEST/children` | GET | 401 | `Unauthorized — please sign in` |
| `/api/campaigns/TEST/stats` | GET | 401 | `Unauthorized — please sign in` |
| `/api/campaign-progress/TEST` | GET | 401 | `Unauthorized — please sign in` |
| `/api/children` | POST | 401 | `Unauthorized — please sign in` |
| `/api/observations` | POST | 401 | `Unauthorized — please sign in` |
| `/api/observations/sync` | POST | 401 | `Unauthorized — please sign in` |
| `/api/ayusync/report` | GET | 401 | `Unauthorized` |

Auth middleware is functioning correctly on all protected routes.

### 4. ONNX Model R2 CDN — FAIL

| URL | Method | Status | Details |
|-----|--------|--------|---------|
| `https://pub-skids-models.r2.dev/photoscreen-v1.onnx` | HEAD | **401 Unauthorized** | HTML error page returned |
| `https://pub-skids-models.r2.dev/` (root) | GET | **401 Unauthorized** | HTML error page |

**Impact:** The mobile app's Tier 2 AI vision screening (`vision-screening.ts`) will fail to load the ONNX model. The app gracefully degrades to Tier 1 rule-based analysis with the fallback message: "ML model not available — using rule-based analysis only."

**Possible causes:**
- R2 bucket `pub-skids-models` may not have public access enabled
- Bucket may not exist or may have been deleted
- Custom domain configuration may be incorrect

**Recommended fix:**
1. Verify the R2 bucket exists: `wrangler r2 bucket list`
2. Enable public access: Cloudflare Dashboard > R2 > pub-skids-models > Settings > Public Access
3. Or upload the model to an alternative CDN

### 5. CORS — PASS

| Origin | Status | Headers Present |
|--------|--------|-----------------|
| `http://localhost:8081` (Expo dev) | 204 | All required headers |

CORS headers returned:
- `access-control-allow-origin: http://localhost:8081`
- `access-control-allow-credentials: true`
- `access-control-allow-headers: Content-Type,Authorization`
- `access-control-allow-methods: GET,POST,PUT,DELETE,PATCH,OPTIONS`

---

## Mobile App Endpoint Inventory

All API endpoints used by the mobile app (from source analysis):

| File | Endpoint | Purpose |
|------|----------|---------|
| `AuthContext.tsx` | `POST /api/auth/sign-in/email` | Email login |
| `AuthContext.tsx` | `POST /api/auth/sign-up/email` | Email registration |
| `AuthContext.tsx` | `GET /api/auth/get-session` | Session validation |
| `AuthContext.tsx` | `POST /api/pin-auth/login` | PIN-based login |
| `CampaignsScreen.tsx` | `GET /api/campaigns` | List campaigns |
| `CampaignsScreen.tsx` | `POST /api/campaigns` | Create campaign |
| `CampaignDetailScreen.tsx` | `GET /api/campaigns/:code/children` | List children in campaign |
| `CampaignDetailScreen.tsx` | `GET /api/campaigns/:code/stats` | Campaign statistics |
| `CampaignDetailScreen.tsx` | `GET /api/observations?campaign=X` | Observations for campaign |
| `RegisterChildScreen.tsx` | `POST /api/children` | Register child |
| `ModuleScreen.tsx` | `POST /api/observations` | Submit observation |
| `sync-engine.ts` | `POST /api/observations/sync` | Sync observations |
| `ayusync-listener.ts` | `GET /api/ayusync/report` | Poll AyuSync report |
| `vision-screening.ts` | `GET photoscreen-v1.onnx` (R2 CDN) | Download ONNX model |

---

## Action Items

1. **[CRITICAL]** Fix R2 bucket public access for `pub-skids-models` to enable Tier 2 AI screening
2. **[LOW]** `/api/sync/status` returns 404 — verify if this endpoint is still needed or has been removed
3. **[INFO]** Consider adding a `/api/health` response field for R2 CDN availability to surface model access issues early
