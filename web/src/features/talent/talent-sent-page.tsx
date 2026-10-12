import { SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { SentTalentEnquiry } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { TalentSent } from "./talent-sent";

/**
 * "Messages you sent": what the caller wrote to people in AI talent and what became of each. A
 * person who has written to nobody is shown how a message travels and the way to the directory.
 */
function TalentSentPage({ enquiries }: { enquiries: SentTalentEnquiry[] }) {
  const t = useTranslations("Talent.sent");
  const waiting = enquiries.filter((enquiry) => enquiry.status === "pending").length;

  return (
    <div className="flex flex-1 flex-col bg-muted">
      <div className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-5 pt-8 pb-16 md:px-8 md:pt-12 md:pb-24 xl:px-16 desktop:px-20">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-3xl leading-none font-semibold tracking-title md:text-5xl md:leading-none">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("lead")}</p>
        </div>
        {enquiries.length > 0 ? (
          <section aria-labelledby="talent-sent-list" className="flex flex-col gap-3">
            <h2 id="talent-sent-list" className="flex items-baseline gap-2 font-medium">
              {t("listTitle")}
              {waiting > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  {t("waiting", { count: waiting })}
                </span>
              )}
            </h2>
            <TalentSent enquiries={enquiries} />
          </section>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2 xl:gap-6">
            <Card size="lg">
              <CardContent>
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SendIcon aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>
                      <h2>{t("none.title")}</h2>
                    </EmptyTitle>
                    <EmptyDescription>{t("none.lead")}</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button href={siteRoutes.talent}>{t("browse")}</Button>
                  </EmptyContent>
                </Empty>
              </CardContent>
            </Card>
            <Card size="lg">
              <CardHeader>
                <CardTitle>
                  <h2>{t("how.title")}</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex list-decimal flex-col gap-2 pl-5 text-muted-foreground">
                  <li>{t("how.write")}</li>
                  <li>{t("how.answer")}</li>
                  <li>{t("how.share")}</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export { TalentSentPage };
