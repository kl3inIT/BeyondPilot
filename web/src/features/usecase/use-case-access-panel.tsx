"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import {
  giveAdminUseCaseAccess,
  giveMyUseCaseAccess,
  removeAdminUseCaseAccess,
  removeMyUseCaseAccess,
  shareAdminUseCaseWithMembers,
  shareMyUseCaseWithMembers,
  type SetUseCaseAccess,
  type SetUseCaseMemberAccess,
  type UseCaseAccess,
} from "@/lib/api/generated";

import { useCaseWords } from "./my-use-case-errors";

const personRoles = [
  "viewer",
  "editor",
  "full_access",
] as const satisfies readonly SetUseCaseAccess["role"][];
const memberRoles = [
  "none",
  "viewer",
  "editor",
  "full_access",
] as const satisfies readonly SetUseCaseMemberAccess["role"][];

type UseCaseAccessPanelProps = {
  /** Whose calls it makes: the organization's own, or the operators'. */
  area: "workspace" | "admin";
  id: string;
  access: UseCaseAccess;
};

/**
 * Who may do what with one use case, as the people who have full access change it: what every other
 * member of the organization may do, each person's role, and a member to add. Everyone else reads it.
 */
function UseCaseAccessPanel({ area, id, access }: UseCaseAccessPanelProps) {
  const t = useTranslations("Organization.useCases.access");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [candidate, setCandidate] = useState<string | null>(null);
  const [role, setRole] = useState<SetUseCaseAccess["role"]>("viewer");
  const canChange = access.yourAccess === "full_access";

  async function run(action: () => Promise<unknown>) {
    setPending(true);
    try {
      await action();
      notify.success("Organization.useCases.access.done");
      router.refresh();
    } catch (error) {
      notify.failure(error, useCaseWords);
    } finally {
      setPending(false);
    }
  }

  const give = (accountId: string, next: SetUseCaseAccess["role"]) =>
    run(() =>
      (area === "admin" ? giveAdminUseCaseAccess : giveMyUseCaseAccess)({
        path: { id, accountId },
        body: { role: next },
      }),
    );
  const remove = (accountId: string) =>
    run(() =>
      (area === "admin" ? removeAdminUseCaseAccess : removeMyUseCaseAccess)({
        path: { id, accountId },
      }),
    );
  const share = (next: SetUseCaseMemberAccess["role"]) =>
    run(() =>
      (area === "admin" ? shareAdminUseCaseWithMembers : shareMyUseCaseWithMembers)({
        path: { id },
        body: { role: next },
      }),
    );

  const personItems = personRoles.map((value) => ({ value, label: t(`roles.${value}`) }));
  const memberItems = memberRoles.map((value) => ({ value, label: t(`general.${value}`) }));
  const candidateItems = access.candidates.map((person) => ({
    value: person.accountId,
    label: `${person.name} · ${person.email}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-prose text-sm text-muted-foreground">
        {canChange ? t("lead") : t("readOnly")}
      </p>

      {canChange && (
        <form
          className="flex flex-col gap-3 rounded-lg border bg-background p-4 md:flex-row md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (candidate) {
              void give(candidate, role).then(() => setCandidate(null));
            }
          }}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium">{t("add.label")}</span>
            <Select
              items={candidateItems}
              value={candidate}
              disabled={candidateItems.length === 0}
              onValueChange={(value) => setCandidate(value)}
            >
              <SelectTrigger size="lg" aria-label={t("add.label")} className="w-full">
                <SelectValue
                  placeholder={candidateItems.length ? t("add.placeholder") : t("add.none")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {candidateItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 md:w-44">
            <span className="text-sm font-medium">{t("add.role")}</span>
            <Select
              items={personItems}
              value={role}
              onValueChange={(value) => setRole(value as SetUseCaseAccess["role"])}
            >
              <SelectTrigger size="lg" aria-label={t("add.role")} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {personItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="lg" pending={pending} disabled={!candidate}>
            {t("add.submit")}
          </Button>
        </form>
      )}

      <ul className="divide-y rounded-lg border bg-background" aria-label={t("title")}>
        {access.people.map((person) => {
          const fixed = person.creator || person.owner;
          return (
            <li
              key={person.accountId}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="grid min-w-0 text-sm">
                <span className="truncate font-medium">
                  {person.name}
                  {person.you && (
                    <span className="font-normal text-muted-foreground"> · {t("you")}</span>
                  )}
                </span>
                <span className="truncate text-muted-foreground">
                  {[
                    person.creator ? t("creator") : null,
                    person.owner ? t("owner") : null,
                    person.email,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {person.addedBy && (
                  <span className="truncate text-xs text-muted-foreground">
                    {t("addedBy", { name: person.addedBy })}
                  </span>
                )}
              </div>
              {canChange && !fixed ? (
                <div className="flex items-center gap-2">
                  <Select
                    items={personItems}
                    value={person.role}
                    disabled={pending}
                    onValueChange={(value) =>
                      void give(person.accountId, value as SetUseCaseAccess["role"])
                    }
                  >
                    <SelectTrigger
                      aria-label={t("changeRole", { name: person.name })}
                      className="w-40"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectGroup>
                        {personItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button
                    prominence="tertiary"
                    size="sm"
                    disabled={pending}
                    onClick={() => void remove(person.accountId)}
                  >
                    {t("remove")}
                  </Button>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">{t(`roles.${person.role}`)}</span>
              )}
            </li>
          );
        })}
        <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="grid min-w-0 text-sm">
            <span className="font-medium">{t("general.title")}</span>
            <span className="text-muted-foreground">{t("general.hint")}</span>
          </div>
          {canChange ? (
            <Select
              items={memberItems}
              value={access.memberAccess}
              disabled={pending}
              onValueChange={(value) => void share(value as SetUseCaseMemberAccess["role"])}
            >
              <SelectTrigger aria-label={t("general.title")} className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {memberItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground">
              {t(`general.${access.memberAccess}`)}
            </span>
          )}
        </li>
      </ul>
    </div>
  );
}

export { UseCaseAccessPanel };
