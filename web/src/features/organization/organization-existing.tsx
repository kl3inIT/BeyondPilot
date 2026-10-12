"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { searchOrganizations, type OrganizationMatch } from "@/lib/api/generated";

import { OrganizationMatchRow, useOrganizationJoin } from "./organization-match";

/** How many organizations the notice names: enough to recognise one's own, not a second list. */
const SHOWN = 3;

/** How long after a field is left its check starts, so a click on the submit button lands first. */
const WAIT = 200;

/** A name as it is compared: its letters and digits alone, in lower case. */
function plain(text: string) {
  return text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Whether one name holds the other, so "Pocket Policy Pte Ltd" meets "Pocket Policy". */
function sameName(typed: string, existing: string) {
  const one = plain(typed);
  const other = plain(existing);
  return other.length >= 3 && one.length >= 3 && (other.includes(one) || one.includes(other));
}

/** The host of a website as typed, without "www."; null when it is not an address yet. */
function hostOf(website: string) {
  const text = website.trim();
  if (!text.includes(".")) {
    return null;
  }
  try {
    return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`).hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** The organizations a search finds; none when it did not run, since this check only warns. */
async function find(text: string) {
  try {
    const { data } = await searchOrganizations({ query: { q: text.slice(0, 100) } });
    return data.items;
  } catch {
    return [];
  }
}

/**
 * The organizations that may be the one a person is about to create, looked up with the search of
 * the finder when the name field or the website field is left. The search reads names only, so a
 * name is asked for whole and by its longest word, and a website by the name in its host; of what
 * comes back, an organization is kept when its name holds the typed one or the reverse, or when its
 * verified domain is the website's. A text already checked is not asked again, an answer to an
 * older text is dropped, and nothing is asked or shown while the form is being sent.
 *
 * @param busy whether the form is being sent now
 */
function useExistingOrganizations(busy: () => boolean) {
  const [byName, setByName] = useState<OrganizationMatch[]>([]);
  const [byWebsite, setByWebsite] = useState<OrganizationMatch[]>([]);
  const checked = useRef({ name: "", website: "" });
  const timers = useRef<{ name?: number; website?: number }>({});

  useEffect(() => {
    const waiting = timers.current;
    return () => {
      window.clearTimeout(waiting.name);
      window.clearTimeout(waiting.website);
    };
  }, []);

  function check(
    field: "name" | "website",
    text: string,
    queries: string[],
    keep: (match: OrganizationMatch) => boolean,
  ) {
    if (checked.current[field] === text) {
      return;
    }
    checked.current[field] = text;
    window.clearTimeout(timers.current[field]);
    const show = field === "name" ? setByName : setByWebsite;
    if (queries.length === 0) {
      show([]);
      return;
    }
    timers.current[field] = window.setTimeout(async () => {
      if (busy()) {
        // Not asked, so the text may be checked when the field is left again.
        checked.current[field] = "";
        return;
      }
      const found = (await Promise.all(queries.map(find))).flat();
      if (checked.current[field] === text && !busy()) {
        show(found.filter(keep));
      }
    }, WAIT);
  }

  const seen = new Set<string>();
  const matches = [...byWebsite, ...byName]
    .filter((match) => !seen.has(match.id) && seen.add(match.id))
    .slice(0, SHOWN);

  return {
    matches,
    /** Called when the name field is left. */
    checkName(value: string) {
      const name = value.trim();
      const longest = name.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), "");
      const queries =
        plain(name).length < 3 ? [] : [...new Set([name, longest].filter((q) => q.length >= 3))];
      check("name", name, queries, (match) => sameName(name, match.name));
    },
    /** Called when the website field is left. */
    checkWebsite(value: string) {
      const host = hostOf(value);
      // The name in a host is its longest label before the ending: "mekonglife" of mekonglife.com.vn.
      const label = (host?.split(".").slice(0, -1) ?? []).reduce(
        (a, b) => (b.length > a.length ? b : a),
        "",
      );
      if (!host || label.length < 3) {
        check("website", "", [], () => false);
        return;
      }
      check("website", host, [label], (match) => {
        const domain = match.emailDomain?.toLowerCase();
        return (
          (domain !== undefined && (host === domain || host.endsWith(`.${domain}`))) ||
          sameName(label, match.name)
        );
      });
    },
  };
}

/**
 * A warning above the submit button of the create form: organizations that may be the one being
 * created, each with the way into it the finder offers. It does not stop the form: two
 * organizations may share a name, and the person is the one who knows.
 */
function ExistingOrganizations({ matches }: { matches: OrganizationMatch[] }) {
  const t = useTranslations("Organization.form.existing");
  const joining = useOrganizationJoin();
  const id = useId();

  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 rounded-xl border border-warning bg-warning/10 p-4"
    >
      <div className="flex items-start gap-2.5">
        <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="flex flex-col gap-1">
          <h2 id={id} className="text-sm font-medium">
            {t("title")}
          </h2>
          <p className="text-sm">{t("lead", { count: matches.length })}</p>
        </div>
      </div>
      {matches.map((match) => (
        <div key={match.id} className="rounded-xl bg-card">
          <OrganizationMatchRow
            match={match}
            size="md"
            prominence="secondary"
            pending={joining.pending === match.id}
            disabled={joining.refreshing}
            onAsk={() => joining.ask(match)}
          />
        </div>
      ))}
      {joining.dialog}
    </section>
  );
}

export { ExistingOrganizations, useExistingOrganizations };
