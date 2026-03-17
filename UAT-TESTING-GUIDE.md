# SKIDS Screen v3.3.0 — Testing Guide for Ops Team

**Date:** 17 March 2026
**Version:** 3.3.0
**For:** Clinical ops team (non-technical)

---

## PART A: Download & Install the Mobile App (APK)

### Step 1 — Download the APK

**Option 1: From the Ops Portal (recommended)**
1. Open Chrome on your laptop: **https://skids-ops.pages.dev**
2. Log in with your admin credentials
3. In the left sidebar, scroll down to **"SKIDS Ecosystem"**
4. Click **"Download APK"**
5. The file `SKIDS-Screen-3.3.0.apk` (108 MB) will download

**Option 2: Direct from Desktop**
- If Satish shared the APK file directly, it will be called `SKIDS-Screen-v3.3.0-debug.apk`

### Step 2 — Transfer APK to Android Phone/Tablet

1. Connect your Android device to laptop via USB cable
2. Copy the `.apk` file to the **Downloads** folder on the phone
3. Or share via **Google Drive / WhatsApp / Bluetooth**

### Step 3 — Install on Android Device

1. Open **Files** app on Android → go to **Downloads**
2. Tap the `.apk` file
3. If prompted "Install from unknown sources" → tap **Settings** → enable **Allow from this source** → go back → tap **Install**
4. Wait for installation to complete → tap **Open**

> **Note:** This is a debug build for testing. You may see a "Google Play Protect" warning — tap **"Install anyway"**

### Step 4 — Log In

1. **Organisation Code:** `zpedi`
2. **Select your name** from the staff list
3. **Enter PIN:**
   - Nurse (Sunita Devi): `5678`
   - Admin: `1234`

---

## PART B: Testing the Mobile Screening App

### Test 1 — Home Screen & Navigation

| Check | Expected | Pass? |
|-------|----------|-------|
| Home screen loads after login | Shows child list, campaign name, stats cards | |
| Bottom tabs work | Home, Screening, Profile, Settings all open | |
| Child list shows enrolled children | Names, ages, screening status visible | |

### Test 2 — Select a Child & Start Screening

1. Tap a child from the Home screen
2. You should see the **Child Profile** with name, age, photo
3. Tap **"Start Screening"** or go to **Screening** tab
4. You should see **22 screening modules** listed with icons

| Check | Expected | Pass? |
|-------|----------|-------|
| Module list shows all modules | 22 modules with colored icons | |
| Search bar works | Type "hearing" → filters to Hearing module | |
| Tap any module | Opens the screening form | |

### Test 3 — Hearing Screening (NEW — Picture-Based)

This is the new gamified hearing test for children:

1. Go to **Screening** → search **"Hearing"** → tap it
2. You should see:
   - "Picture-based audiometry" description
   - Screening Guide (equipment, tips)
   - **Contextual checkboxes**: hearing difficulty, teacher concern, parent concern, ear infections, hearing aid
3. Check any relevant boxes (this is nurse input — no AI)
4. Tap **"Start Sound Game"**
5. You should see **6 animal/object characters**: Cow, Drum, Bell, Dog, Bird, Bee
6. Tap **"Let's Practice!"** → Demo round plays
7. A **Play Sound** button appears → tap it → 2x2 picture cards appear
8. Child taps the matching picture (or "Nothing heard")
9. After practice, tap **"Start Test"** → Full 12-trial test (6 frequencies x 2 ears)
10. After completion, results show as **Clinical Finding chips** (Hearing normal / Mild loss / etc.)

| Check | Expected | Pass? |
|-------|----------|-------|
| Hearing module opens | Shows picture audiometry description | |
| Contextual checkboxes render | Teacher, parent, ear infection, hearing aid | |
| Start Sound Game opens game | 6 animal characters visible | |
| Practice round works | Play Sound → cards appear → can tap | |
| Real test runs | 12 trials, progress bar, star rewards | |
| Can stop test early | "Stop Test" link works | |
| Clinical chips appear | Hearing normal / loss chips selectable | |

### Test 4 — Vision Screening

1. Go to **Screening** → search **"Vision"**
2. Open the module → check contextual info
3. Camera should open for photo capture
4. Take a photo → quality check runs
5. Select clinical findings chips
6. Save

| Check | Expected | Pass? |
|-------|----------|-------|
| Camera opens | Photo capture screen appears | |
| Photo captured | Image shows in form | |
| Clinical chips selectable | Vision normal / abnormal chips | |

### Test 5 — Any Other Module (Dental, Skin, BMI, etc.)

Pick 3-4 more modules and verify:

| Check | Expected | Pass? |
|-------|----------|-------|
| Module opens without crash | Form loads, no blank screen | |
| Can fill contextual checkboxes | Checkboxes are tappable | |
| Camera/media works (if needed) | Can take photo/video | |
| Clinical finding chips load | Can select findings | |
| Can **skip** a module | Back button works, no crash | |
| Observation notes field works | Can type free text | |

### Test 6 — Save & Sync

After completing a few modules:

1. Tap **Save** at the bottom of any screening form
2. Check that data saves locally (no crash, shows "Saved" confirmation)
3. If internet is available, data should sync to server

| Check | Expected | Pass? |
|-------|----------|-------|
| Save button works | Shows success message | |
| Saved data persists | Go back and reopen — data still there | |
| Sync works (if online) | Observation appears on ops portal | |

### Test 7 — Manual Override / Skip

**Important:** Every module can be skipped or done manually.

1. Open any module
2. **Without** using camera or AI, just select clinical finding chips manually
3. Add observation notes
4. Save

| Check | Expected | Pass? |
|-------|----------|-------|
| Can save without photo/AI | Manual chip selection saves | |
| App doesn't crash on skip | Navigate away mid-screening — no crash | |
| Can go back and continue | Resume where you left off | |

---

## PART C: Testing the Ops Web Portal

Open **https://skids-ops.pages.dev** in Chrome.

### Test 8 — Dashboard

| Check | Expected | Pass? |
|-------|----------|-------|
| Dashboard loads | Campaign stats cards visible | |
| Total/Active campaigns correct | Numbers match your campaigns | |
| Children Enrolled count correct | Total across campaigns | |
| Recent Campaigns list shows | Campaign names with status | |

### Test 9 — Campaign Management

1. Click **Campaigns** in sidebar
2. Open a campaign (e.g., "Chakradharpur School Health Screening")
3. Check child list, screening progress

| Check | Expected | Pass? |
|-------|----------|-------|
| Campaign detail opens | Shows children list | |
| Child screening status visible | Completed/Pending/In-progress | |
| Can create new campaign | "+ New Campaign" button works | |

### Test 10 — Doctor Inbox

1. Click **Doctor Inbox** in sidebar
2. Observations from nurses should appear here for doctor review

| Check | Expected | Pass? |
|-------|----------|-------|
| Doctor Inbox loads | Shows pending observations | |
| Can open an observation | Details visible with findings | |

### Test 11 — Download APK (verify the flow)

1. Click **Download APK** in sidebar
2. APK should download (108 MB)
3. Verify file name is `SKIDS-Screen-3.3.0.apk`

---

## Bug Reporting

If something doesn't work:

1. **Screenshot** the issue
2. Note which **module** and **step** it happened
3. Note if the **app crashed** or just showed wrong data
4. Send to the dev team on Teams/WhatsApp with:
   - Device model (e.g., Samsung Galaxy A52)
   - What you were doing
   - Screenshot

---

## Quick Reference

| Item | Value |
|------|-------|
| Ops Portal | https://skids-ops.pages.dev |
| API Server | https://skids-api.satish-9f4.workers.dev |
| Org Code | `zpedi` |
| Nurse PIN (Sunita Devi) | `5678` |
| Admin PIN | `1234` |
| APK Version | 3.3.0 |
| APK Size | ~108 MB |
