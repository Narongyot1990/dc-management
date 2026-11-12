# FLS theme — Yard Check Summary

Applied to `/yardcheck/summary` with the FLS Transport logo and the phone-inventory visual style: slate background, white surfaces, blue primary actions, soft borders and Arial/Tahoma typography. Header branding is conditional on this route; other application pages retain their existing header.

The toolbar combines type/count toggles, search, Copy Yard Update, Update, Create, IN/OUT and the inspection/range filter. It uses three rows on mobile and one row on desktop. Type selection remains multi-select. The Create action replaces the floating button so it does not cover records. Status breakdown counts remain available in the inspection selector.

Empty containers use blue identity accents, laden containers green and chassis teal. Inspection status is separate: passed green, failed red, pending amber. Previously the pending row used the same red styling as failure; the new styling distinguishes these without changing status calculations. Identifiers wrap on small screens. Forms use FLS blue actions/focus and named Close buttons with touch-friendly hit areas.

No API, database model, clipboard report calculation, inspection eligibility, IN/OUT eligibility, time range or write behavior was changed. IN retains its existing "needs action" behavior, including departed empty containers that still need inspection. Copy Yard Update continues to count only records physically in the yard. Create's Cancel still resets the form; Close exits the modal.

## Review

Screenshots contain synthetic QA records, not customer data.

- [Mobile](review/fls-yard-mobile.png)
- [Desktop](review/fls-yard-desktop.png)
- [Thai mobile](review/fls-yard-thai-mobile.png)
- [Create modal](review/fls-yard-create-mobile.png)

Local preview: http://localhost:3001/yardcheck/summary

## Validation

- TypeScript and production build passed.
- Changed-file ESLint: no errors; one pre-existing warning for checklist reference `<img>`.
- Full repository lint still reports 5 pre-existing errors outside the changed files: import-guide link, ConnectionStatus effect state, mongodb const declaration and seed-script require usage.
- Browser review passed at widths 320, 390, 768 and 1366 px, with no horizontal page/record overflow and compact toolbar height checks.
- English, Thai, Chinese and Myanmar rendering checked.
- Verified type toggles, pending distinction, search, OUT time range, physical-IN-only clipboard report, Create/Update dialogs and cancellation of Mark OUT.
- All API traffic intercepted; non-GET requests blocked. Observed database-write requests: 0; browser runtime errors: 0.

This review covers local validation; deployment status must be checked separately. The supplied FLS image was reused from the sibling phone-asset-mgr project; dependencies were unchanged.
