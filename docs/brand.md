# Brand

## Mark

A 4 × 4 lab well plate. The filled wells spell a "P", the other wells are
faint, and the bottom-right well is gold.

| File | Use |
| --- | --- |
| `frontend/public/brand/protolims-mark.svg` | Light backgrounds |
| `frontend/public/brand/protolims-mark-dark.svg` | Dark backgrounds |
| `frontend/public/favicon.svg` | Browser tab; switches colours in dark mode |

Below 32 px, use `favicon.svg`. Its wells are slightly larger, so they stay
separate at 16 px.

## Wordmark

The wordmark is live text, not an image: "Proto" in Manrope Regular (400),
then "LIMS" in Manrope Bold (700) in the primary colour.

```css
font-family: Manrope, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```

Always write the name as **ProtoLIMS**.

## Colours

| Name | Hex | Use |
| --- | --- | --- |
| Ink | `#0E1B33` | Text, dark surfaces |
| Cobalt | `#1D5FD1` | Primary: buttons, links, the mark |
| Sky | `#9DBDF5` | Primary on dark backgrounds |
| Gold | `#F2B33D` | Accent well and highlights only; never text on light backgrounds |
| Haze | `#E1E3EE` | Borders, dividers |
| Snow | `#FAFAFC` | Page background |

### Role colours in the app

Pages use role-based colours, so the same page works in light and dark mode.
They are defined in `frontend/src/index.css`.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| `page` | `#FAFAFC` | `#0E1B33` | Page background |
| `panel` | `#FFFFFF` | `#13233F` | Header, cards |
| `fg` | `#24304A` | `#D9E0EE` | Main text |
| `muted` | `#4A5468` | `#B4BFD6` | Secondary text |
| `line` | `#E1E3EE` | `#26375A` | Borders, dividers |
| `link` | `#1D5FD1` | `#9DBDF5` | Links (always underlined) |
| `primary` | `#1D5FD1` | `#9DBDF5` | Headings, "LIMS" in the wordmark, buttons |
| `primary-fg` | `#FFFFFF` | `#0E1B33` | Text on a `primary` background |
| `danger` | `#A4262C` | `#F5B5BA` | Error text and highlighted fields |
| `danger-bg` | `#FDEEEE` | `#3B1A24` | Error message background |
| `danger-line` | `#F1B5B8` | `#7D3340` | Error message border |

Shared class strings (buttons, links, error boxes) live in `frontend/src/styles.ts`.

Dark mode follows the visitor's system setting until they use the toggle in
the header; their choice is then remembered in the browser.

Empty wells in the mark use the primary colour at 30% opacity on light
backgrounds and 35% on dark backgrounds.

## Type

| Role | Font |
| --- | --- |
| Wordmark | Manrope |
| Headings and interface | IBM Plex Sans |
| Accessions and identifiers | Source Code Pro |

All three fonts are under the SIL Open Font License.

## Icons

Icons come from [Lucide](https://lucide.dev) (ISC licence), in its default line
style. They mark **actions**, not kinds of record: a picture can't cover every
kind of subject or sample, but it can say "new", "edit" or "open".

| Action | Icon | Where |
| --- | --- | --- |
| Create | `SquarePlus` | New … buttons (`NewButton`), Create … buttons |
| Edit | `SquarePen` | Edit … buttons (`EditButton`) |
| Remove | `SquareMinus` | Removing an item from a list in a form, such as a design factor |
| Save | `Save` | Save changes |
| Open | `SquareArrowRight` | The end of each clickable table row (`RowArrow`) |

Icons are 16 px on buttons and 20 px in table rows, in the same colour as their
text, and on buttons they always appear with words, never on their own. They're
hidden from screen readers, because the words already say what the button does.

`SectionHeading` can also take an icon, but headings don't use one yet.

Record icons were tried and set aside: `UserRound` and `Fingerprint` were too
human-centred for subjects, and `TestTube`, `TestTubeDiagonal` (unfortunate
shape) and `TestTubes` (plural) didn't suit samples.

## Page layout

A record's page starts with its title. What the record's Edit form changes sits
in a **details card** (`DetailsCard`), a box in the `panel` colour with a thin
`line` border. It has a "Details" heading and the Edit button in its top-right
corner, so it's clear what the button applies to. Anything the form doesn't
edit, and lists of related records, sit below the card, each with its own
heading and buttons.
