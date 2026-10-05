"use client";

import {
  CircleCheckIcon,
  CircleIcon,
  EllipsisIcon,
  EyeOffIcon,
  GlobeIcon,
  LinkIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";
import { publishProgram, unpublishProgram, type AdminProgram } from "@/lib/api/generated";
import { publicSiteHost, siteRoutes } from "@/lib/site";

import type { SettingsValues } from "./program-schemas";

/** Where a program is read, written out as an operator shares it. */
function addressOf(slug: string) {
  return `${publicSiteHost}${siteRoutes.programs}/${slug}`;
}

type PublishIssue = AdminProgram["publishIssues"][number];

/** The field each thing that blocks publishing is filled in at, in the order the form shows them. */
const fieldOfIssue: Record<PublishIssue, string> = {
  summary: "summary",
  cover: "coverFileId",
  dates: "startsOn",
};

const publishIssues = Object.keys(fieldOfIssue) as PublishIssue[];

/**
 * What the form still lacks before the program can be published, as it stands while it is edited.
 * The backend counts the same three when it publishes, and has the last word.
 */
function missingToPublish(
  values: Pick<SettingsValues, "summary" | "coverFileId" | "startsOn" | "endsOn">,
) {
  return publishIssues.filter((issue) =>
    issue === "summary"
      ? !values.summary.trim()
      : issue === "cover"
        ? !values.coverFileId
        : !values.startsOn || !values.endsOn,
  );
}

/**
 * What a draft needs before it can be published, ticked as the operator fills it in; each line still
 * missing leads to the field to fill in.
 */
function PublishChecklist({ missing }: { missing: PublishIssue[] }) {
  const t = useTranslations("Admin.programs.settings.publish.checklist");
  return (
    <section
      aria-labelledby="publish-checklist"
      className="flex flex-col gap-2.5 rounded-xl border bg-muted p-4"
    >
      <div className="flex flex-col gap-0.5">
        <h2 id="publish-checklist" className="text-sm font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {missing.length > 0 ? t("lead") : t("ready")}
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {publishIssues.map((issue) =>
          missing.includes(issue) ? (
            <li key={issue} className="flex items-center gap-2">
              <CircleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <a
                href={`#${fieldOfIssue[issue]}`}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                onClick={(event) => {
                  // The field is focused, not only scrolled to, so the operator can type at once.
                  const field = document.getElementById(fieldOfIssue[issue]);
                  if (field) {
                    event.preventDefault();
                    field.scrollIntoView({ block: "center" });
                    field.focus({ preventScroll: true });
                  }
                }}
              >
                {t(`issues.${issue}`)}
              </a>
            </li>
          ) : (
            <li key={issue} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleCheckIcon className="size-4 shrink-0 text-success" aria-hidden="true" />
              <span>{t(`issues.${issue}`)}</span>
              <span className="sr-only">{t("done")}</span>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

type PublishButtonProps = {
  program: AdminProgram;
  /** True while Settings holds changes that are not saved. */
  dirty: boolean;
  /** Saves Settings and answers the program as saved, or null when the save was refused. */
  save: () => Promise<AdminProgram | null>;
  className?: string;
};

/**
 * Publish, or Save and publish while changes are unsaved: asks first, because the first publication
 * fixes the address. A draft that still lacks something cannot be published; with unsaved changes
 * the button stays open, since the changes may be what was missing.
 */
function PublishButton({ program, dirty, save, className }: PublishButtonProps) {
  const t = useTranslations("Admin.programs.settings.publish");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  async function publish() {
    setPending(true);
    try {
      const saved = dirty ? await save() : program;
      if (!saved) {
        return;
      }
      if (saved.publishIssues.length > 0) {
        notify.error("Admin.programs.settings.publish.notReady");
        return;
      }
      await publishProgram({ path: { id: program.id } });
      notify.success("Admin.programs.settings.publish.done", { name: saved.name });
      router.refresh();
    } catch (error) {
      notify.error(
        error instanceof ApiError && error.code === "PROGRAM_NOT_READY_TO_PUBLISH"
          ? "Admin.programs.settings.publish.notReady"
          : "Admin.programs.errors.unknown",
      );
    } finally {
      setPending(false);
      setAsking(false);
    }
  }

  return (
    <>
      <Button
        className={className}
        disabled={!dirty && program.publishIssues.length > 0}
        onClick={() => setAsking(true)}
      >
        {dirty ? t("saveAndPublish") : t("button")}
      </Button>
      {asking && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setAsking(false)}
          title={t("confirm.title", { name: program.name })}
          description={t("confirm.lead")}
          note={t("confirm.note")}
          confirmLabel={dirty ? t("saveAndPublish") : t("button")}
          cancelLabel={t("confirm.cancel")}
          pending={pending}
          onConfirm={() => void publish()}
        >
          <AddressBox slug={program.slug} />
        </ConfirmDialog>
      )}
    </>
  );
}

/** The program's other actions, in a menu: its link, and taking it off the public site. */
function ProgramMenu({ program }: { program: AdminProgram }) {
  const t = useTranslations("Admin.programs.settings");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  async function unpublish() {
    setPending(true);
    try {
      await unpublishProgram({ path: { id: program.id } });
      notify.success("Admin.programs.settings.unpublish.done", { name: program.name });
      router.refresh();
    } catch {
      notify.error("Admin.programs.errors.unknown");
    } finally {
      setPending(false);
      setAsking(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t("more")}
              className="hit-area flex size-10 items-center justify-center rounded-lg border border-input outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
            />
          }
        >
          <EllipsisIcon className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => {
                void navigator.clipboard
                  .writeText(`https://${addressOf(program.slug)}`)
                  .then(() => notify.success("Admin.programs.settings.copied"));
              }}
            >
              <LinkIcon aria-hidden="true" />
              {t("copyLink")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {program.status === "published" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem variant="destructive" onClick={() => setAsking(true)}>
                  <EyeOffIcon aria-hidden="true" />
                  {t("unpublish.menu")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {asking && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setAsking(false)}
          title={t("unpublish.title", { name: program.name })}
          description={t("unpublish.lead")}
          note={t("unpublish.note")}
          confirmLabel={t("unpublish.confirm")}
          cancelLabel={t("publish.confirm.cancel")}
          tone="danger"
          pending={pending}
          onConfirm={() => void unpublish()}
        >
          <AddressBox slug={program.slug} />
        </ConfirmDialog>
      )}
    </>
  );
}

function AddressBox({ slug }: { slug: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted p-3">
      <GlobeIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="text-sm font-medium break-all">{addressOf(slug)}</span>
    </div>
  );
}

export { missingToPublish, ProgramMenu, PublishButton, PublishChecklist };
