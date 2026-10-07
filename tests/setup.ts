import "@testing-library/jest-dom/vitest";

declare global {
  var __uxMobileViewport: boolean | undefined;
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = window.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);

window.matchMedia = ((query: string) =>
  ({
    matches: query.includes("max-width") && Boolean(globalThis.__uxMobileViewport),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList) as typeof window.matchMedia;
