# Text Contrast & Input Visibility

## Applies when
- Changing colors, theming, dark mode behavior
- Adding/modifying form fields, buttons, touch targets, interactive components

## Priority
- Overrides general UI guidance in `expo.md` for a11y/contrast/input rules.

## Required actions
- Ensure contrast and accessibility expectations are met
- Validate input UX (focus, error states, disabled states)

- All text inputs on dark backgrounds must set:
  - `placeholderTextColor` (light gray)
  - input text `style.color` (near white)
- Never rely on defaults for text color on dark surfaces.

✅ Example
```tsx
<InputField
  placeholder="Search..."
  placeholderTextColor="#94a3b8"
  style={{ color: "#f1f5f9" }}
/>
```

✅ Also validate that typed text is visible in screenshots.
