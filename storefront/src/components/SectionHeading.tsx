export function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 className="display mt-3 text-3xl leading-tight text-charcoal md:text-4xl">{title}</h2>
      {body ? <p className="mt-4 text-sm font-light leading-relaxed text-muted md:text-base">{body}</p> : null}
    </div>
  );
}
