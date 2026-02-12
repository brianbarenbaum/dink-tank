# Expo / React Native / Gluestack Conventions

## Applies when
- Changing `app/**`, `components/**`
- Touching navigation (expo-router), theming, Gluestack usage, NativeWind, layout, animations
- Adding new screens or shared UI patterns

## Priority
- This file is part of `.codex/memories` and is project law.
- More specific UI memories (layout, wrapper, contrast, parity, screenshots) override this when relevant.

## Required actions
- Use Gluestack components where appropriate (consult Gluestack MCP for patterns)
- Follow existing formatting/tooling and repo conventions
- Apply error-handling and validation expectations as described

## Your expertise
- You are an expert in TypeScript, React Native, Expo, and Mobile UI development.

## Rules Precedence

1. System/developer instructions
2. Superpowers skills (workflow/process)
3. Project memories in `.codex/memories`

## Code Style and Structure

- Write concise, technical TypeScript code with accurate examples.
- Use functional and declarative programming patterns; avoid classes.
- Prefer iteration and modularization over code duplication.
- Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError).
- Structure files: exported component, subcomponents, helpers, static content, types.
- Follow Expo's official documentation for setting up and configuring your projects: https://docs.expo.dev/

## Naming Conventions

- Use lowercase with dashes for directories (e.g., components/auth-wizard).
- Favor named exports for components.

## TypeScript Usage

- Use TypeScript for all code; prefer interfaces over types.
- Avoid enums; use maps instead.
- Use functional components with TypeScript interfaces.
- Use strict mode in TypeScript for better type safety.

## Syntax and Formatting

- Use the "function" keyword for pure functions.
- Follow Biome defaults for control-flow statements (including block statements in conditionals).
- Use declarative JSX.
- Use Biome formatting/linting commands from `package.json` (`npm run format`, `npm run lint`).

## UI and Styling

- Use Gluestack components where possible and utilize the Gluestack MCP.
- Implement responsive design with Flexbox and Expo's useWindowDimensions for screen size adjustments.
- Use Tailwind CSS with NativeWind for component styling (and Gluestack where applicable).
- Implement dark mode support using the dark: className support with nativewind as documented at https://gluestack.io/ui/docs/home/theme-configuration/dark-mode.
- Ensure high accessibility (a11y) standards using ARIA roles and native accessibility props.
- Leverage react-native-reanimated for performant animations when needed.

## Performance Optimization

- Minimize the use of useState and useEffect; prefer context and reducers for state management.
- Use Expo's SplashScreen for optimized app startup experience.
- Optimize images: use WebP format where supported, include size data, implement lazy loading with expo-image.
- Implement code splitting and lazy loading for non-critical components with React's Suspense and dynamic imports.
- Profile and monitor performance using React Native's built-in tools and Expo's debugging features.
- Avoid unnecessary re-renders by memoizing components and using useMemo and useCallback hooks appropriately.

## Navigation

- Use expo-router for routing and navigation; follow its best practices for stack, tab, and drawer navigators.
- Leverage deep linking and universal links for better user engagement and navigation flow.
- Use dynamic routes with expo-router for better navigation handling.

## State Management

- Use React Context and useReducer for managing global state.
- For app-wide state (e.g. a global list or user context), provide it via a React context whose provider wraps the root layout content (e.g. in `app/_layout.tsx` wrap `<Slot />` with the provider). This keeps all screens and nested navigators inside the same provider without prop drilling. Example: `app/_layout.tsx` with `BooksProvider`.
- If we adopt server state caching, prefer `@tanstack/react-query`.
- For complex state management, consider using Zustand (only if introduced).
- Handle URL search parameters using libraries like expo-linking.

## Error Handling and Validation

- Prioritize error handling and edge cases:
  - Handle errors at the beginning of functions.
  - Use early returns for error conditions to avoid deeply nested if statements.
  - Avoid unnecessary else statements; use if-return pattern instead.
  - Implement global error boundaries to catch and handle unexpected errors.
- Use a production error reporting solution only if introduced in dependencies.

## Security

- Sanitize user inputs to prevent XSS attacks.
- Use `expo-secure-store` for secure storage of sensitive data in this repository.
- Ensure secure communication with APIs using HTTPS and proper authentication.
- Use Expo's Security guidelines to protect your app: https://docs.expo.dev/guides/security/

## Key Conventions

1. Rely on Expo's managed workflow for streamlined development and deployment.
2. Prioritize Mobile Web Vitals (Load Time, Jank, and Responsiveness).
3. Use expo-constants for managing environment variables and configuration.
4. Use Expo's permissions APIs when handling device permissions.
5. Implement expo-updates for over-the-air (OTA) updates.
6. Follow Expo's best practices for app deployment and publishing: https://docs.expo.dev/distribution/introduction/
7. Ensure compatibility with iOS and Android by testing extensively on both platforms.

## API Documentation

- Use Expo's official documentation for setting up and configuring your projects: https://docs.expo.dev/
- Refer to Expo's documentation for detailed information on Views, Blueprints, and Extensions for best practices.
