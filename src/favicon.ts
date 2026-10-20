import { useEffect, type RefObject } from "react";

const iconSelector = 'link[rel~="icon"]';

/*
 * A favicon is a standalone document: `currentColor` has no app stylesheet to
 * resolve against, so pin the colour the mark shows in the sidebar and let the
 * browser re-render it whenever that colour changes.
 */
function svgText(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.style.color = getComputedStyle(svg).color;
  return new XMLSerializer().serializeToString(clone);
}

function faviconOf(source: Element): { href: string; type?: string } {
  if (source instanceof SVGSVGElement) {
    return {
      href: `data:image/svg+xml,${encodeURIComponent(svgText(source))}`,
      type: "image/svg+xml",
    };
  }
  const { currentSrc, src } = source as HTMLImageElement;
  const href = currentSrc || src;
  return /\.svg([?#]|$)/i.test(href) ? { href, type: "image/svg+xml" } : { href };
}

function iconLink(): HTMLLinkElement {
  const existing = document.querySelector<HTMLLinkElement>(iconSelector);
  if (existing) {
    return existing;
  }
  const link = document.createElement("link");
  link.rel = "icon";
  document.head.append(link);
  return link;
}

/**
 * Mirrors the rendered logo into the page favicon: the tab shows the same mark
 * as the sidebar, including its current colour, and follows theme changes.
 */
export function useLogoFavicon(logo: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const apply = () => {
      const source = logo.current?.querySelector("svg, img");
      if (!source) {
        return;
      }
      const { href, type } = faviconOf(source);
      const link = iconLink();
      if (type) {
        link.type = type;
      } else {
        link.removeAttribute("type");
      }
      if (link.getAttribute("href") !== href) {
        link.setAttribute("href", href);
      }
    };

    apply();
    // The mark's colour comes from the theme, so re-render when the document
    // scheme changes or the mark itself is swapped.
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    if (logo.current) {
      observer.observe(logo.current, { childList: true, subtree: true });
    }
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", apply);
    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", apply);
    };
  }, [enabled, logo]);
}
