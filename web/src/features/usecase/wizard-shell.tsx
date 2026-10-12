"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";

import { StepsNav } from "@/components/composites/steps-nav";
import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

import { steps, type Step } from "./use-case-draft";

type WizardShellProps<S extends string = Step> = {
  /** What the header names: the use case, and the organization it is for. */
  title: string;
  organizationName: string;
  /** Beside the title on the right: where the saving stands, and the way out. */
  status?: ReactNode;
  exit?: ReactNode;
  /** The steps in order, with their titles and the line above them; the use case's own by default. */
  steps?: { names: readonly S[]; title: (step: S) => string; heading: string };
  current: S;
  /** Whether a step is complete, shown as a check. */
  done: (step: S) => boolean;
  /** Opens a step; without it the steps are only shown. */
  onStep?: (step: S) => void;
  notes: ReactNode[];
  children: ReactNode;
};

/**
 * The frame of the use case pages that stand apart from the site: a header with the brand and the use case,
 * the list of steps on the left, and the use case in a card on the right. Below 1024px the steps are
 * a bar that stays at the top of the screen. When the step changes, the page starts again at its top
 * and the focus goes to the step's heading, the `h1` its content gives with `tabIndex={-1}`.
 */
function WizardShell<S extends string = Step>({
  title,
  organizationName,
  status,
  exit,
  steps: own,
  current,
  done,
  onStep,
  notes,
  children,
}: WizardShellProps<S>) {
  const t = useTranslations("Organization.useCases.wizard");
  const names = (own?.names ?? steps) as readonly S[];
  const column = useRef<HTMLDivElement>(null);
  const shown = useRef(current);

  useEffect(() => {
    if (shown.current === current) {
      return;
    }
    shown.current = current;
    // From 1024px the column scrolls, below that the page does.
    column.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    column.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [current]);

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

      {/* A column below 1024px, so the bar of steps has the whole form to stick along. */}
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-5 py-8 md:px-8 md:py-12 lg:grid lg:min-h-0 lg:grid-cols-3 lg:grid-rows-1 lg:py-0">
        <aside className="flex flex-col gap-6 max-lg:contents lg:overflow-y-auto lg:py-12">
          <StepsNav
            label={t("stepsLabel")}
            heading={own ? own.heading : t("yourUseCase")}
            steps={names.map((name) => ({
              id: name,
              title: own ? own.title(name) : t(`steps.${name as Step}.title`),
              done: done(name),
            }))}
            current={current}
            onStep={onStep}
            className="max-lg:-mx-5 max-lg:-mt-8 max-lg:px-5 md:max-lg:-mx-8 md:max-lg:-mt-12 md:max-lg:px-8"
          />
          {notes.length > 0 && (
            <div className="flex flex-col gap-6">
              {notes.map((note, index) => (
                <p
                  key={index}
                  className="rounded-lg border bg-background p-3 text-xs text-muted-foreground"
                >
                  {note}
                </p>
              ))}
            </div>
          )}
        </aside>

        {/* From 1024px the steps stay where they are and only this column scrolls. */}
        <div ref={column} className="lg:col-span-2 lg:overflow-y-auto lg:py-12">
          <main className="flex flex-col gap-5 rounded-3xl border bg-background p-6 md:p-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export { WizardShell };
