import { Outlet } from "react-router-dom";

import { BottomNav } from "./BottomNav";

export function AppShell() {
  return (
    <div className="min-h-screen bg-[var(--surface-gradient)] text-ink">
      <div className="mx-auto min-h-screen w-full max-w-app bg-cream/85 shadow-lift">
        <main className="min-h-screen px-5 pb-[calc(var(--bottom-nav-height)+24px)] pt-6">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
