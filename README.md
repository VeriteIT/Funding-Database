# GTEX Sri Lanka — Textile & Apparel SME Finance Guide

An interactive dashboard over the ITC GTEX finance database: every financing and
funding option available to Sri Lankan textile & apparel SMEs, filterable by
institution, instrument, business size, use case, tenor and green/concessionary/
women-led focus.

Built the same way as the `care-economy-dashboard`: a source Excel workbook →
generated JSON → React dashboard, with the workbook kept in sync from SharePoint
by a GitHub Action.

## Structure

| File | Purpose |
| --- | --- |
| `gtex-finance-dashboard.jsx` | The dashboard component (search + faceted filters + card grid + detail panel). |
| `src/main.jsx`, `index.html`, `vite.config.js` | Vite app shell. |
| `generate-finance-json.mjs` | Reads the `.xlsx` `Database` sheet → `public/finance.json`. |
| `fetch-sharepoint.mjs` | Downloads the workbook from SharePoint via Microsoft Graph. |
| `.github/workflows/refresh-data.yml` | Scheduled/manual action: fetch → regenerate → commit. |
| `public/finance.json` | Generated data consumed by the dashboard (1,060 products). |

## Develop

```bash
npm install
npm run generate   # rebuild public/finance.json from the local .xlsx
npm run dev        # start Vite dev server
npm run build      # generate + production build to dist/
```

## SharePoint linkage

The workbook lives in SharePoint. The `refresh-data` action pulls the latest copy
daily (and on manual dispatch), regenerates `public/finance.json`, and commits it.

Configure these repository secrets (same set the care-economy repo uses):

- `GRAPH_TENANT_ID`
- `GRAPH_CLIENT_ID`
- `GRAPH_CLIENT_SECRET`
- `SHAREPOINT_SHARE_URL` — the sharing URL of the `.xlsx` file

The Azure AD app registration needs the `Files.Read.All` (or `Sites.Read.All`)
**application** permission with admin consent.

## Data model

Each product in `finance.json` maps one row of the `Database` sheet. Key filter
fields: `sourceOfFinance`, `institutionType`, `instrument`, `businessSize`,
`tenor`, `useCases[]`, plus boolean flags `greenFocus`, `concessionaryFlag`,
`womenFocus`. To change the schema, edit the `COLUMNS` map in
`generate-finance-json.mjs`.
