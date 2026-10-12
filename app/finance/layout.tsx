/**
 * Finance routes use their own AppShell. Break out of the site root's narrow (768px) column
 * so chat, bots, and routines can use the full main area (up to ~1100px inside FinanceHome).
 */
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-testid="finance-layout-bleed"
      style={{
        width: "100vw",
        maxWidth: "100vw",
        position: "relative",
        left: "50%",
        marginLeft: "-50vw",
        marginRight: "-50vw",
        marginTop: "-28px",
        marginBottom: "-40px",
        padding: 0,
      }}
    >
      {children}
    </div>
  );
}
