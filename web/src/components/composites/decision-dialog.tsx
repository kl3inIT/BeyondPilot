import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { DialogDescription, DialogTitle } from "@/components/ui/dialog";

const decisionMarks = cva("flex size-14 items-center justify-center rounded-full [&_svg]:size-7", {
  variants: {
    tone: {
      success: "bg-mint text-mint-foreground",
      warning: "bg-peach text-peach-foreground",
      danger: "bg-destructive/10 text-destructive",
    },
  },
});

type DecisionDialogHeaderProps = Required<VariantProps<typeof decisionMarks>> & {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
};

/**
 * The head of a dialog that asks for a decision: a coloured mark for approving (`success`), sending
 * back (`warning`) or refusing (`danger`), the title and one line below it. Its buttons go in a
 * `<DialogFooter variant="plain">`.
 */
function DecisionDialogHeader({ tone, icon: Icon, title, description }: DecisionDialogHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-3 pt-2 text-center">
      <span className={decisionMarks({ tone })} aria-hidden="true">
        <Icon />
      </span>
      <DialogTitle size="lg">{title}</DialogTitle>
      {description && <DialogDescription>{description}</DialogDescription>}
    </div>
  );
}

export { DecisionDialogHeader };
