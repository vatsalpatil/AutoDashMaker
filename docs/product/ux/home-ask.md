# Home & Ask — UX review (2026-11-19)

Competitor notes are based on the official docs listed under Sources (searched 2026-11-19).

## Home
**Competitors.** Metabase home shows "Pick up where you left off" plus X-ray suggestions ("A look at your <table>") for newly added data and a sample database.
Power BI Home has recents, favourites, recommended content and a "Get started" learning strip. ThoughtSpot Home puts the Spotter search box first,
then watched KPIs (Liveboards) and trending items. Hex home is a projects list with templates. Julius opens on a chat box with file upload and
clickable example prompts.
**Ours.** Has an ask bar, stat tiles, quick actions, recent work, data panel, schema-based "Try asking" and alerts. The gap was that nothing told a new
user which step comes next once a file was in: the "How it works" panel was static and disappeared as soon as one dataset existed.
**Chosen.**
- `NextSteps`: a live Connect → Ask → Save-to-dashboard checklist. It marks finished steps, highlights the next one with a single CTA and hides
  itself when all three are done (Power BI "Get started" or Metabase checklist pattern). It replaces the static `HowItWorks`.
**Rejected (for now).**
- X-ray style auto-dashboards for a new dataset. They need a backend endpoint.
- Sample dataset button. It needs a backend seed (gap #1 in COMPETITIVE_GAP_ANALYSIS).
- Favourites/watched KPIs. They need a persistence model and overlap with the Metrics page owner.

## Ask
**Competitors.** Spotter, Copilot and Metabot open with schema-aware suggested questions. Answers show the interpreted tokens or the SQL, the source
model and an "is this correct?" feedback control. Spotter and Copilot let you pin an answer to a Liveboard or dashboard in one click. Julius shows
its code and lets you continue the conversation. Hex Magic keeps generated code editable in cells.
**Ours.** We already have strong trust signals: confidence badge, row and time badges, source tables, SQL/How tabs, lineage, insights, feedback,
the verify control and follow-ups.
**Chosen.**
- `AskEmptyState`: when there is no data, show an "Add data" CTA instead of an empty page. The suggestion request is skipped too.
  With data, the starter chips are labelled "Suggested from your tables" so it is clear they come from the real schema, and one line explains
  that an answer shows its SQL, sources and confidence and how to save it.
- Answer card: a "Sources:" label before the table badges.
- "Create chart" is renamed **Save as chart**, with a tooltip saying it leads on to a dashboard.
**Rejected.**
- Direct "Pin to dashboard" from an answer. It needs a dashboard picker and the widget API from another page's owner. Suggested below.
- Moving the trust row under the chart. The badges sit next to the summary, which is the right place.

## Suggestions for others / backend
- Backend: a sample-dataset seed endpoint, plus per-dataset `refreshed_at` in `/ai/chat` provenance (shown as a freshness badge).
- Dashboards owner: a reusable `AddToDashboardMenu` (components/common) so Ask can pin in one click.
- Nav owner: a "Getting started" progress dot on Home while NextSteps is incomplete.

## Sources
- Metabase X-rays (auto-generated charts for a table/model; home-page X-ray suggestions): https://www.metabase.com/docs/latest/exploration-and-organization/x-rays
- Metabase tour (home, recents, sample DB): https://www.metabase.com/learn/metabase-basics/overview/tour-of-metabase
- Metabot / AI in Metabase: https://www.metabase.com/docs/latest/ai/metabot , https://www.metabase.com/docs/latest/ai/start
- ThoughtSpot AI-suggested searches (thumbs up/down feedback on suggestions; suggestions hidden when none are meaningful): https://docs.thoughtspot.com/cloud/latest/search-ai-suggested
- ThoughtSpot Spotter starter prompts (schema-specific home-page prompts, admin-curated or AI-generated): https://docs.thoughtspot.com/cloud/latest/spotter-starter-prompts , https://docs.thoughtspot.com/cloud/latest/spotter-best
- Power BI: pin a Copilot visual answer to a new or existing dashboard: https://learn.microsoft.com/en-ca/training/modules/create-dashboards-power-bi/3-explore-data ; Copilot verified answers: https://learn.microsoft.com/power-bi/create-reports/copilot-prepare-data-ai-verified-answers
- Julius AI quickstart / chat interface (upload, then chat): https://julius.ai/docs , https://hbs.julius.ai/docs/get-started/understanding-the-chat-interface

Takeaways applied: suggestions are tied to the user's schema and hidden when there is no data (ThoughtSpot); the start screen leads with data upload (Julius); Power BI's one-click pin confirms "Pin to dashboard" from Ask as the top follow-up (needs the dashboards owner).
