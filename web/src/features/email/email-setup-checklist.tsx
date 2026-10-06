"use client";

import {
  CheckIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleHelpIcon,
  CircleXIcon,
  ClockIcon,
  CopyIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/actions/button";
import { DataTable } from "@/components/composites/data-table";
import { Spinner } from "@/components/ui/spinner";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { checkEmailSetup, type EmailSetup } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

type State = EmailSetup["checks"][number]["state"];

/** Each state as an icon in its colour: the word beside it carries the meaning. */
const stateIcons: Record<State, { Icon: typeof CircleCheckIcon; className: string }> = {
  ok: { Icon: CircleCheckIcon, className: "text-success" },
  pending: { Icon: ClockIcon, className: "text-warning" },
  failed: { Icon: CircleXIcon, className: "text-destructive" },
  unknown: { Icon: CircleHelpIcon, className: "text-muted-foreground" },
};

function StateIcon({ state }: { state: State }) {
  const { Icon, className } = stateIcons[state];
  return <Icon aria-hidden="true" className={cn("size-4 shrink-0", className)} />;
}

/** A value to paste into the DNS host, with a button that copies it. */
function Copyable({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <code className="min-w-0 truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
        {value}
      </code>
      <button
        type="button"
        aria-label={label}
        onClick={() =>
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          })
        }
        className="hit-area flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {copied ? (
          <CheckIcon aria-hidden="true" className="size-3.5" />
        ) : (
          <CopyIcon aria-hidden="true" className="size-3.5" />
        )}
      </button>
    </span>
  );
}

/**
 * What the saved provider says about sending from the sender's domain, asked when the screen opens and again on
 * demand: each step of the setup, then the DNS records to publish with what the provider found of each.
 */
function EmailSetupChecklist() {
  const t = useTranslations("Admin.email.checks");
  const format = useFormatter();
  const [setup, setSetup] = useState<EmailSetup | null>(null);
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(true);

  // The answer is set when it arrives; asking again first shows that it is being asked.
  const ask = useCallback(
    () =>
      checkEmailSetup()
        .then(({ data }) => {
          setSetup(data);
          setFailed(false);
        })
        .catch(() => setFailed(true))
        .finally(() => setChecking(false)),
    [],
  );

  function check() {
    setChecking(true);
    void ask();
  }

  useEffect(() => {
    void ask();
  }, [ask]);

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border p-4 md:p-5"
      aria-labelledby="email-checks"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="email-checks" className="text-base font-medium">
            {t("title")}
            {setup && setup.checks.length > 0 && (
              <span className="font-normal text-muted-foreground">
                {" · "}
                {t("done", {
                  done: setup.checks.filter((item) => item.state === "ok").length,
                  total: setup.checks.length,
                })}
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            {setup
              ? t("lead", {
                  domain: setup.domain,
                  when: format.dateTime(new Date(setup.checkedAt), {
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                  }),
                })
              : t("leadChecking")}
          </p>
        </div>
        <Button prominence="secondary" size="sm" pending={checking} onClick={check}>
          <RefreshCwIcon aria-hidden="true" />
          {t("again")}
        </Button>
      </div>

      {checking && !setup && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          {t("checking")}
        </p>
      )}
      {failed && <p className="text-sm text-destructive">{t("failed")}</p>}

      {setup && setup.provider === "smtp" && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <CircleDashedIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("smtp")}
        </p>
      )}

      {setup?.limit && (
        <p className="flex items-start gap-2 text-sm">
          <CircleHelpIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          {t(`limits.${setup.limit}.${setup.provider === "ses" ? "ses" : "resend"}`)}
        </p>
      )}

      {setup && setup.checks.length > 0 && (
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {setup.checks.map((item) => (
            <li key={item.step} className="flex items-start gap-2 text-sm">
              <StateIcon state={item.state} />
              <span className="flex flex-col">
                <span className="font-medium">{t(`steps.${item.step}.${item.state}`)}</span>
                {item.state !== "ok" && (
                  <span className="text-xs text-muted-foreground">
                    {t(`steps.${item.step}.next`)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {setup && setup.records.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("records.title", { domain: setup.domain })}</h3>
          {/* From 768px: a table. Below it, one stacked record each, never a table scrolled sideways. */}
          <DataTable className="hidden md:block">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">{t("records.status")}</TableHead>
                <TableHead className="w-20">{t("records.type")}</TableHead>
                <TableHead>{t("records.host")}</TableHead>
                <TableHead>{t("records.value")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {setup.records.map((record) => (
                <TableRow key={`${record.purpose}-${record.type}-${record.host}`}>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <StateIcon state={record.state} />
                      <span className="text-xs">{t(`records.states.${record.state}`)}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">
                      {record.type}
                      {record.priority != null && ` ${record.priority}`}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Copyable
                      value={record.host}
                      label={t("records.copy", { what: record.host })}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="flex max-w-md min-w-0 flex-col gap-0.5">
                      <Copyable
                        value={record.value}
                        label={t("records.copy", { what: record.type })}
                      />
                      {record.purpose === "dmarc" && (
                        <span className="text-xs whitespace-normal text-muted-foreground">
                          {t("records.dmarc")}
                        </span>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
          <ul className="flex flex-col divide-y rounded-lg border md:hidden">
            {setup.records.map((record) => (
              <li
                key={`${record.purpose}-${record.type}-${record.host}`}
                className="flex flex-col gap-1.5 p-3"
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <StateIcon state={record.state} />
                  {t(`records.states.${record.state}`)}
                  <span className="font-mono text-muted-foreground">
                    · {record.type}
                    {record.priority != null && ` ${record.priority}`}
                  </span>
                </span>
                <Copyable value={record.host} label={t("records.copy", { what: record.host })} />
                <Copyable value={record.value} label={t("records.copy", { what: record.type })} />
                {record.purpose === "dmarc" && (
                  <span className="text-xs whitespace-normal text-muted-foreground">
                    {t("records.dmarc")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export { EmailSetupChecklist };
