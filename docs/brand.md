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
