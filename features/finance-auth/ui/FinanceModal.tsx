"use client";

import { Modal, type ModalProps } from "@mantine/core";

/** Above site `AppShellHeader` (z-index 250). */
export const FINANCE_MODAL_Z_INDEX = 320;
export const FINANCE_MODAL_OVERLAY_Z_INDEX = 300;

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
  },
  body: {
    overflowY: "auto",
    flex: 1,
    minHeight: 0,
  },
};

export function FinanceModal({ overlayProps, styles, ...props }: ModalProps) {
  return (
    <Modal
      centered
      withinPortal
      zIndex={FINANCE_MODAL_Z_INDEX}
      overlayProps={{
        zIndex: FINANCE_MODAL_OVERLAY_Z_INDEX,
        "data-testid": "finance-modal-overlay",
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
