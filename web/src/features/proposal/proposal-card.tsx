type CardProps = {
  id: string;
  title: string;
  children: React.ReactNode;
};

/** One titled card of a proposal, as read. */
function Card({ id, title, children }: CardProps) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-xl border bg-background p-5 md:p-6"
    >
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

type RowsProps = {
  rows: { label: string; value: React.ReactNode }[];
};

/** Label and value pairs, side by side from 640px and stacked below. */
function Rows({ rows }: RowsProps) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 break-words whitespace-pre-line sm:col-span-3">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export { Card, Rows };
