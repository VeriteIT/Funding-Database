# GTEX Sri Lanka — Textile & Apparel SME Finance Guide

The interactive finance-guide dashboard (Overview, Finance Finder, All Products,
Finance Explained, How to Use) for Sri Lankan textile & apparel SMEs, produced
under ITC's Global Textiles and Apparel Programme (GTEX).

The UI is the original hand-built HTML/CSS/JS dashboard. The product data is kept
in sync with the master Excel workbook in SharePoint: a GitHub Action pulls the
workbook, injects the live data into the page, and commits the result.

## How it works

```
SharePoint .xlsx ──(fetch-sharepoint.mjs)──▶ source.xlsx
source.xlsx + template.html ──(generate-finance-json.mjs)──▶ index.html  (+ public/finance.json)
index.html ──▶ served by Vercel (static, no build)
```

| File | Purpose |
| --- | --- |
| `template.html` | The dashboard UI with a `__GTEX_DATA__` placeholder where the product array goes. Edit this to change the design. |
| `generate-finance-json.mjs` | Reads the `.xlsx` `Database` sheet, maps rows to the UI's field names, injects them into `template.html`, refreshes the header/KPI counts, and writes `index.html`. |
| `index.html` | **Generated** — the deployable page (data baked in). Committed so Vercel can serve it directly. |
| `public/finance.json` | **Generated** — the raw data, kept for debugging/reuse. |
| `fetch-sharepoint.mjs` | Downloads the workbook from SharePoint via Microsoft Graph. |
| `.github/workflows/refresh-data.yml` | Scheduled/manual action: fetch → regenerate → commit. |
| `vercel.json` | Tells Vercel to serve the repo as static files (no build step). |

## Develop

```bash
npm install
npm run generate   # rebuild index.html from the local .xlsx
npm run build      # same as generate (used by CI)
npm run preview    # serve index.html at http://localhost:4199
```

To change the **look**, edit `template.html` (never edit `index.html` directly —
it is overwritten on every regenerate). To change the **data mapping**, edit the
`COLUMNS` map in `generate-finance-json.mjs`.



The `refresh-data` action pulls the latest workbook daily (02:00 UTC) and on
manual dispatch, regenerates `index.html`, and commits it. Configure these
repository secrets:

- `GRAPH_TENANT_ID`
- `GRAPH_CLIENT_ID`
- `GRAPH_CLIENT_SECRET`
- `SHAREPOINT_SHARE_URL` — the sharing URL of the `.xlsx` file

The Azure AD app registration needs the `Files.Read.All` (or `Sites.Read.All`)
**application** permission with admin consent.

⚠️ Never commit `.env` — it holds the client secret (it is gitignored).
