"use client";

import { useRouter } from "next/navigation";
import { SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/actions/button";
import { FormDialog } from "@/components/composites/form-dialog";
import { useAppForm } from "@/components/form/app-form";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNotify } from "@/hooks/use-notify";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import { joinOrganization, searchOrganizations, type OrganizationMatch } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { OrganizationMark } from "./organization-mark";

/** What each outcome of joining is said as. */
const done = {
  joined: "Organization.done.joined",
  requested: "Organization.done.requested",
} as const;

/** Where a new organization is created. */
const createHref = `${siteRoutes.workspaceOrganization}/new`;

type OrganizationFinderProps = {
  /** The organization the caller's email domain belongs to, when one does. */
  suggestion: OrganizationMatch | null;
  /** Shown inside another form, such as an application, without its own heading. */
  embedded?: boolean;
};

/**
 * How a person without an organization finds theirs: the one their email domain points at, then a
 * search by name. What happens on a click depends on the organization: joining on its verified
 * domain, asking its owners, or claiming one that nobody owns yet, which GenAI Fund reviews. Each
 * is asked in one dialog first: joining shows the person to the organization's members at once.
 * Creating a new one is always offered beside it.
 */
function OrganizationFinder({ suggestion, embedded = false }: OrganizationFinderProps) {
  const t = useTranslations("Organization.find");
  const typeName = useVocabulary("organizationType");
  const countryName = useCountryName();
  const notify = useNotify();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<OrganizationMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [asking, setAsking] = useState<OrganizationMatch | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  // The page shows what joining made of the caller once it has read it again; until then nothing is asked twice.
  const [refreshing, startRefresh] = useTransition();

  // The search asks 300 ms after the last keystroke; an answer to an older question is dropped.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      return;
    }
    let current = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await searchOrganizations({ query: { q: text } });
        if (current) {
          setFound(data.items);
        }
      } catch {
        if (current) {
          setFound([]);
        }
      } finally {
        if (current) {
          setSearching(false);
        }
      }
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);

  async function join(match: OrganizationMatch, note?: string) {
    setPending(match.id);
    try {
      const { data } = await joinOrganization({
        path: { id: match.id },
        body: { message: note?.trim() || null },
      });
      notify.success(done[data.outcome], { name: match.name });
      setAsking(null);
      startRefresh(() => router.refresh());
    } catch (error) {
      notify.failure(error);
    } finally {
      setPending(null);
    }
  }

  const typed = query.trim().length >= 2;
  // Before a search, the organization of the caller's email domain is the one result.
  const results = typed ? found : suggestion ? [suggestion] : null;
  const nothing = typed && found !== null && found.length === 0 && !searching;
  const only = results?.length === 1 ? results[0] : null;

  return (
    <div
      className={embedded ? "flex w-full flex-col gap-6" : "flex w-full max-w-130 flex-col gap-6"}
    >
      {!embedded && <h1 className="text-3xl font-semibold tracking-title">{t("title")}</h1>}
      <Field>
        <FieldLabel htmlFor="organization-search">{t("search")}</FieldLabel>
        <Input
          id="organization-search"
          type="search"
          autoComplete="off"
          maxLength={100}
          value={query}
          aria-busy={searching || undefined}
          onChange={(event) => setQuery(event.target.value)}
        />
      </Field>

      <div aria-live="polite" className="flex flex-col gap-3 empty:hidden">
        {results?.map((match) => (
          <div
            key={match.id}
            className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <OrganizationMark name={match.name} logoFileId={match.logoFileId} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{match.name}</span>
                <span className="text-xs text-muted-foreground">
                  {[typeName(match.type), match.country && countryName(match.country)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {match.way !== "request" && (
                  <span className="text-xs text-muted-foreground">
                    {match.way === "join" && match.emailDomain
                      ? t("way.joinDomain", { domain: match.emailDomain })
                      : t(`way.${match.way}`)}
                  </span>
                )}
              </div>
            </div>
            <Button
              size="lg"
              pending={pending === match.id}
              disabled={refreshing}
              onClick={() => setAsking(match)}
            >
              {t(`action.${match.way}`)}
            </Button>
          </div>
        ))}
        {nothing && (
          <p className="text-xs text-muted-foreground">{t("nothing", { query: query.trim() })}</p>
        )}
      </div>

      {nothing ? (
        <Button size="lg" className="w-full" href={createHref}>
          {t("create")}
        </Button>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button prominence="secondary" className="w-full" href={createHref}>
            {t("create")}
          </Button>
        </div>
      )}

      {!nothing && only?.way !== "claim" && (
        <p className="text-xs text-muted-foreground">
          {only?.way === "request"
            ? only.emailDomain
              ? t(only.onDomain ? "note.requestOnDomain" : "note.requestDomain", {
                  domain: only.emailDomain,
                  name: only.name,
                })
              : t("note.request", { name: only.name })
            : t("note.create")}
        </p>
      )}

      {asking && (
        <AskDialog
          match={asking}
          onJoin={(note) => join(asking, note)}
          onClose={() => setAsking(null)}
        />
      )}
    </div>
  );
}

type AskDialogProps = {
  /** The organization the person chose. */
  match: OrganizationMatch;
  /** Joins, asks or claims, with the message when there is one; it closes the dialog once done. */
  onJoin: (note?: string) => Promise<void>;
  onClose: () => void;
};

/**
 * Asks before joining, asking to join or claiming an organization. Joining by domain needs no
 * words; a request or a claim is read by someone, so it may carry some.
 */
function AskDialog({ match, onJoin, onClose }: AskDialogProps) {
  const t = useTranslations("Organization.find");
  const { way, name } = match;
  const form = useAppForm({
    defaultValues: { message: "" },
    onSubmit: ({ value }) => onJoin(way === "join" ? undefined : value.message),
  });

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      form={form}
      title={t(`ask.${way}.title`, { name })}
      description={
        way === "claim" ? t("ask.claim.lead") : way === "join" ? t("ask.join.lead") : undefined
      }
      mark={{ tone: "info", icon: SendIcon }}
      width="md"
      submitLabel={t(`action.${way}`)}
      cancelLabel={t("ask.cancel")}
    >
      {way !== "join" && (
        <form.AppField name="message">
          {(field) => (
            <field.TextareaField
              label={t("ask.message")}
              rows={4}
              maxLength={500}
              description={
                way === "claim"
                  ? t("ask.claim.messageHint")
                  : t("ask.request.messageHint", { name })
              }
            />
          )}
        </form.AppField>
      )}
    </FormDialog>
  );
}

export { OrganizationFinder };
