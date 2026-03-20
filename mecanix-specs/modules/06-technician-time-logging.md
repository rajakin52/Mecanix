# 6. Technician Time Logging App

> **New Module:** Purpose-built for mechanics who need a fast, gloves-friendly interface to clock time against jobs. Accurate time logging drives correct labour billing, productivity insights, and fair performance-based pay.

## 6.1 Purpose & Value Proposition

**For technicians:** A simple, one-tap interface to start/stop work on jobs without navigating complex menus. See their daily schedule, flag issues, and track their own performance.

**For workshop owners:** Accurate labour costing per job, real-time visibility into who is working on what, productivity analytics, and data to support fair performance-based compensation.

## 6.2 User Experience Design

### 6.2.1 Design Principles
- Large touch targets (minimum 48dp) — usable with greasy or gloved hands
- Maximum 2 taps to start/stop a timer
- High-contrast colour scheme for outdoor and bright workshop environments
- Minimal text input — prefer taps, toggles, and voice notes
- Always-visible current timer with elapsed time

### 6.2.2 Home Screen
The technician home screen shows:
- Active timer banner (if running) with job reference, vehicle plate, and elapsed time
- Today's assigned jobs as large cards, sorted by priority
- Each card shows: vehicle plate, make/model, reported problem (first line), and estimated time
- Quick-action buttons: Start Work, Pause, Flag Issue, Mark Complete
- Bottom tab navigation: My Jobs, Timer Log, Notifications, Profile

## 6.3 Core Features

### 6.3.1 Time Tracking
- One-tap start/stop timer per job
- Only one timer can be active at a time (starting a new one pauses the current)
- Pause/resume support (e.g., lunch break, waiting for parts)
- Manual time entry for corrections (requires manager approval)
- Automatic pause after 30 minutes of inactivity (configurable)
- End-of-day reminder if timer is still running at configurable time
- Offline time tracking — logs stored in local SQLite via PowerSync and synced to Supabase when online

### 6.3.2 Clock In / Clock Out
- Daily clock-in when technician opens the app or taps attendance button
- Clock-out at end of day
- Total hours worked vs total hours logged to jobs (utilisation rate)
- Optional: geofence-based auto clock-in when arriving at workshop (Phase 2)

### 6.3.3 Job Interaction
- View full job details: reported problem, customer notes, previous work on this vehicle
- Add technician notes (text or voice note)
- Attach photos (progress, issue documentation)
- Flag: "Parts Needed" (triggers notification to Parts Manager)
- Flag: "Blocked" with reason (triggers notification to Manager)
- Mark job as "Work Complete" (moves to Quality Check status)

### 6.3.4 Productivity Dashboard (Technician View)
- Today: hours logged, jobs worked on, jobs completed
- This week: total hours, utilisation rate, average time per job
- Personal trend: weekly hours over last 8 weeks (simple chart)
- Peer comparison: optional anonymised ranking (configurable by workshop owner)

## 6.4 Manager Views (Workshop Management App)

### 6.4.1 Live Floor View
- Real-time board showing each technician, their current job, and elapsed time
- Visual indicators: green (working), yellow (paused), red (idle for >15 min), grey (clocked out)
- Bay assignment view: which technician is in which bay

### 6.4.2 Time Reports

| Report | Description | Access |
|--------|-------------|--------|
| Daily Timesheet | Per-technician breakdown of hours by job | Manager / Owner |
| Utilisation Report | Logged hours vs clocked hours per technician | Owner |
| Job Costing Accuracy | Estimated vs actual hours per job type | Owner |
| Overtime Report | Hours exceeding daily/weekly thresholds | Owner |
| Idle Time Analysis | Unlogged time during clocked-in periods | Manager / Owner |

## 6.5 Time Logging Data Model

| Entity | Key Fields | Notes |
|--------|------------|-------|
| time_entries | id, technician_id, job_card_id, started_at, paused_at, ended_at, duration_minutes | Core time log |
| clock_records | id, technician_id, clock_in, clock_out, total_hours | Daily attendance |
| time_corrections | id, time_entry_id, original_duration, corrected_duration, reason, approved_by | Manual corrections |
| productivity_snapshots | id, technician_id, date, hours_logged, jobs_completed, utilisation_pct | Daily rollup for reporting |
