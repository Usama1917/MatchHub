---
name: Dark theme setup
description: How dark mode is applied in the matchhub frontend
---

Dark mode is opt-in class-based. The `index.html` `<html>` tag must have `class="dark"` for dark mode to activate:

```html
<html lang="en" class="dark">
```

The CSS custom variant is: `@custom-variant dark (&:is(.dark *))` — this means dark styles apply when an ancestor has the `dark` class. Default dark colors: background `220 20% 8%`, foreground `210 40% 98%`, primary green `142 71% 45%`.

**Why:** Without `class="dark"` on `<html>`, all dark: CSS utility classes are ignored and the app shows in light mode even though dark CSS variables are defined.

The `LanguageContext` controls RTL/LTR by setting `document.documentElement.dir` and `document.documentElement.lang`.
