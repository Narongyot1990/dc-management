# Dock Management System - AI Context Guide

## Tech Stack
- **Next.js 16.1.1** (App Router, Turbopack) + **React 19** + **TypeScript 5**
- **Tailwind CSS v4** (`@theme inline`, postcss)
- **MongoDB** + **Mongoose 9.1.2** ODM
- **Pusher** (real-time events) + client polling fallback
- **Lucide React** (icons), **Google Generative AI** (OCR)
- i18n: custom `useLanguage()` hook with 4 locales (th/en/cn/mm)

## Project Structure

```
app/
  page.tsx                      # Homepage - role selection
  layout.tsx                    # Root layout + providers + Header
  globals.css                   # Tailwind v4 @theme inline + CSS vars
  planner/
    page.tsx                    # Job creation (IN/OUT/SWAP) ~930 lines
    dashboard/page.tsx          # Planner dashboard (wraps JobDashboard)
  driver/
    page.tsx                    # Pending jobs + complete/report ~330 lines
    dashboard/page.tsx          # Driver dashboard (wraps JobDashboard)
  bookingmanagement/
    page.tsx                    # Booking CRUD + OCR scan ~800 lines
  containercheck/
    page.tsx                    # Container check form ~500 lines
    summary/page.tsx            # Summary list with filters ~500 lines
  yardcheck/
    page.tsx                    # Yard check form: type select (empty/laden/chassis) + 5-item checklist for empty
    summary/page.tsx            # In Yard / Out Today split summary with stat cards
  guides/
    import/page.tsx             # Import driver guide (7 steps)
  api/
    jobs/route.ts               # GET (filter) + POST (create job)
    jobs/[id]/route.ts          # GET + PUT + DELETE single job
    jobs/count/route.ts         # Job count stats
    jobs/check-dock/route.ts    # Dock occupancy check
    bookings/route.ts           # GET + POST bookings
    bookings/[id]/route.ts      # GET + PUT + DELETE single booking
    container-check/route.ts    # GET + POST + PUT + DELETE checks
    yard-check/route.ts         # GET + POST (always new) + PUT (checklist/mark OUT) + DELETE
    booking-scan/route.ts       # QR scan → booking data
    ocr/route.ts                # Image → text (Google AI)

components/
  shared/
    Header.tsx                  # Nav bar with role links + language switcher
    LanguageSwitcher.tsx        # TH/EN/CN/MM selector
    IssueReportModal.tsx        # Shared issue report (driver + dashboard)
  dashboard/
    JobDashboard.tsx            # Reusable job dashboard (date/shift filter, stats, list)
  scanner/
    ContainerScanner.tsx        # Camera-based QR/barcode scanner
  providers/
    AppProviders.tsx            # LanguageProvider + ConnectionStatus wrapper
  ui/
    index.ts                    # Barrel: SearchInput, DateRangePicker, StatusFilterPills, BottomSheet, EmptyState, Badge, Button, Modal, LoadingSpinner
    SearchInput.tsx             # Props: value, onChange, placeholder?, ringColor?
    DateRangePicker.tsx         # Props: startDate, endDate, onStartDateChange, onEndDateChange, onReset
    StatusFilterPills.tsx       # Props: pills (StatusPill[]), activeKey, onSelect
    BottomSheet.tsx             # Props: isOpen, onClose, title? (ReactNode), subtitle?, children, cancelLabel?
    EmptyState.tsx              # Props: message, icon?
    Badge.tsx, Button.tsx, Modal.tsx, LoadingSpinner.tsx
  ConnectionStatus.tsx          # Online/offline indicator

hooks/
  index.ts                      # Barrel: useBookings, useJobs, useDockOccupancy, useContainerChecks
  useJobs.ts                    # Jobs data + polling + newJobIds + onNewJobs callback
  useBookings.ts                # Bookings data management
  useContainerChecks.ts         # CC data + visibility refetch + markDeparted + deleteCheck
  useYardChecks.ts              # Yard check data + visibility refetch + markOut + updateChecklist + deleteCheck
  useDockOccupancy.ts           # Dock status tracking
  usePusher.ts                  # useJobEvents, useBookingEvents, useDockEvents
  useOffline.ts                 # PWA offline detection

contexts/
  LanguageContext.tsx            # useLanguage() → { t, language, setLanguage }

lib/
  mongodb.ts                    # Connection singleton with caching
  pusher.ts                     # triggerJobEvent(), triggerBookingEvent(), triggerDockEvent()
  api/
    client.ts                   # Typed API client (get/post/put/patch/delete)
    bookings.ts                 # Booking API wrappers
    jobs.ts                     # Jobs API wrappers
  models/
    Job.ts                      # IJob + Mongoose schema
    Booking.ts                  # IBooking + Mongoose schema
    ContainerCheck.ts           # IContainerCheck + schema (history[], remark)
    YardCheck.ts                # IYardCheck + schema (type, yard_status, inspection_status, checklist[])
    Dock.ts                     # DockInfo interface
    User.ts                     # User interface

utils/
  constants.ts                  # DOCKS (D-01~D-25,F2), CC_VENDORS, POLLING_INTERVALS, STATUS_COLORS, VENDOR_COLORS, CC_STATUS_COLORS, YARD_NAME, YARD_SIZES, YARD_CHECKLIST, YARD_TYPE_COLORS, YARD_STATUS_COLORS, YARD_INSPECTION_COLORS, API_ENDPOINTS, DEFAULTS
  format.ts                     # getBangkokDateString, formatDateTimeTH, formatDateTimeFullTH, formatTimeTH, calculateDuration, getRelativeTime(date,compact?), formatDateTime, formatDate, formatTime
  styles.ts                     # getVendorColor, getCCStatusColor, getYardTypeColor, getYardStatusColor, getYardInspectionColor, getBookingStatusColor, getJobStatusColor, cn(), getButtonClasses, getInputClasses
  stats.ts                      # countByStatus<T>(items, statusKeys)
  index.ts                      # Barrel export

types/
  index.ts                      # All TS interfaces: Job, Booking, ContainerCheck, YardCheck, DockInfo, User, form data types, ApiResponse<T>, status unions

config/
  app.config.ts                 # enableOfflineMode flag

locales/
  th.json, en.json, cn.json, mm.json   # ~260 keys each

public/
  manifest.json, sw.js, offline.html    # PWA assets
  images/guides/                        # Guide page images
  images/yardcheck/                     # Empty-container checklist reference illustrations (item1-5.png)
  icons/                                # App icons
```

## Data Models (Key Fields)

### Job
`id` (auto J001...) | `type` (in/out/swap) | `container_no` | `dock_from?` | `dock_to?` | `driver_id?` | `status` (pending/completed/issue) | `purpose?` (for_loading/for_unloading) | `completion_status?` | `remark?` | `issue_type?` | `issue_detail?` | `created_at` | `completed_at?`

### Booking
`id` | `booking_no` | `container_no` | `seal_no` | `vendor_name` | `truck_plate` | `arrival_at?` | `job_id?` | `status` (pending/in_progress/completed/incomplete)

### ContainerCheck
`id` | `container_no` | `vendor` (FLS/TMC/NNR/U-Globe/Other) | `location` (yard/dock) | `dock_no?` | `status` (pending/loading/loaded/departed) | `checked_at` | `remark?` | `history[]` ({action, at, changes?})

### YardCheck
`id` (auto YC001...) | `type` (empty/laden/chassis) | `container_no?` (empty/laden) | `size?` (20GP/40GP/40HC, empty/laden) | `chassis_plate` | `seal_no?` (laden) | `yard` (default YZZ) | `yard_status` (in/out) | `inspection_status?` (pending/passed, empty only) | `checklist?[]` ({item: 1-5, result: pass/fail/null}) | `ng_detail?` | `checked_at` | `remark?` | `history[]`. Every yard visit always creates a **new** record (no upsert) — lookup for "continue checklist" matches `container_no` (empty/laden) or `chassis_plate` (chassis) among records still `yard_status: 'in'`. The 5-item empty-container checklist (light test, rust-through, floor, stains/foreign objects, exterior+container no.) follows `FLS-TRN-WI-CII-001`; `inspection_status` auto-flips to `passed` only when all 5 items are `pass`.

## Conventions

### Timezone
All dates use **Bangkok timezone** (`Asia/Bangkok`). Use `getBangkokDateString()` for date strings. Display dates with `th-TH` locale format functions.

### i18n
All user-facing text uses `t('key')` from `useLanguage()`. Keys are in `locales/*.json`. Add keys to ALL 4 locale files when adding new features.

### Styling
- Use CSS variables: `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`, `var(--border)`, `var(--background)`
- Use shared components: `SearchInput`, `DateRangePicker`, `StatusFilterPills`, `BottomSheet`, `IssueReportModal`
- Use utility functions: `getVendorColor()`, `getCCStatusColor()`, `countByStatus()`
- Input style: `border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2`

### API Pattern
```ts
// Route handler pattern
export async function GET(req: NextRequest) {
  await connectToDatabase();
  // ... query with Mongoose
  return NextResponse.json({ success: true, data: results });
}
```

### Real-Time Events
Pusher channels: `jobs`, `bookings`, `docks`. After API mutations, call `triggerJobEvent()` / `triggerBookingEvent()` / `triggerDockEvent()` from `lib/pusher.ts`.

### Page Layout Pattern
```tsx
<div className="flex flex-col overflow-hidden bg-background h-[calc(100vh-80px)]">
  <div className="shrink-0 bg-white border-b border-border">
    {/* Header + Filters */}
  </div>
  <div className="flex-1 overflow-hidden min-h-0">
    {/* Scrollable content */}
  </div>
</div>
```

### Barrel Exports
- `components/ui/index.ts` - all UI components
- `hooks/index.ts` - all custom hooks
- `utils/index.ts` - all utility functions

## Environment Variables
```
MONGODB_URI=mongodb+srv://...
PUSHER_APP_ID=
NEXT_PUBLIC_PUSHER_KEY=
PUSHER_SECRET=
NEXT_PUBLIC_PUSHER_CLUSTER=ap1
```

## Docks
26 docks: D-01 through D-25 + F2. Defined in `utils/constants.ts` as `DOCKS` array.

## Defaults
- `DEFAULTS.PLANNER_ID = 'planner_01'`
- `DEFAULTS.DRIVER_ID = 'driver_01'`

## Path Naming
Guide pages go under `/guides/{topic}` (e.g., `/guides/import`). More guide pages will be added in the future.
