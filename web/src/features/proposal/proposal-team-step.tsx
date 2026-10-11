"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { DataTable } from "@/components/composites/data-table";
import { Person } from "@/components/composites/person";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TeamCandidate } from "@/lib/api/generated";

import { addMember, removeMember, setPrimary, setRole, type TeamRow } from "./proposal-draft";

const maxRole = 120;

type ProposalTeamStepProps = {
  /** The people of the organization the proposal may name. */
  members: TeamCandidate[];
  team: TeamRow[];
  onTeam: (team: TeamRow[]) => void;
  /** Whether to say what is missing, once the person tried to go on. */
  checked: boolean;
};

/**
 * The people who would work on the use case: each with the role typed for this proposal, and one of
 * them the primary contact the posting organization speaks to.
 */
function ProposalTeamStep({ members, team, onTeam, checked }: ProposalTeamStepProps) {
  const t = useTranslations("UseCaseProposal.wizard.team");
  const [adding, setAdding] = useState(false);

  const candidateOf = (accountId: string) =>
    members.find((member) => member.accountId === accountId);
  const primary = team.find((member) => member.primary)?.accountId ?? "";
  const free = members.filter((member) => !team.some((row) => row.accountId === member.accountId));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("count", { count: team.length })}</p>
        <Button prominence="secondary" disabled={free.length === 0} onClick={() => setAdding(true)}>
          {t("add")}
        </Button>
      </div>
      {team.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm font-medium">{t("empty.title")}</p>
          <p className="text-sm text-muted-foreground">{t("empty.lead")}</p>
        </div>
      ) : (
        <RadioGroup
          value={primary}
          onValueChange={(next) => onTeam(setPrimary(team, String(next)))}
        >
          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.member")}</TableHead>
                <TableHead className="w-56">{t("columns.role")}</TableHead>
                <TableHead className="w-36">{t("columns.primary")}</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{t("columns.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((row) => {
                const person = candidateOf(row.accountId);
                const name = person?.name ?? person?.email ?? "";
                const missing = checked && row.role.trim() === "";
                return (
                  <TableRow key={row.accountId}>
                    <TableCell className="max-w-0">
                      <Person name={person?.name ?? null} email={person?.email ?? ""} />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={t("roleOf", { name })}
                        maxLength={maxRole}
                        value={row.role}
                        aria-invalid={missing || undefined}
                        placeholder={t("rolePlaceholder")}
                        onChange={(event) =>
                          onTeam(setRole(team, row.accountId, event.target.value))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <RadioGroupItem value={row.accountId} aria-label={t("primaryOf", { name })} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <IconButton
                          prominence="tertiary"
                          size="sm"
                          aria-label={t("remove", { name })}
                          onClick={() => onTeam(removeMember(team, row.accountId))}
                        >
                          <Trash2Icon aria-hidden="true" />
                        </IconButton>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
        </RadioGroup>
      )}
      {checked && team.length === 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t("needed.member")}
        </p>
      )}
      {checked && team.length > 0 && team.some((row) => row.role.trim() === "") && (
        <p role="alert" className="text-sm text-destructive">
          {t("needed.role")}
        </p>
      )}
      <AddMemberDialog
        open={adding}
        onOpenChange={setAdding}
        candidates={free}
        onAdd={(accountId, role) => {
          onTeam(addMember(team, accountId, role));
          setAdding(false);
        }}
      />
    </div>
  );
}

type AddMemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: TeamCandidate[];
  onAdd: (accountId: string, role: string) => void;
};

/** The popup in which a person of the organization joins the team with the role typed for them. */
function AddMemberDialog({ open, onOpenChange, candidates, onAdd }: AddMemberDialogProps) {
  const t = useTranslations("UseCaseProposal.wizard.team.dialog");
  const id = useId();
  const [chosen, setChosen] = useState("");
  const [role, setRoleText] = useState("");
  const [tried, setTried] = useState(false);

  const accountId = candidates.some((person) => person.accountId === chosen)
    ? chosen
    : (candidates[0]?.accountId ?? "");
  const roleMissing = tried && role.trim() === "";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role.trim() === "") {
      setTried(true);
      return;
    }
    onAdd(accountId, role);
    setChosen("");
    setRoleText("");
    setTried(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle size="lg">{t("title")}</DialogTitle>
            <DialogDescription>{t("lead")}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`${id}-person`}>{t("person")}</FieldLabel>
            <NativeSelect
              id={`${id}-person`}
              value={accountId}
              onChange={(event) => setChosen(event.target.value)}
            >
              {candidates.map((person) => (
                <NativeSelectOption key={person.accountId} value={person.accountId}>
                  {person.name ? `${person.name} · ${person.email}` : person.email}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field data-invalid={roleMissing || undefined}>
            <FieldLabel htmlFor={`${id}-role`}>{t("role")}</FieldLabel>
            <Input
              id={`${id}-role`}
              maxLength={maxRole}
              value={role}
              aria-invalid={roleMissing || undefined}
              onChange={(event) => setRoleText(event.target.value)}
            />
            {roleMissing && <FieldError>{t("roleRequired")}</FieldError>}
          </Field>
          <DialogFooter>
            <Button prominence="secondary" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={accountId === ""}>
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { ProposalTeamStep };
