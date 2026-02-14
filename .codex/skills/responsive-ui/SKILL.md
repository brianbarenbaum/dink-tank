---
name: responsive-ui
description: Mobile-first responsive design strategy for Vue components.
version: 1.0.0
priority: high
triggers:
  - file_patterns: ["src/components/**/*.vue", "src/layouts/**/*.vue"]
  - keywords: ["mobile", "desktop", "responsive", "breakpoint", "layout"]
---

# Skill: Responsive UI Implementation

## Intent
Use this skill when designing or refactoring any component to ensure a seamless experience from mobile (320px) to desktop (1280px+).

## Procedure

1. **Mobile-First Foundation:**
   - Write base classes for mobile (default). 
   - **Do not** use `md:` or `lg:` for initial styling.
   - Example: Use `class="w-full flex-col"` instead of `class="w-1/2 flex-row"`.

2. **Progressive Enhancement:**
   - Use `md:` (768px) for tablets/small laptops.
   - Use `lg:` (1024px) or `xl:` (1280px) for high-resolution desktop layouts.
   - Example: `<div class="p-4 md:p-8 lg:p-12">`

3. **Flex/Grid Strategy:**
   - **Flex:** Use `flex-col` for mobile and `md:flex-row` for desktop.
   - **Grid:** Use `grid-cols-1` for mobile and `md:grid-cols-2` or `lg:grid-cols-4` for desktop.

4. **Interactive Element Sizing:**
   - Ensure touch targets are at least `h-11` (44px) or `h-12` (48px) for mobile.
   - Use responsive text sizing: `text-sm md:text-base`.

5. **Verification (Manual or via Playwright):**
   - Check the component at 375px (iPhone), 768px (iPad), and 1440px (Desktop).
