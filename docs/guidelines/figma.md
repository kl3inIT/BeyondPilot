# Figma design guide

For design work in the Figma file `BeyondPilot — Product UI` (folder `BeyondPilot`) that the web application in `web/` implements. The file is read and written through the Figwright MCP server (`figwright` in `.mcp.json`) and the `figma-codegen` and `figma-build` skills. The rules below exist so that generated code reuses the tokens and components already in `web/` instead of emitting raw values. Code rules stay canonical in [docs/conventions.md › Frontend](../conventions.md#frontend); when this page and that section disagree, the conventions win.

## Setup

- Figma desktop with the Figwright plugin imported from the [latest release](https://github.com/awdr74100/figwright/releases/latest) (Plugins → Development → Import plugin from manifest). Keep the plugin version equal to the server version; the plugin's Debug tab shows both.
- Open the plugin in the file before asking an agent to read or write it. `ping` reports whether a plugin is connected.
- The team is on the Figma Starter plan: one folder, three files, three pages per file. Organize screens with sections, not pages.

## File structure

| Page | Holds |
| --- | --- |
| `Foundations & Components` | Variable collections, text styles and one component set per code component |
| `Screens` | One section per area (`Public`, `Apply flow`, `Workspace`, `Admin`); every screen at desktop and mobile width |

The third page stays free until a real need appears.

## Tokens

- Every fill, stroke, radius, gap and padding is bound to a variable. A literal colour or spacing value on a screen is a defect.
- Collection `Theme` holds the semantic roles with their light values; collection `Theme/Dark` holds the same variable names with the `.dark` values. The Starter plan allows one mode per collection, so the paired collection stands in for a `Dark` mode, and Figwright reads the same-name pair as one theme axis. Variable names and values mirror `web/src/styles/tokens.css` one to one (`background`, `foreground`, `primary`, `primary-foreground`, `muted`, `muted-foreground`, `border`, `input`, `ring`, `destructive`, `success`, `warning`, `info`, `brand`, …). Screens bind to `Theme`. The neutral palette is shadcn zinc; `brand` is the orange accent used only for glows and highlights, never as the only carrier of meaning.
- Each `Theme` variable sets the WEB code syntax to its CSS custom property (`var(--primary)`), so code generation emits the token instead of deriving a name.
- Collection `Scale` holds radius and spacing. Radius mirrors `--radius` and its derived steps (`radius/sm` … `radius/4xl`); spacing follows the Tailwind 4px scale (`space/1` = 4px, `space/2` = 8px, …).
- Text styles are named after the Tailwind utilities they produce (`text-sm/font-medium`, `text-5xl/font-semibold`), so a style maps one to one to classes. The font is Inter, the font the web application loads. Effect styles follow the same rule (`shadow/sm`, `shadow/lg`, `blur/2xl`, `glow/brand/sm`).
- A token change lands in Figma and in `tokens.css` in the same change. Brand colours replace the neutral values only when GenAI Fund provides the BeyondPilot identity.

## Components

- A Figma component exists only for a component that exists, or is being added, in `web/src/components`. Its name is the code component's name (`Button`, `Badge`, `Card`), and its variant properties are the component's props with the same names and values.
- Product actions are designed with the wrapper API from the [components convention](../conventions.md#components): `tone` (`default`, `danger`), `prominence` (`primary`, `secondary`, `tertiary`, `internal`), `size` (`sm`, `md`, `lg`) and `pending`. Do not design with raw shadcn button variants. Until the wrappers exist (BEY-20), the Figma `Button` set draws them on the current `button.tsx` variants: `primary` as `default`, `secondary` as `outline`, `tertiary` as `ghost`, `internal` as `secondary`, and `tone=danger` as `destructive` (primary) or destructive-coloured text (secondary, tertiary); sizes `sm`, `md`, `lg` as `sm`, `default`, `lg`.
- Interaction states (`hover`, `focus-visible`, `disabled`, `pending`, `invalid`) are a `state` property for review only; code derives them from CSS and ARIA, not props.
- A missing primitive is installed with `shadcn add` before its Figma component is drawn; do not design a look-alike of a registry component.
- Screens use instances only. A detached instance becomes regenerated markup.
- Confirmed Figma-to-code pairs are recorded in `docs/figma-component-map.md` (`| FigmaName | path |`) and `docs/figma-token-map.md` (`| FigmaName | ref |`). Figwright treats these rows as authoritative, so record only verified pairs and fix rows it reports as stale.

## Layout

- Every frame uses auto layout. Figwright turns it into flex or grid with exact gap and padding; absolutely placed children become margins and offsets that break on resize.
- Use Fill for content that stretches and Hug for controls; fixed sizes only for icons, avatars and media.
- Layers are named by meaning (`CampaignCard`, `ApplyCta`), never `Frame 12`; names become component and class names.
- Each screen is drawn at 1440 desktop, 1024 tablet and 390 mobile width. Desktop is the source frame: tablet and mobile are derived from it. Where a desktop illustration or product mockup cannot reflow, the smaller frames may carry a flattened render of it named `… render`; code builds those parts responsively from the desktop layers, not from the render.
- A narrow navigation collapses into a menu button that opens a full-screen menu frame (`… — Menu`).

## Content, icons and media

- Icons come from the Lucide set with their Lucide names (`ArrowRight`, `Building2`), so they map to `lucide-react`. No custom-drawn icons.
- Logos and photographs are image fills, never redrawn vectors.
- Text in the file is sample copy; the application reads `messages/en.json` and `messages/vi.json`. Leave room for Vietnamese, which runs about 20–30% longer than English: text layers hug or fill and never have a fixed width. Check key screens with Vietnamese copy pasted in.
- Fonts must cover Vietnamese diacritics.
- Status colours always come with an icon or label, as in code.

## From design to code

1. Finish the foundations and the components a screen needs before drawing the screen.
2. Generate code one section at a time: select the frame and ask for that frame.
3. Generated code follows the web rules: marketing sections in `src/components/sections`, app screens in `src/features/<domain>`, primitives from `src/components/ui`, semantic tokens only, every string in both catalogs.
4. After a design change, use `design_diff` to update only the affected code.
5. Verify the result in the browser and with `pnpm test:e2e` (Playwright with axe), comparing against the Figma screenshot.
