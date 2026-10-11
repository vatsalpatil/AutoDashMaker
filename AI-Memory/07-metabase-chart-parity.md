# 07 — Metabase chart parity (researched 2026-10-05 from metabase.com/docs/latest/questions/visualizations/*)

Legend: ✅ done · 🔶 partial · ⬜ not yet. Where it lives: `features/charts/` (`chartKinds.ts`, `optionSchema.ts`, `render/*`).

## Chart types
| Metabase | Ours | Notes |
|---|---|---|
| Line / Bar / Area / Row | ✅ | row = Bar + "Horizontal bars" |
| Combo | 🔶 | 1st measure bars, rest lines, dual axis; ⬜ per-series type/colour/axis side |
| Histogram | ✅ | automatic (Sturges) or fixed bucket count |
| Box plot | ✅ | IQR/min-max whiskers, outliers/all points, mean ◇, median/all labels, goal line, log scale |
| Waterfall | ✅ | increase/decrease/total colours, total bar, labels, goal line, scale |
| Pie / Donut | ✅ | + fold small slices into "Other" (min slice %), centre total, labels |
| Sunburst | ✅ | 2 rings (X = inner, "Outer ring" = sub-category); ⬜ 3rd level |
| Funnel | ✅ | pyramid reverse |
| Treemap | 🔶 | one level; ⬜ parent/sub-grouping + zoom |
| Sankey | ✅ | source/target/count, edge colour gray/source/target, value format, cycles dropped |
| Scatter / Bubble | ✅ | size column, trend line |
| Gauge | ✅ | coloured ranges text `0-33 Low #dc2626; …` |
| Progress bar | ✅ | goal number or column, percent style, reached colour |
| Number | ✅ (KPI) | + colour rules `<50:#dc2626; >=80:#16a34a`; format/prefix/suffix |
| Trend | 🔶 | KPI "change vs previous row" + good/bad flip; ⬜ explicit comparison (previous period / custom value / other column) |
| Table | 🔶 | striped/density/size; ⬜ column hide/rename/reorder, mini bars, row index, conditional formatting, freeze, per-column formatting |
| Pivot | ✅ | agg, totals, heatmap; ⬜ collapse/expand groups |
| Map (pin / grid / region) | ⬜ | needs lat/long + GeoJSON assets (world/US) |
| Detail | ⬜ | single record two-column view |
| Custom visualisations | ⬜ | out of scope |

## Settings (Metabase → ours)
- Series: show/hide, order, colour, per-series line/bar/area, Y-axis side ⬜ (only first-series colour override + dual axis today).
- Missing values (zero / gap / linear) ✅ `missing`. Show values none/some/all ✅ `dataLabels`. Goal line ✅ `refValue/refLabel`. Trend line ✅.
- Axes: show/hide + titles ✅, tick angle ✅, scale linear/sqrt/log ✅ `yScale`, manual min/max ✅, unpin from zero ✅ `unpinZero`, tick count ✅ `tickCount`; ⬜ X scale (timeseries/ordinal), split Y axis automatically.
- Stacking standard/percent ✅. Line shape/size/dots ✅ (curves, width, point style). Legend position ✅; ⬜ legend click-to-hide.
- Number formatting (style, decimals, prefix/suffix, currency, compact) ✅; ⬜ multiply-by, separators style.
- Interactions (drill-through, click filters, zoom) ⬜.

## Next batch (suggested order)
1. Per-series settings panel (rename, colour, type, axis side, hide, reorder).
2. Table: column formatting + conditional formatting + row index + mini bars.
3. Treemap two-level, Trend comparisons, Detail view.
4. Maps (pin / grid / region) with bundled GeoJSON.
