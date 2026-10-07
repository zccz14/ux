export type AppLayoutCopy = {
  closeNavigation: string;
  navigation: string;
  toggleSidebar: string;
};

const en: AppLayoutCopy = {
  closeNavigation: "Close navigation",
  navigation: "Navigation",
  toggleSidebar: "Toggle sidebar",
};

const zh: AppLayoutCopy = {
  closeNavigation: "关闭导航",
  navigation: "导航",
  toggleSidebar: "切换侧边栏",
};

export function copyForLang(lang: string): AppLayoutCopy {
  return lang.toLowerCase().startsWith("zh") ? zh : en;
}
