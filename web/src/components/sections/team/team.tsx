import { ArrowUpRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { GenaiFundBacking } from "@/components/sections/team/genai-fund-backing";
import { Section } from "@/components/ui/section";

type Member = { id: string; name: string; linkedin?: string };

/**
 * The people building BeyondPilot, with the role each of them has agreed to. A member without a
 * public profile shows no LinkedIn link.
 */
const members: Member[] = [
  { id: "dat", name: "Phan Hồng Đạt", linkedin: "https://www.linkedin.com/in/kl3init/" },
  { id: "viet", name: "Nhữ Xuân Việt", linkedin: "https://www.linkedin.com/in/nhuxuanviet/" },
  { id: "nhat", name: "Nhữ Đình Nhật", linkedin: "https://www.linkedin.com/in/nhatnhu/" },
  {
    id: "ducAnh",
    name: "Nguyễn Đức Anh",
    linkedin: "https://www.linkedin.com/in/nguyen-duc-anh-7b0064362/",
  },
  {
    id: "nhatAnh",
    name: "Phạm Nhật Anh",
    linkedin: "https://www.linkedin.com/in/ph%E1%BA%A1m-nh%E1%BA%ADt-anh-231b01333/",
  },
];

/**
 * The About page: the development partner's engineers and how GenAI Fund stands behind
 * BeyondPilot. Type and space carry it: a large statement, then each person under a hairline,
 * without cards or stand-in portraits.
 */
function Team() {
  const t = useTranslations("About");

  return (
    <Section>
      <div className="flex flex-col py-16 lg:py-28">
        <p className="text-copy font-semibold text-primary">{t("eyebrow")}</p>
        <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-headline lg:text-display lg:tracking-display">
          {t("title")}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground lg:text-xl">
          {t("description")}
        </p>
        {/* BeyondPilot's own leads join here, above the partner, once their profiles are agreed. */}
        <div className="mt-16 flex flex-col gap-8 border-t pt-10 lg:mt-24 lg:flex-row lg:gap-16">
          <div className="flex flex-col gap-2 lg:w-72 lg:shrink-0">
            <h2 className="text-2xl font-semibold">{t("partnerTitle")}</h2>
            <p className="text-base text-muted-foreground">{t("partnerDescription")}</p>
          </div>
          <ul className="grid flex-1 gap-x-10 sm:grid-cols-2">
            {members.map(({ id, name, linkedin }) => (
              <li key={id} className="flex items-center justify-between gap-4 border-b py-5">
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-xl font-medium">{name}</h3>
                  <p className="text-sm text-muted-foreground">{t("role")}</p>
                </div>
                {linkedin && (
                  <TextButton
                    href={linkedin}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t("linkedinLabel", { name })}
                    className="shrink-0 text-sm font-medium text-muted-foreground"
                  >
                    {t("linkedin")}
                    <ArrowUpRightIcon aria-hidden="true" />
                  </TextButton>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <GenaiFundBacking />
    </Section>
  );
}

export { Team };
