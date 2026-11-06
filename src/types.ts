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
  favicon?: boolean;
  logo: ReactNode;
  title: string;
  nav: AppNavGroup[];
  headerSlot?: ReactNode;
  pageTitle?: ReactNode;
  children: ReactNode;
};

export type MarkdownProps = {
  content: string;
  /*
   * Reveal the content progressively as it grows, so a snapshot that arrives in whole chunks reads
   * as a string being typed. Off by default, and a mount never animates: only content that arrives
   * after the surface is on screen is revealed. The host decides which surfaces are live — this
   * only decides what a live one looks like.
   */
  reveal?: boolean;
};
