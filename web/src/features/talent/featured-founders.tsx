import { useTranslations } from "next-intl";
import Image from "next/image";

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
 * The founders GenAI Fund features above the talent directory: peers in its network, not profiles
 * to contact. One row of eight portraits from `lg`; rows of a small portrait and the name below it.
 */
function FeaturedFounders() {
  const t = useTranslations("Talent.directory.founders");

  return (
    <section aria-labelledby="talent-founders" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="talent-founders" className="text-xl font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
        {founders.map((founder) => (
          <li
            key={founder.name}
            className="flex min-w-0 items-center gap-3 lg:flex-col lg:items-stretch lg:gap-1.5"
          >
            <Image
              src={founder.photo}
              alt=""
              width={192}
              height={192}
              sizes="(min-width: 64rem) 10rem, 3rem"
              className="size-12 shrink-0 rounded-full object-cover lg:aspect-square lg:size-auto lg:w-full lg:rounded-xl"
            />
            <div className="flex min-w-0 flex-col gap-0.5 lg:gap-1.5">
              <p className="text-sm font-semibold">{founder.name}</p>
              <p className="text-xs text-muted-foreground">
                {founder.role} · {founder.company}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { FeaturedFounders };
