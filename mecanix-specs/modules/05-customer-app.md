# 5. Customer App

> **New Module:** The Customer App transforms vehicle owners from passive WhatsApp recipients into active participants in the repair process. It builds trust, reduces phone calls to the workshop, and creates a direct channel for repeat business.

## 5.1 Purpose & Value Proposition

**For customers:** Real-time transparency into what is happening with their vehicle, the ability to approve quotes digitally, pay invoices from their phone, and access their complete service history.

**For workshops:** Fewer phone calls asking for status updates, faster quote approvals (reducing vehicle dwell time), digital payment collection, and a direct marketing channel for service reminders and promotions.

## 5.2 Onboarding & Authentication

- Customer receives a WhatsApp message with a link to download the app when their first job card is created
- Registration via phone number (OTP verification via Supabase Auth) — no passwords
- Phone number auto-links to existing customer record in MECANIX via Supabase RLS
- Optional: add email for invoice delivery
- Multi-vehicle support under one account

## 5.3 Core Features

### 5.3.1 Live Job Tracking
- Real-time job card status with visual progress indicator (received → diagnosing → in progress → ready)
- Push notifications on every status change
- Estimated completion time (set by workshop, visible to customer)
- Photo updates from technician (before/after, progress photos)
- Direct message thread with workshop (in-app chat, backed by WhatsApp)

### 5.3.2 Digital Quote Approval
- When job status changes to "Awaiting Approval," customer receives a detailed quote breakdown in-app
- Quote shows: labour lines, parts lines (with descriptions), tax, and total
- One-tap approve or reject with optional comment
- For insurance jobs: customer sees their portion (excess/co-pay) vs insurer portion
- Approval triggers automatic status change to "In Progress" in workshop system
- Quote history preserved for disputes or reference

### 5.3.3 Invoice & Payment
- View invoice PDF directly in app
- Pay via integrated payment methods: M-Pesa (Mozambique), Multicaixa Express (Angola), PIX (Brazil)
- Payment confirmation sent to workshop in real time
- Payment history and receipts stored in app
- Partial payment support with outstanding balance display

### 5.3.4 Vehicle Service History
- Complete chronological history of all services per vehicle across all workshops using MECANIX
- Each entry shows: date, workshop name, work performed, parts used, cost, and mileage
- Downloadable service record PDF (useful for vehicle resale)
- Upcoming service reminders based on manufacturer intervals and mileage

### 5.3.5 Workshop Discovery & Ratings
- Find MECANIX-connected workshops nearby (map view)
- Filter by specialisation (e.g., diesel, electrical, bodywork)
- Rate and review workshops after service completion (1–5 stars + comment)
- Ratings visible to other customers (Phase 2: workshop can respond)

## 5.4 Technical Notes

- Built with React Native + Expo (shared component library with technician app)
- Authentication via Supabase Auth (phone OTP, no passwords)
- Real-time job status updates via Supabase Realtime (WebSocket streaming)
- Offline capability via PowerSync: cached service history and job status viewable offline
- Photos and documents served from Supabase Storage
- Lightweight: target app size under 25 MB for emerging market devices
- Works on Android 8+ and iOS 14+
- Push notifications via Firebase Cloud Messaging
- Deep links from WhatsApp messages open directly in app

## 5.5 Customer App Data Model

| Entity | Key Fields | Notes |
|--------|------------|-------|
| customer_app_users | id, customer_id, phone, otp_verified, device_token | Links to core customers table |
| app_sessions | id, user_id, device_info, last_active | Analytics and session management |
| quote_approvals | id, job_card_id, customer_id, status, responded_at, comment | Tracks approve/reject decisions |
| app_payments | id, invoice_id, method, amount, status, reference | Payment transactions from app |
| workshop_ratings | id, workshop_id, customer_id, job_card_id, rating, comment | Post-service ratings |
| chat_messages | id, job_card_id, sender_type, content, sent_at | In-app messaging thread |
