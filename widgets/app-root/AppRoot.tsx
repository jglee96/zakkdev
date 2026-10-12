import { APP_ROOT_ID } from "@/shared/site-layout/app-root";

/**
 * Isolated stacking context for the main app (header, finance shell, blog).
 * Sibling `#modal-root` paints above this subtree without inflating portal z-index.
 */
export function AppRoot({ children }: { children: React.ReactNode }) {
  return (
    <div
      id={APP_ROOT_ID}
      data-testid="app-root"
      style={{ isolation: "isolate", width: "100%", minHeight: "100dvh" }}
    >
      {children}
    </div>
  );
}
