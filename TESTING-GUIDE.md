# SKIDS Screen v3.3.0 — Testing Guide for Ops & Clinical Team

## 1. Download & Install the App

### Option A: From Ops Portal (Recommended)
1. Open **https://skids-ops.pages.dev** on your laptop/desktop
2. Sign in with your admin credentials
3. Click **"Download APK"** in the left sidebar under SKIDS ECOSYSTEM
4. Transfer the downloaded APK to your Android phone (via WhatsApp, email, Google Drive, or USB cable)
5. On your phone, tap the APK file and allow "Install from unknown sources" when prompted

### Option B: Direct Link (No Login Needed)
1. Open this link on your Android phone's browser:
   **https://skids-api.satish-9f4.workers.dev/api/r2/apk**
2. The APK will download automatically
3. Tap the downloaded file to install

### Option C: From Desktop File
If someone shared the APK file (`SKIDS-Screen-3.3.0.apk`), simply transfer it to your phone and install.

> **Note:** You may need to enable "Install from unknown sources" in your phone's Settings > Security.

---

## 2. First-Time Login

1. Open the **SKIDS Screen** app
2. Enter Organisation Code: `zpedi`
3. Tap **Connect**
4. Enter your PIN:
   - Nurse PIN: `5678` (Sunita Devi)
   - Admin PIN: `1234`
5. You should see the **Home Screen** with campaign info and child count

---

## 3. Testing the Screening App (Mobile)

### 3.1 Home Screen
- [ ] Campaign name and child count are visible
- [ ] Bottom navigation works: Home, Screening, Profile, Settings

### 3.2 Child List & Selection
- [ ] Tap **Screening** tab at the bottom
- [ ] Children list loads with names, age, gender
- [ ] Tap a child to open their screening modules

### 3.3 Module Search Bar
- [ ] On the screening modules page, a **search bar** appears at the top
- [ ] Type "hear" — only Hearing module should show
- [ ] Type "vis" — only Vision module should show
- [ ] Clear search — all modules return

### 3.4 Hearing Screening (New — Picture Audiometry)
- [ ] Tap **Hearing Screening** module
- [ ] See description: "Picture-based audiometry — child taps matching image"
- [ ] Scroll down past the Screening Guide
- [ ] See **Contextual Information** checkboxes (hearing difficulty, teacher concern, parent concern, ear infections, hearing aid)
- [ ] Check/uncheck boxes — they toggle correctly
- [ ] See **"Start Sound Game"** blue button
- [ ] Tap it — see 6 animal characters (Cow, Drum, Bell, Dog, Bird, Bee)
- [ ] Tap **"Let's Practice!"** — demo round starts
- [ ] Tap **Play Sound** — 2x2 image cards appear (e.g., Cow, Nothing, Bee, Bell)
- [ ] Tap a card — it highlights, stars awarded, moves to next trial
- [ ] After 2 demo rounds — **"Start Test!"** button appears
- [ ] Real test: 12 rounds (6 frequencies x 2 ears), Left Ear then Right Ear
- [ ] **Stop Test** works at any point
- [ ] Clinical Findings chips: Hearing normal, Mild/Moderate/Severe loss, Unilateral loss

### 3.5 Vision Screening
- [ ] Tap **Vision Screening** module
- [ ] Camera opens for photo capture
- [ ] Can take a photo of the child's eye
- [ ] Clinical findings chips are selectable

### 3.6 Other Modules (General Flow)
For each screening module (Dental, Skin, BMI, Vitals, etc.):
- [ ] Module loads without crashing
- [ ] Form fields and checkboxes work
- [ ] Clinical finding chips can be selected/deselected
- [ ] Observation notes can be typed
- [ ] **Skip** — every module can be skipped without completing

### 3.7 Save & Sync
- [ ] After selecting clinical findings, tap **Save**
- [ ] Observation appears in the child's observation list
- [ ] Status shows correctly (Pending/Submitted based on role)
- [ ] If online, data syncs to server automatically

### 3.8 Manual Override / Skip
- [ ] Any module can be exited without saving (press Back)
- [ ] The app should NOT crash if you skip or cancel any module
- [ ] If AI/camera fails, you can still manually select findings and save

---

## 4. Testing the Ops Portal (Web)

Open **https://skids-ops.pages.dev** in Chrome/Edge on your laptop.

### 4.1 Dashboard
- [ ] Login works with admin credentials
- [ ] Dashboard shows campaign stats: Total Campaigns, Active, Children Enrolled
- [ ] Recent Campaigns list with status badges (Active/Completed)

### 4.2 Campaigns
- [ ] Click **Campaigns** in sidebar
- [ ] Campaign list loads
- [ ] Click a campaign — see children list
- [ ] Child count matches what you see on mobile

### 4.3 Doctor Inbox
- [ ] Click **Doctor Inbox** in sidebar
- [ ] Submitted observations appear for doctor review
- [ ] Can view screening results, clinical findings, and media

### 4.4 Download APK
- [ ] Click **Download APK** in sidebar
- [ ] APK downloads successfully (108 MB file)
- [ ] File name: `SKIDS-Screen-3.3.0.apk`

---

## 5. Known Limitations

1. **Sound on emulator**: Audio tones may not play on Android emulators (works on real devices)
2. **Camera**: Requires a real device — emulators have a simulated camera
3. **Offline mode**: Data saves locally first, syncs when online
4. **APK size**: ~108 MB due to AI/ML model bundled for on-device screening

---

## 6. Reporting Issues

If something doesn't work:
1. Note which screen you were on
2. What you tapped/did
3. What happened vs what you expected
4. Take a screenshot if possible
5. Share on the team WhatsApp group or email to the dev team

---

**Version**: 3.3.0 | **Date**: March 17, 2026 | **Branch**: feature/clinical-research-platform
