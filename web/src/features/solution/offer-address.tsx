import { ArrowUpRightIcon } from "lucide-react";

/** Where an offer is claimed, as a link that opens beside the admin area. */
function OfferAddress({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-0 items-center gap-1 rounded-sm text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="truncate">{url.replace(/^https:\/\//, "")}</span>
      <ArrowUpRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
    </a>
  );
}

export { OfferAddress };
