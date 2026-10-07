import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppLayout } from "../src/app-layout.js";
import type { AppLayoutProps, AppNavGroup } from "../src/types.js";

const linkitState = vi.hoisted(() => ({ lang: "zh-CN", resolvedTheme: "light" }));

vi.mock("linkit-react-components", () => ({
  LinkitMyInfo: () => <div data-testid="linkit-my-info" />,
  useLinkit: () => ({
    lang: linkitState.lang,
    resolvedTheme: linkitState.resolvedTheme,
  }),
}));

const nav: AppNavGroup[] = [
  {
    label: "工作台",
    items: [
      { to: "/", label: "概览", icon: <span data-testid="icon-overview" /> },
      { to: "/threads", label: "对话", icon: <span data-testid="icon-threads" /> },
    ],
  },
  {
    label: "系统",
    items: [
      { to: "/admin/users", label: "用户", icon: <span data-testid="icon-users" /> },
    ],
  },
];

function renderLayout(
  overrides: Partial<AppLayoutProps> = {},
  initialEntries: string[] = ["/threads"],
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppLayout
        logo={{
          light: <span data-testid="logo-light" />,
          dark: <span data-testid="logo-dark" />,
        }}
        nav={nav}
        title="Cybion"
        {...overrides}
      >
        <p>page content</p>
      </AppLayout>
    </MemoryRouter>,
  );
}

function layoutRoot(): HTMLElement {
  const element = document.querySelector(".ux-app-layout");
  if (!element) {
    throw new Error("missing .ux-app-layout root");
  }
  return element as HTMLElement;
}

function headerTitle(): HTMLElement {
  const element = document.querySelector(".ux-app-header__title");
  if (!element) {
    throw new Error("missing .ux-app-header__title");
  }
  return element as HTMLElement;
}

beforeEach(() => {
  linkitState.lang = "zh-CN";
  linkitState.resolvedTheme = "light";
  globalThis.__uxMobileViewport = false;
  document.cookie = "sidebar_state=; path=/; max-age=0";
});

afterEach(cleanup);

describe("AppLayout", () => {
  it("renders the fixed-size logo pair and picks the variant from the resolved theme", () => {
    const light = renderLayout();
    expect(light.container.querySelector(".ux-sidebar__logo")).toContainElement(
      screen.getByTestId("logo-light"),
    );
    expect(screen.queryByTestId("logo-dark")).toBeNull();

    cleanup();
    linkitState.resolvedTheme = "dark";
    const dark = renderLayout();
    expect(dark.container.querySelector(".ux-sidebar__logo")).toContainElement(
      screen.getByTestId("logo-dark"),
    );
    expect(screen.queryByTestId("logo-light")).toBeNull();
  });

  it("renders grouped navigation and marks the active item", () => {
    renderLayout({}, ["/threads"]);
    expect(screen.getByText("工作台")).toBeInTheDocument();
    expect(screen.getByText("系统")).toBeInTheDocument();

    const threads = screen.getByRole("link", { name: "对话" });
    expect(threads).toHaveAttribute("href", "/threads");
    expect(threads).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "概览" })).not.toHaveAttribute("aria-current");
  });

  it("matches nested routes to their navigation group and root to its own item", () => {
    cleanup();
    renderLayout({}, ["/admin/users/7"]);
    expect(screen.getByRole("link", { name: "用户" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    cleanup();
    renderLayout({}, ["/"]);
    expect(screen.getByRole("link", { name: "概览" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "对话" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("derives the header title from the active navigation item and accepts an override", () => {
    renderLayout({}, ["/threads/42"]);
    expect(headerTitle()).toHaveTextContent("对话");

    cleanup();
    renderLayout({ pageTitle: "自定义页" }, ["/threads/42"]);
    expect(headerTitle()).toHaveTextContent("自定义页");
  });

  it("renders the header slot immediately left of LinkitMyInfo", () => {
    renderLayout({ headerSlot: <button data-testid="slot">操作</button> });
    const slot = screen.getByTestId("slot");
    const info = screen.getByTestId("linkit-my-info");
    expect(slot.compareDocumentPosition(info) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("collapses the sidebar on demand and persists the choice in the cookie", () => {
    renderLayout();
    const root = layoutRoot();
    expect(root).toHaveAttribute("data-state", "expanded");

    const trigger = screen.getByRole("button", { name: "切换侧边栏" });
    fireEvent.click(trigger);
    expect(root).toHaveAttribute("data-state", "collapsed");
    expect(document.cookie).toContain("sidebar_state=false");

    fireEvent.click(trigger);
    expect(root).toHaveAttribute("data-state", "expanded");
    expect(document.cookie).toContain("sidebar_state=true");
  });

  it("restores the collapsed sidebar from the cookie", () => {
    document.cookie = "sidebar_state=false; path=/";
    renderLayout();
    expect(layoutRoot()).toHaveAttribute("data-state", "collapsed");
  });

  it("toggles the sidebar with the Ctrl+B keyboard shortcut", () => {
    renderLayout();
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(layoutRoot()).toHaveAttribute("data-state", "collapsed");
  });

  it("localizes chrome labels through the Linkit language", () => {
    linkitState.lang = "en";
    renderLayout();
    expect(
      screen.getByRole("button", { name: "Toggle sidebar" }),
    ).toBeInTheDocument();
  });

  it("opens the navigation drawer instead of collapsing on small screens", () => {
    globalThis.__uxMobileViewport = true;
    renderLayout();
    const root = layoutRoot();

    fireEvent.click(screen.getByRole("button", { name: "切换侧边栏" }));
    expect(root).toHaveAttribute("data-state", "expanded");

    const drawer = screen.getByRole("dialog");
    const threads = within(drawer).getByRole("link", { name: "对话" });
    expect(threads).toHaveAttribute("href", "/threads");
  });
});
