/** Browser-side stacking ancestor walk (injected via page.evaluate). */
export const STACKING_CONTEXT_COLLECTOR = String.raw`
function describeEl(el) {
  if (!el || el.nodeType !== 1) return null;
  const tag = el.tagName.toLowerCase();
  const id = el.id ? "#" + el.id : "";
  const testId = el.getAttribute("data-testid");
  const cls =
    el.classList && el.classList.length
      ? "." + Array.from(el.classList).slice(0, 3).join(".")
      : "";
  return (tag + id + (testId ? '[data-testid="' + testId + '"]' : "") + cls).slice(0, 120);
}

function createsStackingContext(el) {
  if (!el || el.nodeType !== 1) return false;
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (el === document.documentElement) return true;
  const position = style.position;
  const zIndex = style.zIndex;
  const opacity = Number(style.opacity);
  const transform = style.transform;
  const filter = style.filter;
  const isolation = style.isolation;
  const mixBlendMode = style.mixBlendMode;
  const perspective = style.perspective;
  const contain = style.contain || "";
  const willChange = style.willChange || "";
  const clipPath = style.clipPath;
  const webkitClipPath = style.webkitClipPath;
  if (isolation === "isolate") return true;
  if (opacity < 1) return true;
  if (transform && transform !== "none") return true;
  if (filter && filter !== "none") return true;
  if (perspective && perspective !== "none") return true;
  if (mixBlendMode && mixBlendMode !== "normal") return true;
  if (clipPath && clipPath !== "none") return true;
  if (webkitClipPath && webkitClipPath !== "none") return true;
  if (/layout|paint|strict|content/.test(contain)) return true;
  if (/opacity|transform|filter|perspective/.test(willChange)) return true;
  const positioned =
    position === "absolute" ||
    position === "relative" ||
    position === "fixed" ||
    position === "sticky";
  if (positioned && zIndex !== "auto") return true;
  if (position === "fixed" || position === "sticky") return true;
  const parent = el.parentElement;
  if (parent) {
    const ps = getComputedStyle(parent);
    if (ps.display === "flex" || ps.display === "inline-flex" || ps.display === "grid" || ps.display === "inline-grid") {
      if (zIndex !== "auto") return true;
    }
  }
  return false;
}

function ancestorChain(start) {
  const chain = [];
  let el = start;
  while (el) {
    const style = getComputedStyle(el);
    chain.push({
      selector: describeEl(el),
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      dataTestId: el.getAttribute("data-testid"),
      position: style.position,
      zIndex: style.zIndex,
      isolation: style.isolation,
      transform: style.transform,
      opacity: style.opacity,
      filter: style.filter,
      createsStackingContext: createsStackingContext(el),
    });
    if (el === document.body) break;
    el = el.parentElement;
  }
  return chain;
}

function findModalOverlay() {
  const byClass = document.querySelector(".finance-modal-overlay");
  if (byClass) return byClass;
  const mantine = document.querySelector(".mantine-Modal-overlay");
  if (mantine) return mantine;
  const dialog = document.querySelector('[data-testid="create-bot-modal"]')?.closest('[role="dialog"]');
  if (dialog?.parentElement) {
    const sib = dialog.parentElement.querySelector('[class*="overlay"]');
    if (sib) return sib;
  }
  const overlays = Array.from(document.querySelectorAll('[class*="Modal-overlay"], [class*="modal-overlay"]'));
  return overlays[0] ?? null;
}

function headerHitTest() {
  const header = document.querySelector('[data-testid="site-app-shell-header"]');
  if (!header) return null;
  const hr = header.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = Math.min(Math.max(hr.left + hr.width / 2, 0), vw - 1);
  const cy = Math.min(Math.max(hr.top + hr.height / 2, 0), vh - 1);
  const topEl = document.elementFromPoint(cx, cy);
  return {
    cx,
    cy,
    topSelector: topEl ? describeEl(topEl) : null,
    topUnderHeader: Boolean(topEl?.closest('[data-testid="site-app-shell-header"]')),
  };
}

function collectModalStackingContext() {
  const header = document.querySelector('[data-testid="site-app-shell-header"]');
  const overlay = findModalOverlay();
  const bodyChildren = Array.from(document.body.children).map((c) => describeEl(c));
  return {
    headerHitTest: headerHitTest(),
    headerChain: header ? ancestorChain(header) : null,
    overlayChain: overlay ? ancestorChain(overlay) : null,
    overlayFound: Boolean(overlay),
    overlaySelector: overlay ? describeEl(overlay) : null,
    bodyDirectChildren: bodyChildren,
    modalRootPresent: Boolean(document.getElementById("modal-root")),
    appRootPresent: Boolean(document.getElementById("app-root")),
  };
}
`;

export type StackingAncestor = {
  selector: string;
  tag: string;
  id: string | null;
  dataTestId: string | null;
  position: string;
  zIndex: string;
  isolation: string;
  transform: string;
  opacity: string;
  filter: string;
  createsStackingContext: boolean;
};
