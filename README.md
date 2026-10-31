# @zccz14/ux

`@zccz14/ux` provides the shared app shell and the shared Markdown renderer for the NTNL app family (Cybion, NormAI, CTX, Linkit, Midas, HIT, 1Exchange, DeepSeek-LB, OpenAI-LB). One implementation of the sidebar, the AppHeader and the Linkit account control keeps the interaction identical across apps; one implementation of `<Markdown>` keeps rendered content — replies, checkpoints, manuals, documents, articles — identical too. Both replace the per-app copies they supersede.

## What the shell owns

- **Sidebar** — one animated icon-collapse sidebar: 16rem expanded, 3rem collapsed, 200 ms width transition. Midas, 1Exchange and 1earn-style shells without animation are replaced by this behavior.
- **Navigation groups only** — the sidebar has no separate bottom section. Settings and status destinations live in the navigation groups like every other destination, so the bottom edge of every app's sidebar looks the same.
- **AppHeader** — sidebar trigger, current page title, your `headerSlot`, and the Linkit account control (`LinkitMyInfo`), in that order. Role badges such as 超级管理员 stay out of the shell: administrator affordances live in the administrator navigation group and pages.
- **Favicon** — the same mark becomes the page favicon: the shell serialises the rendered logo into `link[rel="icon"]`, pins the colour the mark currently shows (a favicon has no app stylesheet, so `currentColor` would otherwise fall back to black), and re-renders it whenever the theme changes. Pass `favicon={false}` to keep an app-owned icon.
- **Logo** — you pass one mark; the shell renders it inside a fixed 1.75rem box and controls the display size itself, so the logo size is identical everywhere. Pass a mark that follows the current colour (an icon using `currentColor`, or an SVG with mode-aware fills) so it keeps working in both themes. The title beside the logo disappears while collapsed.
- **Linkit integration** — the viewer's language selects the shell copy (中文/English), and theme, language and account controls all live in the `LinkitMyInfo` dialog. The shell never reads the theme itself: it renders whatever colour scheme its own CSS resolves (see [Styling](#styling)).

## Installation

```sh
npm install @zccz14/ux
```

Peer dependencies: `react` (18 or 19), `react-dom`, `react-router-dom` 7, `@base-ui/react` ≥ 1.6, `linkit-react-components` ≥ 0.6.

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
            logo={<CybionMark />}
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
| `logo` | `ReactNode` | yes | The logo mark. The shell renders it at its own fixed 1.75rem size and mirrors it into the page favicon; pass a mark that follows the current colour. |
| `favicon` | `boolean` | no | Defaults to `true`: the logo mark is written to `link[rel="icon"]` and re-rendered on theme changes. Set `false` to leave the app's own icon alone. |
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
- **Favicon** — an `<svg>` logo is serialised to a `data:image/svg+xml` icon with its rendered colour pinned; an `<img>` logo reuses the image URL. The icon is rewritten when `.dark` flips, when `prefers-color-scheme` changes, and when the mark itself is swapped.
- **Layout contract** — the shell is viewport-locked (`100svh`); the main region is the page's only scroll container and applies the standard `1rem` / `1.5rem` padding. Pages own their inner layout.

## Markdown

`<Markdown content={...} />` is the single renderer for every piece of Markdown in the family.

```tsx
import { Markdown } from "@zccz14/ux";

<Markdown content={reply} />;
```

One prop, on purpose. There is no `math`, `mermaid`, `components`, `remarkPlugins` or `urlTransform` switch: a surface either renders Markdown the family way, or it renders through something else. Every capability below is always on, because the point of the component is that a reply in Cybion, a checkpoint, a manual preview and a CTX article look the same.

### What it renders

- **GitHub Flavored Markdown** — tables, task lists, strikethrough, autolinks.
- **Math through KaTeX** — `$E=mc^2# @zccz14/ux

`@zccz14/ux` provides the shared app shell and the shared Markdown renderer for the NTNL app family (Cybion, NormAI, CTX, Linkit, Midas, HIT, 1Exchange, DeepSeek-LB, OpenAI-LB). One implementation of the sidebar, the AppHeader and the Linkit account control keeps the interaction identical across apps; one implementation of `<Markdown>` keeps rendered content — replies, checkpoints, manuals, documents, articles — identical too. Both replace the per-app copies they supersede.

## What the shell owns

- **Sidebar** — one animated icon-collapse sidebar: 16rem expanded, 3rem collapsed, 200 ms width transition. Midas, 1Exchange and 1earn-style shells without animation are replaced by this behavior.
- **Navigation groups only** — the sidebar has no separate bottom section. Settings and status destinations live in the navigation groups like every other destination, so the bottom edge of every app's sidebar looks the same.
- **AppHeader** — sidebar trigger, current page title, your `headerSlot`, and the Linkit account control (`LinkitMyInfo`), in that order. Role badges such as 超级管理员 stay out of the shell: administrator affordances live in the administrator navigation group and pages.
- **Favicon** — the same mark becomes the page favicon: the shell serialises the rendered logo into `link[rel="icon"]`, pins the colour the mark currently shows (a favicon has no app stylesheet, so `currentColor` would otherwise fall back to black), and re-renders it whenever the theme changes. Pass `favicon={false}` to keep an app-owned icon.
- **Logo** — you pass one mark; the shell renders it inside a fixed 1.75rem box and controls the display size itself, so the logo size is identical everywhere. Pass a mark that follows the current colour (an icon using `currentColor`, or an SVG with mode-aware fills) so it keeps working in both themes. The title beside the logo disappears while collapsed.
- **Linkit integration** — the viewer's language selects the shell copy (中文/English), and theme, language and account controls all live in the `LinkitMyInfo` dialog. The shell never reads the theme itself: it renders whatever colour scheme its own CSS resolves (see [Styling](#styling)).

## Installation

```sh
npm install @zccz14/ux
```

Peer dependencies: `react` (18 or 19), `react-dom`, `react-router-dom` 7, `@base-ui/react` ≥ 1.6, `linkit-react-components` ≥ 0.6.

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
            logo={<CybionMark />}
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
| `logo` | `ReactNode` | yes | The logo mark. The shell renders it at its own fixed 1.75rem size and mirrors it into the page favicon; pass a mark that follows the current colour. |
| `favicon` | `boolean` | no | Defaults to `true`: the logo mark is written to `link[rel="icon"]` and re-rendered on theme changes. Set `false` to leave the app's own icon alone. |
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
- **Favicon** — an `<svg>` logo is serialised to a `data:image/svg+xml` icon with its rendered colour pinned; an `<img>` logo reuses the image URL. The icon is rewritten when `.dark` flips, when `prefers-color-scheme` changes, and when the mark itself is swapped.
- **Layout contract** — the shell is viewport-locked (`100svh`); the main region is the page's only scroll container and applies the standard `1rem` / `1.5rem` padding. Pages own their inner layout.

## Markdown

`<Markdown content={...} />` is the single renderer for every piece of Markdown in the family.

```tsx
import { Markdown } from "@zccz14/ux";

<Markdown content={reply} />;
```

One prop, on purpose. There is no `math`, `mermaid`, `components`, `remarkPlugins` or `urlTransform` switch: a surface either renders Markdown the family way, or it renders through something else. Every capability below is always on, because the point of the component is that a reply in Cybion, a checkpoint, a manual preview and a CTX article look the same.

### What it renders

- **GitHub Flavored Markdown** — tables, task lists, strikethrough, autolinks.
, `$…$`, `\(…\)`, `\[…\]` and `math`-tagged code fences, because models emit all of them. The stylesheet and fonts are imported by the component itself, so a formula is never unstyled; the runtime (~76 KB gzipped) is fetched only by a surface whose content can actually contain a formula, and stays cached for the rest of the session. Until that chunk arrives — and always when rendering on a server — a formula shows as the source it was written as, the same state a still-streaming formula is in. Broken math degrades to one `.katex-error` span carrying the parser message.
- **Mermaid diagrams** — a `mermaid`-tagged fence becomes an SVG, loaded on demand: a surface without a diagram never downloads mermaid. The chart follows the current theme and the surrounding text size, and re-renders when `.dark` flips. An unparseable diagram falls back to its own source block.
- **Links** — absolute URLs open in a new tab with `rel="noopener noreferrer"` and an external marker; in-page anchors and relative paths stay in the app. Only `http(s)` and `mailto` survive: `javascript:`, `data:` and friends degrade to plain text. A link keeps the text colour and carries its weight in the underline: Markdown is quoted content, so it never introduces an accent of its own.
- **Tables and code** — a wide table or a long code block scrolls inside its own box, so the transcript or article around it never grows a horizontal scrollbar.
- **Raw HTML** — never rendered. The pipeline has no `rehype-raw`, so HTML in the source is shown as text.

### Typography is owned here

The component wraps its content in `.ux-markdown`, and that block is the family's typographic contract: every size is expressed in `em` off the inherited font size, and no measure is imposed. The same content therefore keeps identical proportions in a 14px chat bubble and a 16px article page. The host decides two things and only two — the font size of the container the content is dropped into, and the width of that container. Do not wrap the component in `prose` classes: the stylesheet is the single source of the look, and `scripts/check-styles.mjs` enforces it.

### Why the pipeline is a runtime dependency

`react-markdown`, `remark-gfm`, `remark-math-extended`, `rehype-katex`, `katex` and `mermaid` are `dependencies`, not peers, so an app wires nothing. An app that never renders Markdown tree-shakes the whole chain away, and two pieces are deliberately kept out of the main bundle even for apps that do: Mermaid (loaded by the first diagram, so a surface without one never downloads it) and the math runtime (KaTeX's ~76 KB gzipped JavaScript, loaded by the first surface whose content may contain a formula). What stays static is KaTeX's stylesheet — about 3.6 KB gzipped, with fonts the browser only fetches once a formula is on screen — because a formula must never render unstyled. `scripts/check-package.mjs` fails the build if the manifest ever claims `sideEffects: false`, which would let a bundler drop that stylesheet and render every formula as bare LaTeX with no error to notice.

## Migrating an app from its local Markdown renderer

1. Delete the app's own renderer — the `react-markdown` wrapper, its plugin wiring, its `components` map, its `Mermaid`/`MarkdownPre` pair, and any `mermaid`/`rehype-katex`/`remark-*`/`katex` dependency entries that only served it.
2. Replace each call site with `<Markdown content={markdown} />` and drop the surrounding `prose …` classes: the typography lives in `.ux-markdown`, and the container only owes the content a font size and a width.
3. Keep app-specific node mapping out of the way — if a surface really needs different output (inline mention tokens, a clamped preview), it belongs in the library, not in a local fork of the plugin chain.
4. Keep the KaTeX stylesheet import out of the app: the component owns it.

## Styling

Import `@zccz14/ux/styles.css` once. It consumes the app's shadcn theme tokens and falls back to its own values, so the shell stays readable even when a token is missing: `--background`, `--foreground`, `--border`, `--accent`, `--muted`, `--ring`, `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`. The Markdown layer reads `--muted`, `--muted-foreground` and `--destructive` through the same `--ux-*` layer (`--ux-muted`, `--ux-muted-foreground`, `--ux-destructive`).

Those tokens are read through a `--ux-*` layer declared twice — a light set on `:root` and a dark set on `.dark` — so every fallback has a dark counterpart. A missing `--sidebar` therefore renders dark in dark mode instead of a light sidebar. The shell also sets `color-scheme` per mode, so native scrollbars and controls follow the theme without help from a theme provider.

Theme state itself is not the shell's business: whatever toggles `.dark` on `<html>` (in this family, `LinkitProvider`) decides the mode, and the shell follows.

## Migrating an app from its local shell

1. Replace the local `SidebarProvider` / `Sidebar` / `AppHeader` copy with one `AppLayout` at the top of `App.tsx`.
2. Move legacy header buttons (refresh, settings, language, theme) into `headerSlot`. Role badges are dropped: administrator affordances belong to the administrator navigation group and pages, and theme/language preferences live in the `LinkitMyInfo` profile dialog (`linkit-react-components` 0.6+).
3. Move any sidebar footer item (settings, environment status) into the last navigation group.
4. Pass the single logo mark and delete per-call sizes; the shell normalizes every mark to its 1.75rem box.
5. Delete the app's own `applyFavicon` / favicon effect: the shell now owns `link[rel="icon"]`. Keep a hand-written favicon only by passing `favicon={false}`.

## Development

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
pnpm run pack:check
```
