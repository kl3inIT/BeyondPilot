import { StarIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * Says that GenAI Fund features a record: a star and the word, given already translated, never the
 * colour alone. The same badge marks the record in the operators' lists and on its public card.
 */
function FeaturedBadge({
  children,
  ...props
}: Omit<React.ComponentProps<typeof Badge>, "variant">) {
  return (
    <Badge variant="secondary" data-featured="true" {...props}>
      <StarIcon aria-hidden="true" />
      {children}
    </Badge>
  );
}

export { FeaturedBadge };
