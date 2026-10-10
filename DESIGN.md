---
name: BeyondPilot
description: Enterprise AI challenges, solved together. Programs, use cases, solutions and talent from GenAI Fund partners.
colors:
  ink: "oklch(0.219 0.043 253.881)"
  paper: "oklch(1 0 0)"
  cool-paper: "oklch(0.981 0.005 247.876)"
  quiet-text: "oklch(0.473 0.045 255.743)"
  wash: "oklch(0.957 0.014 247.971)"
  hairline: "oklch(0.934 0.013 251.563)"
  field-line: "oklch(0.918 0.017 250.849)"
  azure: "oklch(0.536 0.15 249.661)"
  azure-foreground: "oklch(1 0 0)"
  sky: "oklch(0.754 0.139 232.661)"
  sky-mist: "oklch(0.891 0.054 233.88)"
  use-case: "oklch(0.555 0.146 48.998)"
  solution: "oklch(0.508 0.105 165.612)"
  talent: "oklch(0.586 0.222 17.585)"
  success: "oklch(0.527 0.154 150.069)"
  warning: "oklch(0.666 0.179 58.318)"
  danger: "oklch(0.577 0.245 27.325)"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 6vw, 4.5rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 3vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  lead:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  meta:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  3xl: "22px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "14": "56px"
  "18": "72px"
  "24": "96px"
  "28": "112px"
components:
  button-primary:
    backgroundColor: "{colors.azure}"
    textColor: "{colors.azure-foreground}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "36px"
    typography: "{typography.label}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "36px"
  button-tertiary:
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "36px"
  badge-status:
    backgroundColor: "{colors.success}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "16px 18px"
  floating-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "8px"
  stage-pill:
    backgroundColor: "{colors.azure}"
    textColor: "{colors.azure-foreground}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
    typography: "{typography.label}"
  search-bar:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "8px 8px 8px 24px"
  nav-link:
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    typography: "{typography.label}"
---

<!-- Rewritten on 3 October 2026 from the approved Figma landing ("BeyondPilot — Product UI", Screens, section "Landing — review"). The token values are what web/src/styles/tokens.css ships and what the Figma Theme collections hold. -->

# Design System: BeyondPilot

## Overview

**Creative North Star: "The Open Floor"**

BeyondPilot is the floor where an enterprise brief, the people who can answer it and GenAI Fund's programs meet. The page is cool paper in daylight: navy ink, one confident azure, and a sky-blue light that rises behind the search. Real things float on that floor: a demo-day photo, the next meetup, a founder, a partner logo. Each one is a fact you could click, never decoration.

The landing is Persuade mode: one question ("Your next AI pilot starts here."), one search, and a timeline that answers "what can I join now?". App surfaces (directories, application forms, the candidate board) are the Operate mode of the same floor: the same ink, paper and azure, denser and with less light.

GenAI Fund has not provided a BeyondPilot identity. Until it does, this palette is the team's own; purple and indigo are rejected.

**Key Characteristics:**

- Navy ink on cool paper, hairlines over boxes, azure for the one action that matters.
- Inter for everything; hierarchy from size and weight.
- Sky light (glows, the rising arc) on marketing surfaces only, never as information.
- Real content floats; nothing invented floats.
- Three directory kinds keep one accent each: amber use cases, emerald solutions, rose talent.

## Colors

A cool azure system with a sky light, three directory accents and the status roles; dark mode mirrors every role in `web/src/styles/tokens.css` and in the Figma `Theme/Dark` collection.

### Primary

- **Azure** (`colors.azure`, token `primary`): primary buttons, links, the active tab, the "Open now" stage, countdowns. 4.9:1 on cool paper and 5.2:1 on paper, so it is safe for text at any size. In dark mode it becomes Sky.

### Light

- **Sky** (`colors.sky`, token `brand`) and **Sky Mist** (`colors.sky-mist`, token `brand-foreground`): the hero glow, the rising arc, the eyebrow on the live campaign cover. Light only.

### Neutral

- **Ink** (`colors.ink`, token `foreground`): headings and body text.
- **Paper** (`colors.paper`, token `background`/`card`): cards and white sections.
- **Cool Paper** (`colors.cool-paper`, token `muted`/`secondary`): the page and alternating sections (hero, Programs and events, Founders).
- **Quiet Text** (`colors.quiet-text`, token `muted-foreground`): metadata, captions, supporting copy.
- **Wash** (`colors.wash`, token `accent`): hover fills and the quiet "Done" stage.
- **Hairline** (`colors.hairline`, token `border`) and **Field Line** (`colors.field-line`, token `input`): borders, dividers, outlines.

### Directory kinds

- **Use case** (`colors.use-case`), **Solution** (`colors.solution`), **Talent** (`colors.talent`): the icon and tab accent of each kind, and the hue of its card cover (`cover/use-case`, `cover/solution`, `cover/talent` paint styles). Always with the kind's name.

### Status

- **Success**, **Warning**, **Danger**: Live, Upcoming, Closed and destructive actions; always with a word.

### Highlight

- **Highlight** (token `highlight`) and **Highlight Line** (token `highlight-line`): the marker over a vendor's quoted words on a page of their deck, and the line under them. A deck page is a white sheet by day and at night, so both are the same in the two themes. The marker is translucent, never alone: the line under it, or a sentence, says the same. Not yet a variable in Figma.

### Logo

- The logo is GenAI Fund's approved kit, used as supplied: a purple tile (`#633ADB`) with a white B and a small GenAI Fund accent, beside a heavy wordmark, charcoal by day (`beyondpilot-logo.svg`) and white at night (`beyondpilot-logo-dark.svg`). Never recoloured, stretched, shadowed or given a gradient; its file carries its own clear space.
- Wherever the icon is drawn small (the browser tab, the admin sidebar, the consent screen) it is the small-size form without the accent (`beyondpilot-icon.svg`).
- The logo's purple belongs to the logo. It is not a token and colours nothing else in the interface.

### Named Rules

**The One Azure Rule.** Each view has one primary (Azure-filled) action; everything else is secondary, tertiary or a link.

**The Light Is Air Rule.** Sky appears as light, never as text, data or the only cue for a state. If removing it changes what a person understands, it was misused.

## Typography

**Font:** Inter (with system-ui) everywhere, including Vietnamese.

**Character:** one humanist sans at several weights, calm in English and Vietnamese, so partner logos, photos and real numbers carry identity.

### Hierarchy

- **Display** (600, `text-4xl` on phones rising to `text-7xl`, line height 1, −3% tracking, balanced wrap): the hero headline only.
- **Headline** (600, 2.5rem on desktop and 1.875rem on mobile, −2% tracking): section titles ("Programs and events", "Explore the directory").
- **Lead** (500, 1.25rem): the hero subline and section intros.
- **Title** (500–600, 1rem): card titles, names.
- **Body** (400, 1rem) and **Label** (500, 0.875rem): copy, buttons, navigation.
- **Meta** (500–600, 0.75rem): eyebrows ("Build week · 8–12 Jul 2026"), dates, counts.

## Layout

A 1312px column with 64px gutters on desktop, 32px on tablet (1024) and 20px on mobile (390). Sections breathe at 72–112px vertically on desktop and 56px on mobile, alternating Cool Paper and Paper so the page reads as distinct floors. Nothing is cut at the screen edge on mobile: past programs stack vertically, the directory shows one card and a "See all …" link, founders become a two-column grid of avatar rows, and the network's panels stack in one column. Navigation collapses to a menu button below 768px that opens a full-screen menu with one hint line per destination. Text never has a fixed width, because Vietnamese runs 20–30% longer.

### Landing structure

1. Header: five destinations (AI Solutions, AI Talent, Use Cases & Projects, Events & Programs, How It Works), the language menu, Sign in and Get started (the ink-coloured `inverse` action).
2. Hero: live-challenge pill, eyebrow, display headline whose second line takes the azure-to-violet gradient, lead, one search, the two actions and "Backed by GenAI Fund", beside a real screenshot of the search results, on the aurora (`aurora-*` tokens).
3. Ecosystem strip: a compact row of enterprise logos from GenAI Fund programs, never labelled as customers.
4. Five ways to explore: photo cards for solutions, talent, use cases, events and programs.
5. How it works: three steps on sky, lilac and peach tints.
6. Featured opportunity: the live challenge card, a deep-to-bright azure panel (`panel-*` tokens) beside its facts and actions.
7. Core team and GenAI Fund backing, then the ecosystem founders as a separate muted section.
8. FAQ, the final call to action on the aurora tints, then the footer.

## Elevation & Depth

Flat by default with hairlines. Shadows are ink at low opacity (`--elevation` in `tokens.css`) and come only from the `shadow-*` elevations in `web/src/app/globals.css`, from the faintest up:

- `shadow-card`: event and past-program cards (ink 5% on a 16px blur).
- `shadow-tile`: directory cards (ink 6% on 24px, 4% on 2px).
- `shadow-mark`: the white icon and logo marks on card covers.
- `shadow-raised`: the live campaign card (ink 6% on a 32px blur, 5% on 3px).
- `shadow-float`: the hero's floating cards (ink 8% on 40px, 6% on 6px).
- `shadow-search`: the search bar, the page's main control.
- `shadow-glow`: the sky light around the "Open now" timeline dot.

## Shapes

- 18px (`rounded.2xl`) for cards and floating cards; 22px for the live campaign card; 14px for covers and icon marks; 10px for date tiles.
- Full pills for buttons, chips, badges, stage pills and the search bar.
- No sharp corners, no blobs.

## Components

### Buttons

- **Shape:** full pill; heights 32, 36 and 40px for `sm`, `md`, `lg`. `Button` alone has `xl`, 48px, for the one action a page leads to.
- **Primary:** Azure fill, white label, small shadow.
- **Secondary:** Paper with a Field Line border and small shadow.
- **Tertiary:** transparent with 6px corners, for a quiet action beside others.
- **States:** a 3px Azure focus ring at 50%; disabled at 50% opacity; pending shows a spinner and sets `aria-busy`.
- **Touch:** on touch screens every control has a hit area of at least 44px (`min-h-11 min-w-11`), even when it is drawn smaller: 36px buttons, 26px scope chips and text links. Icon buttons in the mobile header are 44px.
- **In the header:** Sign in is secondary and Get started is primary, both full pills. A destination of the navigation is Ink at weight 550 (`font-nav`) and turns Azure under the pointer.

### Cards

- **Cover card:** a 150–200px cover (real photo, or a soft gradient of the card's kind with a white 56px icon mark) above a body with a meta line, a title of at most two lines and one azure link or fact.
- **Event card:** title, then time and how to join, with one date tile per upcoming date (month in azure, day in ink). A recurring event is one card, never one card per date.
- **Floating card:** a real photo, event, person or logo on Paper with the soft shadow, rotated at most 5°, animated in on load.

### Timeline

A 2px azure rail at 25% opacity links stage pills (azure for Open now, Paper for Coming up, Wash for Done) and their dots; the Open now dot carries a sky glow.

### Directory tabs

Underline tabs with a kind icon and a count; the active tab is ink with a 2px ink underline and an azure count.

## Do's and Don'ts

### Do:

- **Do** use semantic tokens only; a value repeated across features becomes a token in `tokens.css` and a variable in Figma in the same change.
- **Do** show real content: programs, dates, counts, people and logos with a source. When a fact is unknown, say so ("Venue shared on approval").
- **Do** give every status and kind a word or icon, not colour alone.
- **Do** design every screen at 1440, 1024 and 390, in light and dark, with Vietnamese copy checked.
- **Do** use Lucide icons where they carry meaning.

### Don't:

- **Don't** use purple or indigo anywhere in the interface; the logo's purple stays inside the logo.
- **Don't** invent statistics, testimonials, people or notification cards, and don't add "announcement" sparkle pills.
- **Don't** spread the sky glow beyond the hero, the arc and the live campaign cover.
- **Don't** fade in a page's main heading from invisible: it rises without fading, because browsers skip an invisible element when they measure the largest paint.
- **Don't** add audience-split box pairs ("For providers / For enterprises") whose actions already live elsewhere on the page.
- **Don't** use raw colours, arbitrary values or inline styles outside `src/components/ui`; the shadcn lint rules reject them.
