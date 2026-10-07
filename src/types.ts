import type { ReactNode } from "react";

export type AppLogo = {
  light: ReactNode;
  dark: ReactNode;
};

export type AppNavItem = {
  to: string;
  label: string;
  icon: ReactNode;
};

export type AppNavGroup = {
  label: string;
  items: AppNavItem[];
};

export type AppLayoutProps = {
  logo: AppLogo;
  title: string;
  nav: AppNavGroup[];
  headerSlot?: ReactNode;
  pageTitle?: ReactNode;
  children: ReactNode;
};
