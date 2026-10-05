import { Badge } from "@/components/ui/badge";

type CodeListProps = {
  /** The words for each code, already translated, in the order to show them. */
  labels: string[];
  /** How many to show before the rest is counted, for a card with little room. */
  limit?: number;
  /** The words for what was left out: "+3". */
  more?: (count: number) => string;
};

/** A few values of a vocabulary as outline chips, such as the industries of a solution. */
function CodeList({ labels, limit, more }: CodeListProps) {
  const shown = limit === undefined ? labels : labels.slice(0, limit);
  const rest = labels.length - shown.length;

  return (
    <ul data-slot="code-list" className="flex flex-wrap gap-1.5">
      {shown.map((label) => (
        <li key={label}>
          <Badge variant="outline">{label}</Badge>
        </li>
      ))}
      {rest > 0 && more && (
        <li>
          <Badge variant="secondary">{more(rest)}</Badge>
        </li>
      )}
    </ul>
  );
}

export { CodeList };
