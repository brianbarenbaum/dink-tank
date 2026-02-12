# Design Parity Checklist

## Applies when
- Any visible UI change (layout, typography, spacing, colors, components)
- Updating screens that have matching designs in `designs/` (or equivalent)

## Priority
- Used as a review checklist; complements screenshot verification.

## Required actions
- Run through the checklist before calling UI work complete
- Explicitly note parity risks or deltas

Before finishing any screen, verify:
- Header icons present (e.g., settings gear)
- Input shape + background match design (rounded corners, bg tone)
- Cards have distinct background from screen
- Quote counts include icon + correct color
- Accent color consistency (links, icons, FAB)

If design has a floating button or nav bar, ensure those elements are fully visible
on both large web screens and mobile viewport sizes.
