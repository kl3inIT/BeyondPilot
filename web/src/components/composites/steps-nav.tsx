"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { cn } from "cn";

type StepsNavStep<S extends string> = {
  id: S;
  title: string;
  /** Whether the step holds what it needs, shown as a check. */
  done: boolean;
};

type StepsNavProps<S extends string> = {
  /** Names the navigation for assistive technology. */
  label: string;
  /** The line above the list where the list is always shown. */
  heading: string;
  /** The steps in order. */
  steps: readonly StepsNavStep<S>[];
  current: S;
  /** Opens a step; without it the steps are only shown. */
  onStep?: (step: S) => void;
  /** Places the bar of a narrow screen in the page: the margins that take it to the edges. */
  className?: string;
};

/**
 * The steps of a form written in several steps, kept in view while the form scrolls. From 1024px it
 * is the list of steps, for a column the page keeps still. Below that it is a bar that sticks to
 * the top of the screen with the step the person is on, how far that is, and a control that opens
 * the same list. Its parent on a narrow screen is a column as tall as the form, so the bar has the
 * whole form to stick along.
 */
function StepsNav<S extends string>({
  label,
  heading,
  steps,
  current,
  onStep,
  className,
}: StepsNavProps<S>) {
  const t = useTranslations("Form.steps");
  const listId = useId();
  const [open, setOpen] = useState(false);
  const index = Math.max(
    steps.findIndex((step) => step.id === current),
    0,
  );

  return (
    <nav
      aria-label={label}
      className={cn(
        "max-lg:sticky max-lg:top-0 max-lg:z-30 max-lg:border-b max-lg:bg-background",
        className,
      )}
    >
      <div className="flex flex-col pb-2 lg:hidden">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger variant="section" aria-controls={listId}>
            <span className="min-w-0 truncate text-sm font-medium">
              {t("progress", { step: index + 1, count: steps.length, name: steps[index].title })}
            </span>
            <span className="flex h-9 shrink-0 items-center gap-1 rounded-md px-1 text-xs text-muted-foreground group-focus-visible/collapsible-section-trigger:ring-2 group-focus-visible/collapsible-section-trigger:ring-ring">
              {t("all")}
              <ChevronDownIcon
                aria-hidden="true"
                className={open ? "size-4 rotate-180" : "size-4"}
              />
            </span>
          </CollapsibleTrigger>
          {/* Kept in the page while closed, so the navigation always holds its steps. */}
          <CollapsibleContent id={listId} keepMounted>
            <div className="pt-2">
              <StepList
                steps={steps}
                current={current}
                onStep={
                  onStep &&
                  ((step: S) => {
                    setOpen(false);
                    onStep(step);
                  })
                }
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
        <Progress value={((index + 1) / steps.length) * 100} aria-label={label} />
      </div>

      <div className="max-lg:hidden">
        <p className="mb-3 text-xs font-medium text-muted-foreground">{heading}</p>
        <StepList steps={steps} current={current} onStep={onStep} />
      </div>
    </nav>
  );
}

type StepListProps<S extends string> = Pick<StepsNavProps<S>, "steps" | "current" | "onStep">;

/** The steps one under the other, each with its number or its check, joined by a line. */
function StepList<S extends string>({ steps, current, onStep }: StepListProps<S>) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const isCurrent = step.id === current;
        const title = (
          <span
            className={cn(
              "text-sm font-medium",
              isCurrent
                ? "font-semibold text-foreground"
                : step.done
                  ? "text-foreground"
                  : "text-muted-foreground",
            )}
          >
            {step.title}
          </span>
        );
        return (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                  isCurrent
                    ? "border-primary bg-background text-primary"
                    : step.done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground",
                )}
              >
                {step.done ? <CheckIcon className="size-3.5" /> : index + 1}
              </span>
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn("my-1 w-0.5 flex-1", step.done ? "bg-primary" : "bg-border")}
                />
              )}
            </div>
            {onStep ? (
              <button
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onStep(step.id)}
                className={cn(
                  "-mx-2 -mt-1 mb-4 flex flex-col items-start rounded-md px-2 py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isCurrent && "bg-primary/10",
                )}
              >
                {title}
              </button>
            ) : (
              <div
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "-mx-2 -mt-1 mb-4 flex flex-col items-start rounded-md px-2 py-1 text-left",
                  isCurrent && "bg-primary/10",
                )}
              >
                {title}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export { StepsNav };
