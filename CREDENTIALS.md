# SKIDS Screen v3.3.0 — Test Credentials

## Organisation Code: `zpedi`

---

## Mobile App (PIN Login)

| Role | Name | Email | PIN | Notes |
|------|------|-------|-----|-------|
| **Admin** | Satish (Admin) | satish@skids.health | `1001` | Full access |
| **Admin** | Dev Admin | devadmin@skids.health | `1002` | Full access |
| **Admin** | FS Dev | fsdev@skids.health | `1009` | Full access |
| **Admin** | Admin (legacy) | admin@skids.clinic | `1000` | Full access |
| | | | | |
| **Ops Manager** | Ops Manager 1 | opsmgr1@skids.health | `2001` | Campaign management |
| **Ops Manager** | Ops Manager 2 | opsmgr2@skids.health | `2002` | Campaign management |
| **Ops Manager** | Ops Manager 3 | opsmgr3@skids.health | `2006` | Campaign management |
| **Ops Manager** | Ops (legacy) | ops@skids.clinic | `2000` | Campaign management |
| | | | | |
| **Nurse** | Sunita Devi | nurse@skids.clinic | `5678` | Field screening |
| **Nurse** | Nurse 1 | nurse1@skids.health | `3001` | Field screening |
| **Nurse** | Nurse 2 | nurse2@skids.health | `3002` | Field screening |
| **Nurse** | Nurse 3 | nurse3@skids.health | `3006` | Field screening |
| **Nurse** | Nurse 4 | nurse4@skids.health | `3004` | Field screening |
| **Nurse** | Nurse 5 | nurse5@skids.health | `3005` | Field screening |
| | | | | |
| **Doctor** | Doctor 1 | doctor1@skids.health | `4001` | Review & annotate |
| **Doctor** | Doctor 2 | doctor2@skids.health | `4006` | Review & annotate |
| **Doctor** | Doctor 3 | doctor3@skids.health | `4003` | Review & annotate |
| **Doctor** | Doctor 4 | doctor4@skids.health | `4004` | Review & annotate |
| **Doctor** | Doctor 5 | doctor5@skids.health | `4005` | Review & annotate |
| **Doctor** | Doctor (legacy) | doctor@skids.clinic | `4000` | Review & annotate |
| | | | | |
| **Authority** | Authority 1 | auth1@skids.health | `5001` | Read-only reports |
| **Authority** | Authority 2 | auth2@skids.health | `5002` | Read-only reports |
| **Authority** | Authority (legacy) | authority@skids.clinic | `5000` | Read-only reports |

### How to login on mobile:
1. Open the SKIDS Screen app
2. Enter Org Code: **zpedi**
3. Tap **Connect**
4. Enter the 4-digit PIN from the table above

---

## Ops Portal (Email + Password Login)

**URL:** https://skids-ops.pages.dev

All `@skids.health` accounts use the same password: **`Skids@2026`**

| Role | Email | Password |
|------|-------|----------|
| Admin | satish@skids.health | Skids@2026 |
| Admin | devadmin@skids.health | Skids@2026 |
| Ops Manager | opsmgr1@skids.health | Skids@2026 |
| Doctor | doctor1@skids.health | Skids@2026 |
| Authority | auth1@skids.health | Skids@2026 |

### What each role sees on the Ops Portal:
- **Admin** — Full dashboard, campaigns, users, settings, analytics
- **Ops Manager** — Campaigns, assignments, field coordination
- **Doctor** — Doctor Inbox, observation review, clinical annotations
- **Authority** — Read-only analytics and population health reports

---

## PIN Pattern (Easy to Remember)

| Role | PIN Range | Pattern |
|------|-----------|---------|
| Admin | 1000–1009 | Starts with **1** |
| Ops Manager | 2000–2009 | Starts with **2** |
| Nurse | 3001–3006, 5678 | Starts with **3** (except Sunita = 5678) |
| Doctor | 4000–4006 | Starts with **4** |
| Authority | 5000–5002 | Starts with **5** |

---

## Rate Limiting
- PIN login: **5 attempts per 5 minutes** per IP address
- If locked out, wait 5 minutes and try again

---

## APK Download
- **Direct (no login):** https://skids-api.satish-9f4.workers.dev/api/r2/apk
- **From Ops Portal:** Click "Download APK" in sidebar
- **File size:** ~108 MB
