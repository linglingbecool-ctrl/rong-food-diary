import type { LucideIcon } from "lucide-react";
import { MapPinned } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
};

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = MapPinned,
}: EmptyStateProps) {
  return (
    <section className="rounded-card border border-dashed border-line bg-white/70 px-5 py-8 text-center shadow-soft">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue/18 text-ink">
        <Icon size={24} aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
