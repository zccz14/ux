# @zccz14/ux

`@zccz14/ux` provides the shared `AppLayout` shell for the NTNL app family (Cybion, NormAI, CTX, Linkit, Midas, HIT, 1Exchange, DeepSeek-LB, OpenAI-LB). One implementation of the sidebar, the AppHeader, and the Linkit account control keeps the interaction identical across apps and replaces the per-app copies of that chrome.

## What the shell owns

- **Sidebar** — one animated icon-collapse sidebar: 16rem expanded, 3rem collapsed, 200 ms width transition. Midas, 1Exchange and 1earn-style shells without animation are replaced by this behavior.
- **Navigation groups only** — the sidebar has no separate bottom section. Settings and status destinations live in the navigation groups like every other destination, so the bottom edge of every app's sidebar looks the same.
- **AppHeader** — sidebar trigger, current page title, your `headerSlot`, and the Linkit account control (`LinkitMyInfo`), in that order. Role badges such as 超级管理员 stay out of the shell: administrator affordances live in the administrator navigation group and pages.
- **Logo** — you pass the light and dark logo marks; the shell renders the active variant inside a fixed 1.75rem box and controls the display size itself, so the logo size is identical everywhere. The title beside the logo disappears while collapsed.
- **Linkit integration** — the signed-in viewer's `resolvedTheme` picks the logo variant, the viewer's language selects the shell copy (中文/English), and theme, language and account controls all live in the `LinkitMyInfo` dialog.

## Installation

```sh
npm install @zccz14/ux
```

Peer dependencies: `react` (18 or 19), `react-dom`, `react-router-dom` 7, `@base-ui/react` ≥ 1.6, `linkit-react-components` ≥ 0.5.1 (older versions do not publish `resolvedTheme`).

## Usage

```tsx
import { AuthMiniProvider } from "auth-mini-react-components";
import { LinkitProvider } from "linkit-react-components";
import { AppLayout } from "@zccz14/ux";
import { MessagesSquareIcon, ServerIcon } from "lucide-react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import "@zccz14/ux/styles.css";
import "linkit-react-components/styles.css";
import { CybionMark } from "./cybion-mark";

export function App() {
  return (
    <AuthMiniProvider
      authMiniBaseUrl="https://auth.ntnl.io"
      audiences={["cybion.ntnl.io", "linkit.ntnl.io"]}
      autoRedirectToLogin
    >
      <LinkitProvider linkitBaseUrl="https://linkit.ntnl.io" lang="zh-CN">
        <HashRouter>
          <AppLayout
            logo={{ light: <CybionMark />, dark: <CybionMark /> }}
            title="Cybion"
            nav={[
              {
                label: "工作台",
                items: [
                  { to: "/threads", label: "对话", icon: <MessagesSquareIcon /> },
                  { to: "/system", label: "系统资源", icon: <ServerIcon /> },
                ],
              },
            ]}
            headerSlot={<RefreshButton />}
          >
            <Routes>
              <Route path="/threads" element={<ThreadsPage />} />
              <Route path="*" element={<Navigate replace to="/threads" />} />
            </Routes>
          </AppLayout>
        </HashRouter>
      </LinkitProvider>
    </AuthMiniProvider>
  );
}
```

`AppLayout` must render below `AuthMiniProvider → LinkitProvider` (it renders `LinkitMyInfo` and reads `useLinkit()`), and inside a router (navigation items render router links).

## API

### `AppLayout` props

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `logo` | `{ light: ReactNode; dark: ReactNode }` | yes | The two logo variants. The shell renders the one that matches `useLinkit().resolvedTheme` at its own fixed size. |
| `title` | `string` | yes | App name beside the logo. Hidden while the sidebar is collapsed. |
| `nav` | `AppNavGroup[]` | yes | Navigation groups rendered in the sidebar. |
| `headerSlot` | `ReactNode` | no | Rendered immediately left of `LinkitMyInfo` in the AppHeader. Use it for page-level actions such as refresh. |
| `pageTitle` | `ReactNode` | no | Overrides the page title derived from the active navigation item. Use it for detail routes with their own title. |
| `children` | `ReactNode` | yes | Page content, rendered in the scrollable main region. |

### Navigation types

```ts
type AppNavItem = { to: string; label: string; icon: ReactNode };
type AppNavGroup = { label: string; items: AppNavItem[] };
```

`to` is a router path. Each item renders a `NavLink`, so active items receive `aria-current="page"` and the standard active styling. Route matching uses longest-prefix wins, and `/` matches only exactly.

## Behavior

- **Page title** — the AppHeader shows the active navigation item's `label`, matched from `location.pathname`. `pageTitle` wins when supplied.
- **Collapse** — the header trigger or `⌘B` / `Ctrl+B` toggles the sidebar; the choice persists in the `sidebar_state` cookie.
- **Mobile** — below 768px the sidebar becomes a modal navigation drawer: the trigger opens it, tapping a link or the backdrop closes it.
- **Collapsed tooltips** — icon-only items reveal their label in a tooltip on hover and focus.
- **Reduced motion** — `prefers-reduced-motion: reduce` disables the animations.
- **Layout contract** — the shell is viewport-locked (`100svh`); the main region is the page's only scroll container and applies the standard `1rem` / `1.5rem` padding. Pages own their inner layout.

## Styling

Import `@zccz14/ux/styles.css` once. It consumes the app's shadcn theme tokens with built-in fallbacks: `--background`, `--foreground`, `--border`, `--accent`, `--muted`, `--ring`, `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`.

## Migrating an app from its local shell

1. Replace the local `SidebarProvider` / `Sidebar` / `AppHeader` copy with one `AppLayout` at the top of `App.tsx`.
2. Move legacy header buttons (refresh, settings, language, theme) into `headerSlot`. Role badges are dropped: administrator affordances belong to the administrator navigation group and pages, and theme/language preferences live in the `LinkitMyInfo` profile dialog (`linkit-react-components` 0.5+).
3. Move any sidebar footer item (settings, environment status) into the last navigation group.
4. Pass the logo pair and delete per-call sizes; the shell normalizes every mark to its 1.75rem box.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
npm run pack:check
```
