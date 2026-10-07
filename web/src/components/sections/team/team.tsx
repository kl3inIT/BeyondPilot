import { cn } from "cn";
import { ArrowUpRightIcon, UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { TextButton } from "@/components/actions/text-button";
import { Section } from "@/components/ui/section";

type Member = { id: string; name: string; tint: string; linkedin?: string };

/**
 * The people building BeyondPilot, with the role each of them has agreed to. Photos arrive with
 * their owners' consent; until then a person's tint stands in. A member without a public profile
 * shows no LinkedIn link.
 */
const members: Member[] = [
  {
    id: "dat",
    name: "Phan Hồng Đạt",
    tint: "bg-sky text-sky-foreground",
    linkedin: "https://www.linkedin.com/in/kl3init/",
  },
  {
    id: "viet",
    name: "Nhữ Xuân Việt",
    tint: "bg-lilac text-lilac-foreground",
    linkedin: "https://www.linkedin.com/in/nhuxuanviet/",
  },
  {
    id: "nhat",
    name: "Nhữ Đình Nhật",
    tint: "bg-peach text-peach-foreground",
    linkedin: "https://www.linkedin.com/in/nhatnhu/",
  },
  { id: "ducAnh", name: "Nguyễn Đức Anh", tint: "bg-mint text-mint-foreground" },
  {
    id: "nhatAnh",
    name: "Phạm Nhật Anh",
    tint: "bg-rose text-rose-foreground",
    linkedin: "https://www.linkedin.com/in/ph%E1%BA%A1m-nh%E1%BA%ADt-anh-231b01333/",
  },
];

/** The core team and how GenAI Fund stands behind it. */
function Team() {
  const t = useTranslations("Home.team");
  const s = useTranslations("Site");

  return (
    <Section>
      <div className="flex flex-col pb-8">
        <p className="text-copy font-semibold text-primary">{t("eyebrow")}</p>
        <h2 className="mt-3 text-4xl font-semibold tracking-headline lg:text-section lg:tracking-section">
          {t("title")}
        </h2>
        <p className="mt-3 max-w-175 text-base text-muted-foreground lg:text-lg">
          {t("description")}
        </p>
        <ul className="mt-9 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {members.map(({ id, name, tint, linkedin }) => (
            <li key={id} className="flex flex-col rounded-2xl border bg-card p-2 shadow-tile">
              <div
                className={cn(
                  "flex aspect-227/170 items-end justify-center overflow-hidden rounded-xl",
                  tint,
                )}
              >
                <UserRoundIcon className="size-3/4 fill-current opacity-60" aria-hidden="true" />
              </div>
              <div className="flex min-h-26 flex-col px-3 pt-4 pb-5">
                <h3 className="text-lg font-semibold">{name}</h3>
                <p className="mt-1 text-sm text-primary">{t("role")}</p>
                {linkedin && (
                  <TextButton
                    href={linkedin}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t("linkedinLabel", { name })}
                    className="mt-3 self-start text-caption font-medium text-muted-foreground"
                  >
                    {t("linkedin")}
                    <ArrowUpRightIcon aria-hidden="true" />
                  </TextButton>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-col gap-6 rounded-3xl bg-foreground p-8 text-background lg:flex-row lg:gap-20 lg:px-10 lg:py-10">
          <div className="flex flex-col gap-3.5 lg:w-90 lg:shrink-0">
            <Image
              src="/brand/genaifund-logo-white.png"
              alt={s("genaiFund")}
              width={1200}
              height={254}
              className="h-10 w-auto self-start dark:hidden"
            />
            <Image
              src="/brand/genaifund-logo.png"
              alt={s("genaiFund")}
              width={1200}
              height={252}
              className="hidden h-10 w-auto self-start dark:block"
            />
            <h3 className="text-2xl font-semibold">{t("backing.title")}</h3>
          </div>
          <p className="max-w-185 text-copy text-background/80 lg:leading-6">
            {t("backing.description")}
          </p>
        </div>
      </div>
    </Section>
  );
}

export { Team };
