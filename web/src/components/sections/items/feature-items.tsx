import {
  ArrowRightIcon,
  BellIcon,
  FilePenIcon,
  InboxIcon,
  ListChecksIcon,
  LogInIcon,
  TargetIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { Section } from "@/components/ui/section";
import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

type Item = { icon: LucideIcon; title: string; text: string };

function ItemGroup({
  label,
  items,
  link,
}: {
  label: string;
  items: Item[];
  link: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </h3>
      <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Icon className="size-6 shrink-0" aria-hidden="true" />
              {title}
            </p>
            <p className="text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
      <TextButton nativeButton={false} render={<Link href={link.href} />}>
        {link.label}
        <ArrowRightIcon aria-hidden="true" />
      </TextButton>
    </div>
  );
}

function FeatureItems() {
  const t = useTranslations("Home.items");

  return (
    <Section>
      <div className="flex flex-col gap-20">
        <h2 className="text-center text-3xl font-semibold text-balance sm:text-5xl sm:leading-none">
          {t("title")}
        </h2>
        <div className="flex flex-col gap-12">
          <ItemGroup
            label={t("providers")}
            link={{ href: siteRoutes.programs, label: t("browse") }}
            items={[
              { icon: UserRoundIcon, title: t("profile"), text: t("profileText") },
              { icon: LogInIcon, title: t("context"), text: t("contextText") },
              { icon: FilePenIcon, title: t("drafts"), text: t("draftsText") },
              { icon: UsersIcon, title: t("teams"), text: t("teamsText") },
            ]}
          />
          <ItemGroup
            label={t("enterprises")}
            link={{ href: siteRoutes.publishUseCase, label: t("publish") }}
            items={[
              { icon: InboxIcon, title: t("rolling"), text: t("rollingText") },
              { icon: ListChecksIcon, title: t("shortlists"), text: t("shortlistsText") },
              { icon: TargetIcon, title: t("matched"), text: t("matchedText") },
              { icon: BellIcon, title: t("outcomes"), text: t("outcomesText") },
            ]}
          />
        </div>
      </div>
    </Section>
  );
}

export { FeatureItems };
