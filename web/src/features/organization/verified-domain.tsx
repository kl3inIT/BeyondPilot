"use client";

import { useEffect, useState } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { getAdminOrganization, type AdminOrganization } from "@/lib/api/generated";

import { domainOf, isDomain } from "./organization-format";

/** The record of an organization, read when a decision dialog opens; `null` until it arrives or when it cannot be read. */
function useAdminOrganization(id: string): AdminOrganization | null {
  const [detail, setDetail] = useState<AdminOrganization | null>(null);

  useEffect(() => {
    let current = true;
    getAdminOrganization({ path: { id } })
      .then(({ data }) => current && setDetail(data))
      // Without the record the dialog still says what the list knows.
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [id]);

  return detail;
}

/** What is wrong with the domain an operator vouches for, when something is. */
type DomainProblem = "invalid" | "taken" | null;

/**
 * The email domain an operator verifies with a decision. It starts from what the backend proposes,
 * and stays empty when the operator vouches for none.
 */
function useVerifiedDomain(suggested: string | null | undefined) {
  // Null until the operator types, so the proposal can still arrive after the dialog opened.
  const [typed, setTyped] = useState<string | null>(null);
  const [problem, setProblem] = useState<DomainProblem>(null);
  const text = typed ?? suggested ?? "";

  return {
    text,
    problem,
    change(next: string) {
      setTyped(next);
      setProblem(null);
    },
    /** The domain to send, `null` for none; `undefined` when what was typed names no domain. */
    read(): string | null | undefined {
      const domain = domainOf(text);
      if (domain === "") {
        return null;
      }
      if (!isDomain(domain)) {
        setProblem("invalid");
        return undefined;
      }
      return domain;
    },
    /** Marks the field when the backend refused the domain; says whether it did. */
    refused(error: unknown): boolean {
      if (error instanceof ApiError && error.code === "ORGANIZATION_DOMAIN_TAKEN") {
        setProblem("taken");
        return true;
      }
      return false;
    },
  };
}

type VerifiedDomainFieldProps = {
  id: string;
  domain: ReturnType<typeof useVerifiedDomain>;
  label: string;
  hint: string;
  /** The words for each problem. */
  problems: Record<Exclude<DomainProblem, null>, string>;
  disabled?: boolean;
};

/** The field of a decision dialog where an operator confirms the organization's email domain. */
function VerifiedDomainField({
  id,
  domain,
  label,
  hint,
  problems,
  disabled,
}: VerifiedDomainFieldProps) {
  const invalid = domain.problem !== null;

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="url"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        maxLength={253}
        placeholder="example.com"
        value={domain.text}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(event) => domain.change(event.target.value)}
      />
      {domain.problem ? (
        <FieldError>{problems[domain.problem]}</FieldError>
      ) : (
        <FieldDescription>{hint}</FieldDescription>
      )}
    </Field>
  );
}

export { useAdminOrganization, useVerifiedDomain, VerifiedDomainField };
