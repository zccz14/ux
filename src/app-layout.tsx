import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { LinkitMyInfo, useLinkit } from "linkit-react-components";
import { NavLink, useLocation } from "react-router-dom";

import { copyForLang, type AppLayoutCopy } from "./copy.js";
import { CloseIcon, PanelLeftIcon } from "./icons.js";
import type { AppLayoutProps, AppLogo, AppNavGroup, AppNavItem } from "./types.js";

const sidebarCookieName = "sidebar_state";
const sidebarCookieMaxAge = 60 * 60 * 24 * 7;
const mobileMediaQuery = "(max-width: 767px)";

function readSidebarCookie(): boolean {
  const entry = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${sidebarCookieName}=`));
  if (!entry) {
    return true;
  }
  return entry.slice(sidebarCookieName.length + 1) !== "false";
}

function writeSidebarCookie(open: boolean) {
  document.cookie = `${sidebarCookieName}=${open}; path=/; max-age=${sidebarCookieMaxAge}`;
}

function subscribeToMobile(onChange: () => void) {
  const query = window.matchMedia(mobileMediaQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeToMobile,
    () => window.matchMedia(mobileMediaQuery).matches,
    () => false,
  );
}

function useSidebarState() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(readSidebarCookie);
  const [openMobile, setOpenMobile] = useState(false);

  const setOpenPersisted = useCallback((value: boolean) => {
    setOpen(value);
    writeSidebarCookie(value);
  }, []);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile((value) => !value);
      return;
    }
    setOpenPersisted(!open);
  }, [isMobile, open, setOpenPersisted]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  return { isMobile, open, openMobile, setOpenMobile, toggleSidebar };
}

function matchActiveItem(nav: AppNavGroup[], pathname: string): AppNavItem | undefined {
  let active: AppNavItem | undefined;
  for (const group of nav) {
    for (const item of group.items) {
      const matches =
        item.to === "/"
          ? pathname === "/"
          : pathname === item.to || pathname.startsWith(`${item.to}/`);
      if (matches && (!active || item.to.length > active.to.length)) {
        active = item;
      }
    }
  }
  return active;
}

function SidebarNavItem({
  collapsed,
  item,
  onNavigate,
}: {
  collapsed: boolean;
  item: AppNavItem;
  onNavigate?: (() => void) | undefined;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger
        render={
          <NavLink
            className="ux-nav-item"
            end={item.to === "/"}
            onClick={onNavigate}
            to={item.to}
          />
        }
      >
        <span className="ux-nav-item__icon">{item.icon}</span>
        <span className="ux-nav-item__text">{item.label}</span>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner
          className="ux-tooltip-positioner"
          side="right"
          sideOffset={6}
        >
          <TooltipPrimitive.Popup className="ux-tooltip" hidden={!collapsed}>
            {item.label}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

function SidebarBody({
  copy,
  logo,
  nav,
  onNavigate,
  state,
  title,
}: {
  copy: AppLayoutCopy;
  logo: AppLogo;
  nav: AppNavGroup[];
  onNavigate?: (() => void) | undefined;
  state: "expanded" | "collapsed";
  title: string;
}) {
  const { resolvedTheme } = useLinkit();
  return (
    <>
      <div className="ux-sidebar__header">
        <span className="ux-sidebar__logo">
          {resolvedTheme === "dark" ? logo.dark : logo.light}
        </span>
        <span className="ux-sidebar__title">{title}</span>
      </div>
      <nav aria-label={copy.navigation} className="ux-sidebar__nav">
        {nav.map((group) => (
          <div className="ux-nav-group" key={group.label}>
            <div className="ux-nav-group__label">{group.label}</div>
            {group.items.map((item) => (
              <SidebarNavItem
                collapsed={state === "collapsed"}
                item={item}
                key={item.to}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}

export function AppLayout({
  children,
  headerSlot,
  logo,
  nav,
  pageTitle,
  title,
}: AppLayoutProps) {
  const { pathname } = useLocation();
  const { lang } = useLinkit();
  const copy = copyForLang(lang);
  const sidebar = useSidebarState();
  const resolvedTitle = pageTitle ?? matchActiveItem(nav, pathname)?.label;

  return (
    <TooltipPrimitive.Provider delay={0}>
      <div
        className="ux-app-layout"
        data-state={sidebar.open ? "expanded" : "collapsed"}
      >
        <aside className="ux-sidebar">
          <SidebarBody
            copy={copy}
            logo={logo}
            nav={nav}
            state={sidebar.open ? "expanded" : "collapsed"}
            title={title}
          />
        </aside>
        {sidebar.isMobile ? (
          <DialogPrimitive.Root
            open={sidebar.openMobile}
            onOpenChange={sidebar.setOpenMobile}
          >
            <DialogPrimitive.Portal>
              <DialogPrimitive.Backdrop className="ux-drawer-backdrop" />
              <DialogPrimitive.Popup className="ux-drawer">
                <DialogPrimitive.Title className="ux-visually-hidden">
                  {copy.navigation}
                </DialogPrimitive.Title>
                <button
                  aria-label={copy.closeNavigation}
                  className="ux-drawer__close"
                  type="button"
                  onClick={() => sidebar.setOpenMobile(false)}
                >
                  <CloseIcon />
                </button>
                <SidebarBody
                  copy={copy}
                  logo={logo}
                  nav={nav}
                  onNavigate={() => sidebar.setOpenMobile(false)}
                  state="expanded"
                  title={title}
                />
              </DialogPrimitive.Popup>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        ) : null}
        <div className="ux-shell">
          <header className="ux-app-header">
            <button
              aria-expanded={sidebar.isMobile ? sidebar.openMobile : sidebar.open}
              aria-label={copy.toggleSidebar}
              className="ux-app-header__trigger"
              type="button"
              onClick={sidebar.toggleSidebar}
            >
              <PanelLeftIcon />
            </button>
            <span aria-hidden="true" className="ux-app-header__separator" />
            <p className="ux-app-header__title">{resolvedTitle}</p>
            <div className="ux-app-header__slot">{headerSlot}</div>
            <LinkitMyInfo />
          </header>
          <main className="ux-main">{children}</main>
        </div>
      </div>
    </TooltipPrimitive.Provider>
  );
}
