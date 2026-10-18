import type { ReactNode } from "react";

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
  logo: ReactNode;
  title: string;
  nav: AppNavGroup[];
  headerSlot?: ReactNode;
  pageTitle?: ReactNode;
  children: ReactNode;
};
