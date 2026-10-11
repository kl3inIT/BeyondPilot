import { ArrowUpRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { TextButton } from "@/components/actions/text-button";
import { GenaiFundBacking } from "@/components/sections/team/genai-fund-backing";
import { Section } from "@/components/ui/section";

type Member = { id: string; name: string; photo: string; linkedin?: string };

/** Above the default 75, which smooths skin and the dark backdrop; allowed in `next.config.ts`. */
const PORTRAIT_QUALITY = 90;

/**
 * The people building BeyondPilot, with the role each of them has agreed to and the portrait each
 * of them supplied. A member without a public profile shows no LinkedIn link.
 */
const members: Member[] = [
  {
    id: "dat",
    name: "Phan Hồng Đạt",
    photo: "dat",
    linkedin: "https://www.linkedin.com/in/kl3init/",
  },
  {
    id: "viet",
    name: "Nhữ Xuân Việt",
    photo: "viet",
    linkedin: "https://www.linkedin.com/in/nhuxuanviet/",
  },
  {
    id: "nhat",
    name: "Nhữ Đình Nhật",
    photo: "nhat",
    linkedin: "https://www.linkedin.com/in/nhatnhu/",
  },
  {
    id: "ducAnh",
    name: "Nguyễn Đức Anh",
    photo: "duc-anh",
    linkedin: "https://www.linkedin.com/in/nguyen-duc-anh-7b0064362/",
  },
  {
    id: "nhatAnh",
    name: "Phạm Nhật Anh",
    photo: "nhat-anh",
    linkedin: "https://www.linkedin.com/in/ph%E1%BA%A1m-nh%E1%BA%ADt-anh-231b01333/",
  },
];

/**
 * The About page: the development partner's engineers and how GenAI Fund stands behind
 * BeyondPilot. Type and space carry it: a large statement, then each person's portrait with their
 * name under it, without cards.
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
        <div className="mt-16 flex flex-col gap-2 border-t pt-10 lg:mt-24">
          <h2 className="text-2xl font-semibold">{t("partnerTitle")}</h2>
          <p className="text-base text-muted-foreground">{t("partnerDescription")}</p>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-5">
          {members.map(({ id, name, photo, linkedin }) => (
            <li key={id} className="flex flex-col">
              <Image
                src={`/team/${photo}.jpg`}
                alt=""
                width={810}
                height={1080}
                quality={PORTRAIT_QUALITY}
                sizes="(min-width: 1024px) 240px, (min-width: 768px) 30vw, 45vw"
                className="aspect-3/4 w-full rounded-2xl object-cover"
              />
              <h3 className="mt-4 text-lg font-medium">{name}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{t("role")}</p>
              {linkedin && (
                <TextButton
                  href={linkedin}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t("linkedinLabel", { name })}
                  className="mt-2 self-start text-sm font-medium text-muted-foreground"
                >
                  {t("linkedin")}
                  <ArrowUpRightIcon aria-hidden="true" />
                </TextButton>
              )}
            </li>
          ))}
        </ul>
      </div>
      <GenaiFundBacking />
    </Section>
  );
}

export { Team };
