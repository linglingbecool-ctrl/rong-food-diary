type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "正在整理探店记录" }: LoadingStateProps) {
  return (
    <section className="rounded-card bg-white/75 px-5 py-6 shadow-soft" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 animate-pulse rounded-full bg-orange" />
        <span className="text-sm font-medium text-muted">{label}</span>
      </div>
      <div className="mt-5 space-y-3">
        <div className="h-4 w-2/3 rounded-full bg-line" />
        <div className="h-20 rounded-3xl bg-line/70" />
        <div className="h-20 rounded-3xl bg-line/70" />
      </div>
    </section>
  );
}
