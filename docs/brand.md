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

Empty wells in the mark use the primary colour at 30% opacity on light
backgrounds and 35% on dark backgrounds.

## Type

| Role | Font |
| --- | --- |
| Wordmark | Manrope |
| Headings and interface | IBM Plex Sans |
| Accessions and identifiers | Source Code Pro |

All three fonts are under the SIL Open Font License.
