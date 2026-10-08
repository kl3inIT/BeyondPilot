import { useTranslations } from "next-intl";
import Image from "next/image";

import { Section } from "@/components/ui/section";

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

/**
 * The ecosystem's founders, apart from the team: peers of BeyondPilot, not its members. One row of
 * eight round portraits from `lg`; two columns on phones.
 */
function Founders() {
  const t = useTranslations("Home.founders");

  return (
    <Section surface="muted">
      <div className="flex flex-col py-12 lg:py-20">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          {t("eyebrow")}
        </p>
        <h2 className="mt-4 text-3xl font-semibold lg:text-4xl lg:leading-10">{t("title")}</h2>
        <p className="mt-4 max-w-160 text-base text-muted-foreground">{t("description")}</p>
        <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 lg:mt-14 lg:grid-cols-8">
          {founders.map((founder) => (
            <li key={founder.name} className="flex min-w-0 flex-col gap-1">
              <Image
                src={founder.photo}
                alt=""
                width={192}
                height={192}
                sizes="6rem"
                className="mb-1 size-24 rounded-full object-cover"
              />
              <p className="text-sm leading-5 font-semibold">{founder.name}</p>
              <p className="text-xs text-muted-foreground">
                {founder.role}, {founder.company}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

export { Founders };
