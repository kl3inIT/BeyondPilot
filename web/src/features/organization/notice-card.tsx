type NoticeCardProps = {
  /** The level of the title, so the card keeps the page's outline. */
  titleAs: "h2" | "h3";
  title: React.ReactNode;
  description: React.ReactNode;
  /** The state the card is about, at the end of its head: "In review", "On". */
  badge?: React.ReactNode;
  /** What happens next, in one line. */
  foot: React.ReactNode;
  actions?: React.ReactNode;
};

/**
 * One matter that waits for the reader, with what it is, where it stands and what can be done about
 * it: the review of the organization, who may join by email domain.
 */
function NoticeCard({ titleAs: Title, title, description, badge, foot, actions }: NoticeCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Title className="text-base font-semibold break-words">{title}</Title>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">{description}</div>
        </div>
        {badge}
      </div>
      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">{foot}</p>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export { NoticeCard };
