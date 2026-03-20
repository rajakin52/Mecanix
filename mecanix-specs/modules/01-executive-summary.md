# 1. Executive Summary

MECANIX is a cloud-based, mobile-first workshop management platform designed for independent automotive workshops and small workshop chains across Lusophone markets — Angola, Mozambique, and Brazil. Built on a modern SaaS architecture with offline-first capability, MECANIX addresses a significant gap in the market: workshops in these regions currently rely on paper-based job cards, WhatsApp messages, and disconnected spreadsheets to run their operations.

The platform unifies the core operational workflows of a workshop — vehicle intake, job card management, parts inventory, technician assignment, invoicing, and customer communication — into a single, affordable, easy-to-use system accessible from any device.

> **Strategic Vision:** MECANIX will be the first serious SaaS-native workshop management platform purpose-built for Lusophone Africa and Brazil. By combining deep local market knowledge, WhatsApp-native communication, offline-first architecture, and a pricing model accessible to independent workshops, MECANIX can capture significant market share in three of the world's most underpenetrated automotive software markets.

## 1.1 What's New in v2.0

This enhanced specification adds three major modules that extend MECANIX from a workshop-only tool into a full ecosystem connecting workshops, customers, and insurance companies:

- **Customer App** — A self-service mobile app giving vehicle owners real-time visibility into their repairs, digital approvals, payment, and full service history.
- **Technician Time Logging App** — A purpose-built mobile experience for mechanics to clock in/out, log time against jobs with one-tap controls, and track productivity.
- **Insurance Evaluation & Approvals System** — A dedicated portal and workflow for insurance companies to receive claims, review estimates, approve/reject repairs, and track repair progress through to completion.

## 1.2 Key Metrics

| Metric | Value |
|--------|-------|
| Target Markets | Angola, Mozambique, Brazil |
| Primary User | Workshop owner / service manager |
| Secondary Users | Mechanic, Customer (vehicle owner), Insurance assessor |
| Deployment Model | Multi-tenant SaaS (cloud + offline sync) |
| Tech Stack | React Native + Expo (mobile), Next.js (web), NestJS (API), Supabase (DB + auth + storage), PowerSync (offline sync) |
| MVP Timeline | 18–20 weeks |
| Initial Pricing | From $49/month (Angola/Mozambique), R$199/month (Brazil) |
