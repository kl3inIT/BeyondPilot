"use client";

import { revalidateLogic } from "@tanstack/react-form";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { DataTable } from "@/components/composites/data-table";
import { FormDialog } from "@/components/composites/form-dialog";
import { Person } from "@/components/composites/person";
import { useAppForm, withFieldGroup } from "@/components/form/app-form";
import { fieldIds } from "@/components/form/field-ids";
import { useFieldValidity } from "@/components/form/form-context";
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
};

/**
 * The people who would work on the use case: each with the role typed for this proposal, and one of
 * them the primary contact the posting organization speaks to.
 */
const ProposalTeamStep = withFieldGroup({
  defaultValues: { team: [] as TeamRow[] },
  props: { members: [] } as ProposalTeamStepProps,
  render: function ProposalTeamStepRender({ group, members }) {
    return <group.AppField name="team">{() => <Team members={members} />}</group.AppField>;
  },
});

/**
 * The team as one field of the form. Its rows change through the functions of the draft, which keep
 * exactly one primary contact; a row that lacks its role is marked from what the row holds.
 */
function Team({ members }: ProposalTeamStepProps) {
  const t = useTranslations("UseCaseProposal.wizard.team");
  const { field, invalid, errors, ids } = useFieldValidity<TeamRow[]>();
  const [adding, setAdding] = useState(false);

  const team = field.state.value;
  const onTeam = field.handleChange;
  const candidateOf = (accountId: string) =>
    members.find((member) => member.accountId === accountId);
  const primary = team.find((member) => member.primary)?.accountId ?? "";
  const free = members.filter((member) => !team.some((row) => row.accountId === member.accountId));
  const worded = invalid && errors.some((error) => error?.message);
  const errorId = worded ? ids.error : undefined;
  // Roles are filled and still the team is refused: nobody, or more than one, is the primary contact.
  const noPrimary = invalid && team.every((row) => row.role.trim() !== "");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        {team.length > 0 ? (
          <p className="text-sm text-muted-foreground">{t("count", { count: team.length })}</p>
        ) : (
          <span />
        )}
        <Button prominence="secondary" disabled={free.length === 0} onClick={() => setAdding(true)}>
          {t("add")}
        </Button>
      </div>
      {team.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <RadioGroup
          value={primary}
          onValueChange={(next) => onTeam(setPrimary(team, String(next)))}
        >
          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">{t("columns.member")}</TableHead>
                <TableHead className="w-28">{t("columns.role")}</TableHead>
                <TableHead className="w-20 whitespace-normal">{t("columns.primary")}</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">{t("columns.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((row) => {
                const person = candidateOf(row.accountId);
                const name = person?.name ?? person?.email ?? "";
                const missing = invalid && row.role.trim() === "";
                return (
                  <TableRow key={row.accountId}>
                    <TableCell className="min-w-56">
                      <Person name={person?.name ?? null} email={person?.email ?? ""} wrapEmail />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={t("roleOf", { name })}
                        maxLength={maxRole}
                        value={row.role}
                        aria-invalid={missing || undefined}
                        aria-describedby={missing ? errorId : undefined}
                        placeholder={t("rolePlaceholder")}
                        onChange={(event) =>
                          onTeam(setRole(team, row.accountId, event.target.value))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <RadioGroupItem
                        value={row.accountId}
                        aria-label={t("primaryOf", { name })}
                        aria-invalid={noPrimary || undefined}
                        aria-describedby={noPrimary ? errorId : undefined}
                      />
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
      {worded && <FieldError id={errorId} errors={errors} />}
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
  /** The person chosen, or the first who can be added while none is. */
  const personOf = (chosen: string) =>
    candidates.some((person) => person.accountId === chosen)
      ? chosen
      : (candidates[0]?.accountId ?? "");
  const form = useAppForm({
    defaultValues: { accountId: "", role: "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({
        accountId: z.string(),
        role: z.string().refine((text) => text.trim() !== "", t("roleRequired")),
      }),
    },
    onSubmit: ({ value }) => onAdd(personOf(value.accountId), value.role),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      title={t("title")}
      submitLabel={t("submit")}
      cancelLabel={t("cancel")}
      submitDisabled={candidates.length === 0}
    >
      <form.Field name="accountId">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={fieldIds(field).control}>{t("person")}</FieldLabel>
            <NativeSelect
              id={fieldIds(field).control}
              value={personOf(field.state.value)}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            >
              {candidates.map((person) => (
                <NativeSelectOption key={person.accountId} value={person.accountId}>
                  {person.name ? `${person.name} · ${person.email}` : person.email}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
      </form.Field>
      <form.AppField name="role">
        {(field) => <field.TextField label={t("role")} maxLength={maxRole} />}
      </form.AppField>
    </FormDialog>
  );
}

export { ProposalTeamStep };
