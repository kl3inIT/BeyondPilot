"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { siteRoutes } from "@/lib/site";

import { steps, type Step } from "./use-case-draft";

type WizardShellProps = {
  /** What the header names: the use case, and the organization it is for. */
  title: string;
  organizationName: string;
  /** Beside the title on the right: where the saving stands, and the way out. */
  status?: ReactNode;
  exit?: ReactNode;
  current: Step;
  /** Whether a step is complete, shown as a check. */
  done: (step: Step) => boolean;
  /** Opens a step; without it the steps are only shown. */
  onStep?: (step: Step) => void;
  notes: ReactNode[];
  children: ReactNode;
};

/**
 * The frame of the use case pages that stand apart from the site: a header with the brand and the use case,
 * the list of steps on the left, and the use case in a card on the right.
 */
function WizardShell({
  title,
  organizationName,
  status,
  exit,
  current,
  done,
  onStep,
  notes,
  children,
}: WizardShellProps) {
  const t = useTranslations("Organization.useCases.wizard");

  return (
    <div className="flex min-h-svh flex-col bg-muted lg:fixed lg:inset-0 lg:min-h-0 lg:overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-background px-5 md:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href={siteRoutes.home}
            className="shrink-0 rounded-sm text-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("brand")}
          </Link>
          <span aria-hidden="true" className="hidden h-5 w-px bg-border sm:block" />
          <span className="hidden truncate text-sm text-muted-foreground sm:block">
            {title} · {organizationName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {status}
          {exit}
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-5 py-8 md:px-8 md:py-12 lg:min-h-0 lg:grid-cols-3 lg:grid-rows-1 lg:py-0">
        <aside className="flex flex-col gap-6 lg:overflow-y-auto lg:py-12">
          <nav aria-label={t("stepsLabel")}>
            <p className="mb-3 text-xs font-medium text-muted-foreground">{t("yourUseCase")}</p>
            <ol className="flex flex-col">
              {steps.map((name, index) => {
                const finished = done(name);
                const isCurrent = name === current;
                const text = (
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isCurrent
                        ? "font-semibold text-foreground"
                        : finished
                          ? "text-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {t(`steps.${name}.title`)}
                  </span>
                );
                return (
                  <li key={name} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                          isCurrent
                            ? "border-primary bg-background text-primary"
                            : finished
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground",
                        )}
                      >
                        {finished ? <CheckIcon className="size-3.5" /> : index + 1}
                      </span>
                      {index < steps.length - 1 && (
                        <span
                          aria-hidden="true"
                          className={cn("my-1 w-0.5 flex-1", finished ? "bg-primary" : "bg-border")}
                        />
                      )}
                    </div>
                    {onStep ? (
                      <button
                        type="button"
                        aria-current={isCurrent ? "step" : undefined}
                        onClick={() => onStep(name)}
                        className={cn(
                          "-mx-2 -mt-1 mb-4 flex flex-col items-start rounded-md px-2 py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          isCurrent && "bg-primary/10",
                        )}
                      >
                        {text}
                      </button>
                    ) : (
                      <div
                        aria-current={isCurrent ? "step" : undefined}
                        className={cn(
                          "-mx-2 -mt-1 mb-4 flex flex-col items-start rounded-md px-2 py-1 text-left",
                          isCurrent && "bg-primary/10",
                        )}
                      >
                        {text}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
          {notes.map((note, index) => (
            <p
              key={index}
              className="rounded-lg border bg-background p-3 text-xs text-muted-foreground"
            >
              {note}
            </p>
          ))}
        </aside>

        {/* From 1024px the steps stay where they are and only this column scrolls. */}
        <div className="lg:col-span-2 lg:overflow-y-auto lg:py-12">
          <main className="flex flex-col gap-5 rounded-3xl border bg-background p-6 md:p-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export { WizardShell };
