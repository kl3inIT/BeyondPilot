import { describe, expect, it } from "vitest";

import type { AdminProgram } from "@/lib/api/generated";

import { eventOf, keyDateOf, saveBodyOf, settingsValuesOf } from "./program-values";

const program: AdminProgram = {
  id: "5f7b6b3e-0000-4000-8000-000000000001",
  slug: "insurance-ai-tasco",
  slugFixed: false,
  publishIssues: [],
  name: "AI for Insurance Challenge × Tasco",
  type: "enterprise_challenge",
  partnerName: "Tasco",
  summary: "In Vietnam, insurance is still a piece of paper you can lose.",
  about: null,
  startsOn: "2026-09-23",
  endsOn: "2026-12-05",
  status: "draft",
  pageKind: "custom",
  externalUrl: null,
  coverFileId: null,
  applications: {
    opensAt: "2026-09-22T17:00:00Z",
    closesAt: "2026-10-15T16:59:00Z",
    shortlistSize: 10,
    outcomesDueOn: "2026-10-16",
    allowUpdatesUntilClose: true,
  },
  keyDates: [
    {
      title: "Briefing with Tasco's business team",
      startsAt: "2026-10-07T08:30:00Z",
      endsAt: "2026-10-07T10:00:00Z",
      allDay: false,
      note: "Online",
    },
    {
      title: "Tasco decides",
      startsAt: "2026-12-04T17:00:00Z",
      endsAt: null,
      allDay: true,
      note: null,
    },
  ],
  events: [
    {
      title: "Stop Guessing What Insurers Need: Tasco Challenge Briefing",
      startsAt: "2026-10-07T08:30:00Z",
      endsAt: null,
      online: true,
      city: null,
      country: null,
      registrationUrl: null,
    },
  ],
  version: 3,
  createdAt: "2026-09-20T03:00:00Z",
  updatedAt: "2026-10-05T03:00:00Z",
};

describe("Settings values", () => {
  it("show the window and the key dates in Vietnam time", () => {
    const values = settingsValuesOf(program);
    expect(values).toMatchObject({
      opensDay: "2026-09-23",
      opensTime: "00:00",
      closesDay: "2026-10-15",
      closesTime: "23:59",
      shortlistSize: "10",
      takesApplications: true,
    });
    expect(values.keyDates[0]).toMatchObject({ day: "2026-10-07", from: "15:30", to: "17:00" });
    expect(values.keyDates[1]).toMatchObject({ day: "2026-12-05", from: "", allDay: true });
  });

  it("send back the program they were made from", () => {
    expect(saveBodyOf(settingsValuesOf(program))).toEqual({
      version: 3,
      name: program.name,
      slug: program.slug,
      type: program.type,
      partnerName: "Tasco",
      summary: program.summary,
      about: null,
      startsOn: "2026-09-23",
      endsOn: "2026-12-05",
      pageKind: "custom",
      externalUrl: null,
      coverFileId: null,
      applications: {
        opensAt: "2026-09-22T17:00:00.000Z",
        closesAt: "2026-10-15T16:59:00.000Z",
        shortlistSize: 10,
        outcomesDueOn: "2026-10-16",
        allowUpdatesUntilClose: true,
      },
      keyDates: [
        {
          title: "Briefing with Tasco's business team",
          startsAt: "2026-10-07T08:30:00.000Z",
          endsAt: "2026-10-07T10:00:00.000Z",
          allDay: false,
          note: "Online",
        },
        {
          title: "Tasco decides",
          startsAt: "2026-12-04T17:00:00.000Z",
          endsAt: null,
          allDay: true,
          note: null,
        },
      ],
      events: [
        {
          title: "Stop Guessing What Insurers Need: Tasco Challenge Briefing",
          startsAt: "2026-10-07T08:30:00.000Z",
          endsAt: null,
          online: true,
          city: null,
          country: null,
          registrationUrl: null,
        },
      ],
    });
  });

  it("drop the window when applications are not taken, and the place of an online event", () => {
    expect(
      saveBodyOf({ ...settingsValuesOf(program), takesApplications: false }).applications,
    ).toBeUndefined();
    expect(
      eventOf({
        title: "Briefing",
        startsDay: "2026-10-07",
        startsTime: "15:30",
        endsDay: "",
        endsTime: "",
        online: true,
        city: "Hanoi",
        country: "Vietnam",
        registrationUrl: " ",
      }),
    ).toMatchObject({ city: null, country: null, registrationUrl: null, endsAt: null });
    expect(
      keyDateOf({
        title: " Demo day ",
        day: "2026-10-22",
        from: "14:00",
        to: "",
        allDay: false,
        note: "",
      }),
    ).toEqual({
      title: "Demo day",
      startsAt: "2026-10-22T07:00:00.000Z",
      endsAt: null,
      allDay: false,
      note: null,
    });
  });
});
