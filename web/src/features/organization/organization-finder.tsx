"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/actions/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { searchOrganizations, type OrganizationMatch } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { OrganizationMatchRow, useOrganizationJoin } from "./organization-match";

/** Where a new organization is created. */
const createHref = `${siteRoutes.workspaceOrganization}/new`;

type OrganizationFinderProps = {
  /** The organization the caller's email domain belongs to, when one does. */
  suggestion: OrganizationMatch | null;
  /** Shown inside another form, such as an application, without its own heading. */
  embedded?: boolean;
  /**
   * Called once the person has joined or asked to, in place of reading the page again: for a caller
   * that keeps what the backend answered itself and reads it anew. It says its own failure.
   */
  onAnswered?: () => Promise<void>;
};

/**
 * How a person without an organization finds theirs: the one their email domain points at, then a
 * search by name. What happens on a click depends on the organization: joining on its verified
 * domain, asking its owners, or claiming one that nobody owns yet, which GenAI Fund reviews. Each
 * is asked in one dialog first: joining shows the person to the organization's members at once.
 * Creating a new one is offered beside it, and starts from the name typed here. A search that did
 * not run is not an empty result: it offers to try again, and never to create.
 */
function OrganizationFinder({ suggestion, embedded = false, onAnswered }: OrganizationFinderProps) {
  const t = useTranslations("Organization.find");
  const joining = useOrganizationJoin(onAnswered);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<OrganizationMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  // The text whose search did not run, and how often the person asked for it again.
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

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
          setFailed(null);
        }
      } catch {
        // No answer is not "no organization": the results on screen go, and creating is not offered.
        if (current) {
          setFound(null);
          setFailed(text);
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
  }, [query, attempt]);

  const typed = query.trim().length >= 2;
  // The failure belongs to the text it was asked for; another text is another search.
  const broken = typed && failed === query.trim() && !searching;
  // Before a search, the organization of the caller's email domain is the one result.
  const results = broken ? null : typed ? found : suggestion ? [suggestion] : null;
  const nothing = typed && !broken && found !== null && found.length === 0 && !searching;
  const only = results?.length === 1 ? results[0] : null;
  // The form starts from the name the person already typed.
  const create = typed ? `${createHref}?name=${encodeURIComponent(query.trim())}` : createHref;

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
          <OrganizationMatchRow
            key={match.id}
            match={match}
            pending={joining.pending === match.id}
            disabled={joining.refreshing}
            onAsk={() => joining.ask(match)}
          />
        ))}
        {nothing && (
          <p className="text-xs text-muted-foreground">{t("nothing", { query: query.trim() })}</p>
        )}
        {broken && (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-warning bg-warning/10 p-4">
            <p className="text-sm">{t("failed")}</p>
            <Button prominence="secondary" onClick={() => setAttempt((count) => count + 1)}>
              {t("retry")}
            </Button>
          </div>
        )}
      </div>

      {broken ? null : nothing ? (
        <Button size="lg" className="w-full" href={create}>
          {t("create")}
        </Button>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button prominence="secondary" className="w-full" href={create}>
            {t("create")}
          </Button>
        </div>
      )}

      {!nothing && !broken && only?.way !== "claim" && (
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

      {joining.dialog}
    </div>
  );
}

export { OrganizationFinder };
