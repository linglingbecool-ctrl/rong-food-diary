import { AlertTriangle } from "lucide-react";

type ErrorStateProps = {
  title?: string;
  message: string;
};

export function ErrorState({ title = "页面没有顺利加载", message }: ErrorStateProps) {
  return (
    <section className="rounded-card border border-orange/30 bg-orange/10 px-5 py-6 text-left">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange/20 text-orange">
          <AlertTriangle size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{message}</p>
        </div>
      </div>
    </section>
  );
}
