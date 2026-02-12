# Screen Wrapper Required

## Applies when
- Creating or modifying app screens/routes
- Touching `app/**` screens or navigation wrappers
- Anything affecting safe-area/background/consistent padding

## Priority
- Overrides general UI guidance in `expo.md` for screen shell decisions.

See `expo.md` for overall rules precedence and project-wide conventions.

- All screens under `app/` must render inside `components/Screen`.
- Do not use `SafeAreaView` directly in screen files.
- `Screen` handles safe-area edges and the app background.
- Bottom safe-area padding is handled by UI elements (e.g. `BottomNavBar`), not screen containers.

✅ Example
```tsx
import { Screen } from "../components/Screen";

export default function SomeScreen(): React.ReactElement {
  return (
    <Screen>
      {/* screen content */}
    </Screen>
  );
}
```
