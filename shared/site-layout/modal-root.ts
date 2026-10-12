/** Persistent portal mount for finance modals and layered overlays (see app/layout.tsx). */
export const MODAL_ROOT_ID = "modal-root";

export const MODAL_ROOT_SELECTOR = `#${MODAL_ROOT_ID}`;

/** Mantine Select/Combobox dropdowns in `#modal-root` (above isolated `#app-root`). */
export const FINANCE_COMBOBOX_PORTAL_PROPS = {
  withinPortal: true as const,
  portalProps: { target: MODAL_ROOT_SELECTOR },
};
