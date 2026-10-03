import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { TextButton } from "@/components/actions/text-button";
import { Section } from "@/components/ui/section";
import { siteRoutes } from "@/lib/site";

type Founder = { photo: string; name: string; role: string; company: string };

/**
 * Founders from genaifund.ai › Meet the Leaders. Real people: name, role and company only, never a
 * quote they did not give.
 */
const founders: Founder[] = [
  {
    photo: "/founders/diego.jpg",
    name: "Diego Rojas",
    role: "CEO & Co-Founder",
    company: "Shieldbase",
  },
  {
    photo: "/founders/yuriy.jpg",
    name: "Yuriy Braterskyy",
    role: "Co-Founder",
    company: "Superagent",
  },
  {
    photo: "/founders/yewwai.jpg",
    name: "Yew Wai Kong",
    role: "Founder & CEO",
    company: "Ourteam",
  },
  { photo: "/founders/tuan.jpg", name: "Tuan Cao", role: "CEO", company: "LIFE AI" },
  {
    photo: "/founders/piyush.jpg",
    name: "Piyush Palkar",
    role: "Founder & CEO",
    company: "Fortii",
  },
  { photo: "/founders/trung.jpg", name: "Trung Huynh", role: "Founder", company: "Blaze AI" },
  { photo: "/founders/anh.jpg", name: "Anh Ta", role: "Founder & CEO", company: "Arcanic AI" },
  { photo: "/founders/hieu.jpg", name: "Hieu Nguyen", role: "Co-Founder", company: "Revve AI" },
];

/** One compact row of eight from `md`; two columns of avatar rows on phones. */
function Founders() {
  const t = useTranslations("Home.founders");

  return (
    <Section surface="muted">
      <div className="flex flex-col gap-7 py-14 md:gap-10 md:py-24">
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between md:gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-3xl font-semibold tracking-headline md:text-headline">
              {t("title")}
            </h2>
            <p className="text-lg text-muted-foreground">{t("description")}</p>
          </div>
          <TextButton href={siteRoutes.founders}>
            {t("seeAll")}
            <ArrowRightIcon aria-hidden="true" />
          </TextButton>
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-8 md:gap-4">
          {founders.map((founder) => (
            <li
              key={founder.name}
              className="flex items-center gap-2.5 md:flex-col md:items-stretch md:gap-1.5"
            >
              <Image
                src={founder.photo}
                alt={founder.name}
                width={320}
                height={320}
                sizes="(min-width: 768px) 10rem, 3rem"
                className="size-12 shrink-0 rounded-full object-cover md:aspect-square md:size-auto md:w-full md:rounded-xl"
              />
              <div className="flex min-w-0 flex-col gap-0.5 md:gap-1.5">
                <p className="text-sm font-semibold">{founder.name}</p>
                <p className="text-xs text-muted-foreground">
                  {founder.role} · {founder.company}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

export { Founders };
