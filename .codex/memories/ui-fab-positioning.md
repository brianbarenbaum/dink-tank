# Overlay & FAB Placement

- Overlay UI (FAB, toasts, modals) must be anchored to the viewport, not the scrollable content.
- Use a full-screen overlay container with `pointerEvents="box-none"` and place the FAB inside it.
- On web, overlay container must be `position: fixed` to avoid off-screen placement on large layouts.

✅ Example
```tsx
<Box
  style={{
    position: Platform.OS === "web" ? "fixed" : "absolute",
    top: 0, right: 0, bottom: 0, left: 0,
  }}
  pointerEvents="box-none"
>
  <FloatingActionButton />
</Box>
```

❌ Anti‑pattern
```tsx
// FAB placed at bottom of a scroll container => can go off-screen
<Box>
  <FloatingActionButton />
</Box>
```
