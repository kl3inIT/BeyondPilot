import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { TextButton } from "@/components/actions/text-button";
import { Section } from "@/components/ui/section";
import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

type Founder = { photo: string; name: string; role: string; company: string };

/**
 * Founders from genaifund.ai › Meet the Leaders. Real people: name, role and company only, never a
 * quote they did not give. Narrow screens show the first four.
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

function Founders() {
  const t = useTranslations("Home.founders");

  return (
    <Section>
      <div className="flex flex-col gap-12 sm:gap-20">
        <div className="flex flex-col items-center gap-4 text-center sm:gap-9">
          <h2 className="text-3xl font-semibold text-balance sm:text-5xl sm:leading-none">
            {t("title")}
          </h2>
          <p className="max-w-145 text-base text-muted-foreground sm:text-xl sm:font-medium">
            {t("description")}
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-6 lg:px-8">
          {founders.map((founder, index) => (
            <li
              key={founder.name}
              className={index > 3 ? "hidden flex-col gap-3.5 md:flex" : "flex flex-col gap-3.5"}
            >
              <Image
                src={founder.photo}
                alt={founder.name}
                width={320}
                height={320}
                className="aspect-square w-full rounded-xl border object-cover lg:aspect-auto lg:h-65"
              />
              <div className="flex flex-col gap-0.5">
                <p className="font-medium">{founder.name}</p>
                <p className="text-sm text-muted-foreground">
                  {founder.role} · {founder.company}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <TextButton
          className="self-center md:hidden"
          nativeButton={false}
          render={<Link href={siteRoutes.founders} />}
        >
          {t("seeAll")}
          <ArrowRightIcon aria-hidden="true" />
        </TextButton>
      </div>
    </Section>
  );
}

export { Founders };
