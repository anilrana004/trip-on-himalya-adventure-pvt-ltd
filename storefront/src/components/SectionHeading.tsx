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
      <h2 className="display mt-3 text-4xl leading-tight text-snow md:text-5xl">{title}</h2>
      {body ? <p className="mt-4 text-sm leading-relaxed text-mist/75 md:text-base">{body}</p> : null}
    </div>
  );
}
