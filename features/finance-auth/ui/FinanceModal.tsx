"use client";

import { Modal, type ModalProps } from "@mantine/core";
import { MODAL_ROOT_SELECTOR } from "@/shared/site-layout/modal-root";

const defaultStyles: ModalProps["styles"] = {
  inner: {
    paddingTop: "var(--mantine-spacing-md)",
    paddingBottom: "var(--mantine-spacing-md)",
    alignItems: "center",
  },
  content: {
    maxHeight: "min(90dvh, calc(100dvh - 2rem))",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: 4,
    border: "1px solid #ddd8d2",
    boxShadow: "none",
  },
  body: {
    overflowY: "auto",
    flex: 1,
    minHeight: 0,
  },
};

/** Portals to `#modal-root` (sibling of isolated `#app-root`); uses Mantine default z-index. */
export function FinanceModal({ overlayProps, styles, portalProps, ...props }: ModalProps) {
  return (
    <Modal
      centered
      withinPortal
      portalProps={{ target: MODAL_ROOT_SELECTOR, ...portalProps }}
      overlayProps={{
        className: "finance-modal-overlay",
        ...overlayProps,
      }}
      styles={{
        ...defaultStyles,
        ...styles,
      }}
      {...props}
    />
  );
}
