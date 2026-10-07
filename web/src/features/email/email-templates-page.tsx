import { ChevronRightIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { EmailTemplateList } from "@/lib/api/generated";
import { adminEmailTemplateRoute, siteRoutes } from "@/lib/site";

import { EmailHeader } from "./email-header";
import { isEmailKind, KindIcon } from "./email-kinds";

const groups = [
  "sign_in",
  "organizations",
  "applications",
  "introductions",
  "solutions",
  "use_cases",
  "talent",
] as const;

/**
 * Admin › Email › Templates: every kind of email operators word, by the part of BeyondPilot that
 * sends it, with the shared appearance on top. A kind whose wording an operator changed says so and
 * by whom.
 */
async function EmailTemplatesPage({
  templates,
  ready,
}: {
  templates: EmailTemplateList;
  ready: boolean;
}) {
  const [t, format] = await Promise.all([getTranslations("Admin.email"), getFormatter()]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <EmailHeader current="templates" ready={ready} />

      <section className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center">
        <div className="flex flex-1 flex-col gap-0.5">
          <h2 className="text-sm font-medium">{t("templates.appearance.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("templates.appearance.description")}</p>
        </div>
        <Button prominence="secondary" size="sm" href={siteRoutes.adminEmailAppearance}>
          {t("templates.appearance.action")}
        </Button>
      </section>

      {groups.map((group) => {
        const items = templates.items.filter((item) => item.group === group);
        if (items.length === 0) {
          return null;
        }
        return (
          <section key={group} className="flex flex-col gap-2" aria-labelledby={`group-${group}`}>
            <h2 id={`group-${group}`} className="text-sm font-medium text-muted-foreground">
              {t(`groups.${group}`)}
            </h2>
            <ul className="overflow-hidden rounded-lg border">
              {items.map((item) => (
                <li key={item.kind} className="border-b last:border-b-0">
                  <Link
                    href={adminEmailTemplateRoute(item.kind)}
                    className="flex items-center gap-3 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
                  >
                    <KindIcon
                      kind={item.kind}
                      className="size-4.5 shrink-0 text-muted-foreground"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {isEmailKind(item.kind) ? t(`kinds.${item.kind}.name`) : item.kind}
                        </span>
                        {item.edited && <Badge variant="outline">{t("templates.edited")}</Badge>}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {isEmailKind(item.kind)
                          ? t(`kinds.${item.kind}.description`)
                          : item.subject}
                      </span>
                    </span>
                    {item.edited && item.updatedBy && item.updatedAt && (
                      <span className="hidden text-xs text-muted-foreground md:block">
                        {t("templates.editedBy", {
                          name: item.updatedBy,
                          when: format.dateTime(new Date(item.updatedAt), {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            hourCycle: "h23",
                          }),
                        })}
                      </span>
                    )}
                    <ChevronRightIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export { EmailTemplatesPage };
