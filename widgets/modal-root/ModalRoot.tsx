import { MODAL_ROOT_ID } from "@/shared/site-layout/modal-root";

/** Empty portal target; must remain a direct child of `document.body` (see root layout). */
export function ModalRoot() {
  return <div id={MODAL_ROOT_ID} data-testid="modal-root" />;
}
