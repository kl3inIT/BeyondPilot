import { cva } from "class-variance-authority";
import { CheckIcon } from "lucide-react";

type StepState = "done" | "current" | "upcoming";

const stepMarker = cva(
  "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold [&_svg]:size-3.5",
  {
    variants: {
      state: {
        done: "bg-primary text-primary-foreground",
        current: "border-2 border-primary bg-background text-primary",
        upcoming: "border border-input bg-background text-muted-foreground",
      },
    },
  },
);

const stepTitle = cva("text-sm", {
  variants: {
    state: {
      done: "font-medium",
      current: "font-semibold",
      upcoming: "font-medium text-muted-foreground",
    },
  },
});

const stepMeta = cva("text-xs", {
  variants: {
    tone: {
      default: "text-muted-foreground",
      danger: "font-medium text-destructive",
    },
  },
});

type StepItemProps = {
  /** The place of the step, from 1, shown until the step is done. */
  number: number;
  title: string;
  /** One line under the title: what the step holds, or what it still lacks. */
  meta?: string;
  /** `danger` reads the meta as something to put right. */
  tone?: "default" | "danger";
  state: StepState;
  /** What stands for the check mark of a done step, for assistive technology. */
  doneLabel: string;
  /** The last step draws no line to a next one. */
  last?: boolean;
  onSelect: () => void;
};

/**
 * One step of a vertical stepper: its number or, once done, a check mark, its title and one line
 * about it, joined to the next step by a line. A step is a way to that step, so a person moves
 * through them in any order.
 */
function StepItem({
  number,
  title,
  meta,
  tone = "default",
  state,
  doneLabel,
  last = false,
  onSelect,
}: StepItemProps) {
  return (
    <li className="relative flex pb-5 last:pb-0" data-slot="step-item" data-state={state}>
      {!last && (
        <span
          aria-hidden="true"
          className={
            state === "done"
              ? "absolute top-6 bottom-0 left-3 w-0.5 -translate-x-1/2 bg-primary"
              : "absolute top-6 bottom-0 left-3 w-px -translate-x-1/2 bg-border"
          }
        />
      )}
      <button
        type="button"
        aria-current={state === "current" ? "step" : undefined}
        onClick={onSelect}
        className="group flex w-full items-start gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className={stepMarker({ state })}>
          {state === "done" ? (
            <>
              <CheckIcon aria-hidden="true" />
              <span className="sr-only">{doneLabel}</span>
            </>
          ) : (
            number
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
          <span className={stepTitle({ state })}>
            <span className="group-hover:underline group-hover:underline-offset-4">{title}</span>
          </span>
          {meta && <span className={stepMeta({ tone })}>{meta}</span>}
        </span>
      </button>
    </li>
  );
}

export { StepItem, type StepState };
