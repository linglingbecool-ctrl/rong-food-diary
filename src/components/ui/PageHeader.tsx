type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <header className="mb-5">
      {eyebrow ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-display text-3xl font-semibold leading-tight text-ink">{title}</h1>
      {description ? <p className="mt-2 text-sm leading-6 text-muted">{description}</p> : null}
    </header>
  );
}
