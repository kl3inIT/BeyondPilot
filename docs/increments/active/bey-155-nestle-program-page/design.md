# BEY-155 — The page of Nestlé Vietnam AI Reinvention

Status: page implemented and tested ([plan](plan.md)); the program's data and its publication are open. The checks are in the [program test matrix](../../../tests/program.md#the-public-pages); the page kinds are in the [program specification](../../../specs/program.md#pages).

## Why

GenAI Fund ran this campaign on a page of its own (`nestleaihackathon.lovable.app`) and asked on 12 October 2026 to move it under Events & Programs like the Tasco challenge, "keeping the core UI unchanged", before the campaign goes to partners on 13 October.

## Outcome

- **A written page** for the address `nestle-vietnam-ai-reinvention` (`web/src/features/program/nestle/`), registered in `custom-pages.ts`. No backend, contract or schema change.
- **Same sections, order and wording as the campaign's page, less what only repeated** (decided on 12 October 2026: no deadline line above the page, no second "Start early" note in the dates, no closing links that only scroll): the hero with four facts, what the program offers, the six challenge areas, the program's use cases, how it works, who can apply with the six questions, the journey with the supporting activities, eight questions, the closing call and the note about the programme. The English is the client's; the Vietnamese is ours.
- **The program's data, not page copy:** the deadline in the line above the page, in the hero and in the closing call, the timeline, the events with their registration link, the card to apply and Apply itself. Dates the client wrote inside sentences ("Apply before 5 November", "Matching Day, 3 Dec") stay as written and change with the catalogs.
- **Images** under `web/public/programs/nestle/`: the key visual, the six area pictures, Nestlé's logo and the AI Hackathon 2026 logo, taken from the campaign's page and resized. The pictures and logos had a white ground, removed so they sit on any surface. The key visual keeps its white ground and stands as a white tile on the hero's blue band: cut out, its pastel glow left a halo on blue. `cover.webp` is the same tile on the band's blue, for the operator to upload as the program's cover.

## Decisions

### The page stands in BeyondPilot's frame, not the campaign's

The campaign's page had its own header, colours and a floating bar to apply. Here the site header and footer, the tokens and the shared parts of a program page replace them: the card to apply beside the content (first on a phone) is the floating bar, and the partners' logos stand under it. Nestlé's colour appears only in its logo and the pictures.

### The challenge areas are the registry tabs with one new variant

The six areas are `Tabs` in vertical orientation, a list beside one panel as on the campaign's page, stacked on a phone. The names are long and each carries a picture, which none of the existing variants holds, so `TabsList` gains `boxed`: bordered rows that wrap. The tabs are composed in a Server Component; the only client code is the primitive.

### Shared parts moved, not copied

`SectionHead` and `Note` were written for the Tasco page and now serve two pages, so they moved to `program-parts.tsx`.

### What was left out

The floating bar's "About 10 minutes" is not carried: the form here asks for more than the campaign's did, so the claim would not hold.
