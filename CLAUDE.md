# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Next.js with Webpack)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

No test framework is configured — there are no test files in the project.

## Environment Variables

Copy `.env.example` to `.env.local` and populate:

```
MONGODB_URI                    # MongoDB Atlas connection string
GEMINI_API_KEY                 # Google Gemini API (used for document OCR)
NEXT_PUBLIC_BASE_URL           # App base URL
PUSHER_APP_ID                  # Pusher real-time events
NEXT_PUBLIC_PUSHER_KEY
PUSHER_SECRET
NEXT_PUBLIC_PUSHER_CLUSTER
ORS_API_KEY                    # OpenRouteService for map directions
```

## Architecture

**Tech stack:** Next.js 16 App Router · React 19 · TypeScript · MongoDB/Mongoose · Tailwind CSS v4 · Pusher (real-time) · Google Gemini AI (vision) · React Leaflet (maps)

### Application Flow

The app is a bilingual (Thai/English) delivery order management system for a distribution center. Role selection (Leader/Driver) on the homepage is stored in `localStorage` via `RoleContext` — there is no authentication.

**Two main user flows:**
1. **Scan flow** (`/scan`) — Camera captures a delivery order document image → POST to `/api/scan` → Gemini 2.5 Flash extracts structured data → user reviews in `DOForm` → saved to MongoDB. Duplicate check via `/api/delivery-orders/check-dc`.
2. **Shipment booking flow** (`/driver`, `/shipment`) — Driver views draft `ShipmentBooking` records for today, updates timestamps (loading start/end, arrival/departure/return), matches a scanned DO to a booking, then fulfills it.

**Leader monitoring** (`/monitor`) — views all delivery orders with filtering (date range, branch, status, search), edits records, monitors shipment bookings.

### Real-time Sync

`usePusher` hook subscribes to Pusher channels `delivery-orders` and `shipment-bookings`. Events (`created`, `updated`, `deleted`) trigger data refreshes across all connected clients. The server triggers events inside API route handlers via `lib/pusher.ts`.

### Key Data Patterns

- Dates are stored as strings in `DD/MM/YYYY` format (Thai convention), times as `HH:MM`.
- `DeliveryOrder` has indexes on `dc_number`, `delivery_date`, `status`, `destination_branch`, `driver_name`, `truck_plate_head`, `trip_no`.
- MongoDB connection is managed via a cached promise in `lib/mongodb.ts` (standard Next.js pattern to avoid connection churn in serverless).
- Central TypeScript types are in `types/index.ts`.

### Translations

All UI strings go through `LanguageContext`. Translation files are at `locales/th.json` (Thai) and `locales/en.json` (English). Always add keys to both files when adding new UI text.

### Path Alias

`@/*` maps to the project root (configured in `tsconfig.json`). Use `@/components/...`, `@/lib/...`, `@/types/...`, etc.
