/**
 * generate-finance-json.mjs
 *
 * Reads the GTEX Sri Lanka T&C SME Finance Guide workbook (the same file that
 * lives in SharePoint) and produces the deployable dashboard by injecting the
 * live product data into `template.html`.
 *
 * Outputs:
 *   - public/finance.json   (the raw data, handy for debugging / reuse)
 *   - index.html            (template.html with `const DATA = ...` filled in
 *                            and the header/KPI counts refreshed)
 *
 * Usage:
 *   node generate-finance-json.mjs [path-to-xlsx]
 *
 * If no path is passed it looks for SOURCE_XLSX env var, then the newest
 * *.xlsx in the project root. In CI the SharePoint download step writes the
 * file to `source.xlsx` and passes it in.
 */
import ExcelJS from "exceljs";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const TEMPLATE = join(ROOT, "template.html");
const OUT_HTML = join(ROOT, "index.html");
const OUT_JSON = join(ROOT, "public", "finance.json");

const SHEET = "Database";
const HEADER_ROW = 3;
const DATA_START_ROW = 4;

// Column index (1-based) in the Database sheet -> reference DATA field name.
// These field names must match exactly what template.html's JS reads.
const COLUMNS = {
  1: "Institution Name (Abbr.)",
  2: "Institution Full Name",
  3: "Source of Finance",
  4: "Institution Type",
  // 5 = Product ID -> used to build Product Code
  6: "Financing Product",
  7: "Std. Product Type",
  8: "Financing Need",
  9: "Std. Financing Need",
  10: "Product Description",
  11: "Product Page",
  12: "Currency",
  13: "Tenor",
  14: "Std. Tenor",
  15: "Interest Rate / Cost",
  16: "Grace Period",
  17: "Min. Finance (LKR '000)",
  18: "Max. Finance (LKR '000)",
  19: "Concessional",
  20: "Guarantee",
  21: "Std. Green",
  22: "Std. Green Investment Type",
  23: "Eligibility Criteria",
  24: "Eligible Projects / Applicants",
  25: "Eligible Business Size",
  26: "Std. Business Size",
  27: "T&C Value Chain Stage",
  29: "Collateral Required",
  30: "Collateral Class",
  31: "Turnover Requirement",
  32: "Capital Requirement",
  33: "Green Certification Req.",
  34: "Gender Lens",
  35: "Required Documents",
  36: "Application Form / Link",
  37: "Processing Time (months)",
  38: "Website",
  39: "Contact Person",
  40: "Contact Email",
  41: "Contact Phone",
  44: "T&C Applicability",
  46: "Comments",
  43: "Last Verified", // Date Modified
};

function cellToString(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    if (value.text) return String(value.text).trim();
    if (value.result != null) return String(value.result).trim();
    if (value.hyperlink) return String(value.hyperlink).trim();
    if (Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("").trim();
    }
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return "";
  }
  return String(value).trim();
}

function resolveSourcePath() {
  const arg = process.argv[2] || process.env.SOURCE_XLSX;
  if (arg) return resolve(arg);
  const xlsx = readdirSync(ROOT)
    .filter((f) => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$"))
    .map((f) => join(ROOT, f));
  if (!xlsx.length) {
    throw new Error("No .xlsx source found. Pass a path or set SOURCE_XLSX.");
  }
  return xlsx.sort().at(-1);
}

// Classify the free-text T&C applicability into Open / Restricted / Other
// (mirrors template.html's tcCat()).
function tcCat(s) {
  const t = String(s || "").toUpperCase();
  if (t.startsWith("OPEN") || t.startsWith("SECTOR-NEUTRAL")) return "Open";
  if (t.startsWith("RESTRICTED")) return "Restricted";
  return "Other";
}

async function main() {
  const src = resolveSourcePath();
  console.log(`Reading ${src}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(src);
  const ws = wb.getWorksheet(SHEET);
  if (!ws) throw new Error(`Sheet "${SHEET}" not found.`);

  const records = [];
  let seq = 0;
  for (let r = DATA_START_ROW; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const abbr = cellToString(row.getCell(1).value);
    if (!abbr) continue;

    seq += 1;
    const rec = {};
    rec.ID = `G${String(seq).padStart(4, "0")}`;
    const productId = cellToString(row.getCell(5).value);
    rec["Product Code"] = `${abbr} · #${productId || seq}`;

    for (const [colStr, field] of Object.entries(COLUMNS)) {
      rec[field] = cellToString(row.getCell(Number(colStr)).value);
    }

    records.push(rec);
  }

  // ── stats for the header / KPI / About counts ──
  const total = records.length;
  const institutions = new Set(records.map((r) => r["Institution Full Name"] || r["Institution Name (Abbr.)"])).size;
  const green = records.filter((r) => /^yes/i.test(r["Std. Green"])).length;
  const openTC = records.filter((r) => tcCat(r["T&C Applicability"]) === "Open").length;

  const fmt = (n) => n.toLocaleString("en-US");
  console.log(`Products: ${total} · Institutions: ${institutions} · Green: ${green} · Open T&C: ${openTC}`);

  // ── breakdown tables for the About panel (built from data) ──
  const countBy = (field) => {
    const m = new Map();
    records.forEach((r) => {
      const v = (r[field] || "").trim();
      if (v) m.set(v, (m.get(v) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const covRows = (entries) =>
    entries
      .map(([label, n]) => `<div class="cov-row"><span>${escapeHtml(label)}</span><span class="cov-n">${fmt(n)}</span></div>`)
      .join("\n      ");

  const byInstType = covRows(countBy("Institution Type"));
  const bySource = covRows(countBy("Source of Finance"));
  const tcCounts = { Open: 0, Restricted: 0, Other: 0 };
  records.forEach((r) => { tcCounts[tcCat(r["T&C Applicability"])] += 1; });
  const byTC = covRows(Object.entries(tcCounts).filter(([, n]) => n > 0));

  // ── write JSON (debug / reuse) ──
  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(records, null, 2));

  // ── inject into template.html ──
  let html = readFileSync(TEMPLATE, "utf8");
  if (!html.includes("__GTEX_DATA__")) {
    throw new Error("template.html is missing the __GTEX_DATA__ placeholder.");
  }

  const tokens = {
    __GTEX_DATA__: JSON.stringify(records),
    __COUNT_TOTAL__: fmt(total),
    __COUNT_INSTITUTIONS__: fmt(institutions),
    __COUNT_GREEN__: fmt(green),
    __COUNT_OPEN__: fmt(openTC),
    __ABOUT_BY_INSTTYPE__: byInstType,
    __ABOUT_BY_SOURCE__: bySource,
    __ABOUT_BY_TC__: byTC,
  };
  for (const [token, value] of Object.entries(tokens)) {
    // __GTEX_DATA__ is required (checked above); other tokens are optional —
    // skip any the template no longer uses instead of failing the build.
    if (!html.includes(token)) continue;
    html = html.split(token).join(value);
  }

  writeFileSync(OUT_HTML, html);
  console.log(`Wrote ${OUT_HTML} (${html.length} bytes) and ${OUT_JSON}`);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
