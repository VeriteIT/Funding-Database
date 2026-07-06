/**
 * generate-finance-json.mjs
 *
 * Reads the GTEX Sri Lanka T&C SME Finance Guide workbook (the same file that
 * lives in SharePoint) and emits `public/finance.json`, the single data source
 * consumed by the dashboard.
 *
 * Usage:
 *   node generate-finance-json.mjs [path-to-xlsx]
 *
 * If no path is passed it looks for SOURCE_XLSX env var, then the newest
 * *.xlsx in the project root. In CI the SharePoint download step writes the
 * file to `source.xlsx` and passes it in.
 */
import ExcelJS from "exceljs";
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const OUT_DIR = join(ROOT, "public");
const OUT_FILE = join(OUT_DIR, "finance.json");

// Header row lives on row 3 of the Database sheet; data starts on row 4.
const SHEET = "Database";
const HEADER_ROW = 3;
const DATA_START_ROW = 4;

// Column index (1-based) -> field name in the emitted record.
const COLUMNS = {
  1: "institutionAbbr",
  2: "institution",
  3: "sourceOfFinance", // FILTER
  4: "institutionType", // FILTER
  5: "productId",
  6: "productName",
  7: "instrument", // FILTER
  8: "useCaseText",
  9: "useCases", // FILTER (multi-value, comma separated)
  10: "description",
  11: "productUrl",
  12: "currency",
  13: "tenorText",
  14: "tenor", // FILTER
  15: "costText",
  16: "gracePeriod",
  17: "minFunding",
  18: "maxFunding",
  19: "concessionary", // FILTER
  20: "guarantee",
  21: "greenFocus", // FILTER (Yes/No)
  22: "greenType", // FILTER (multi-value)
  23: "eligibilityText",
  24: "eligibleApplicants",
  25: "businessSizeText",
  26: "businessSize", // FILTER
  27: "valueChainText",
  28: "valueChain", // FILTER (multi-value)
  29: "collateralText",
  30: "collateral", // FILTER
  31: "turnoverRequirement",
  32: "capitalRequirement",
  33: "greenCertRequirement",
  34: "genderLens",
  35: "requiredDocs",
  36: "applicationForm",
  37: "processingTime",
  38: "institutionUrl",
  39: "contactPerson",
  40: "contactEmail",
  41: "contactNumber",
  42: "dateAdded",
  43: "dateModified",
  44: "smeApplicabilityText",
  45: "smeApplicability", // FILTER
  46: "comments",
};

// Fields that hold comma-separated multi-values -> arrays.
const MULTI_FIELDS = new Set(["useCases", "greenType", "valueChain"]);

const NULLISH = new Set([
  "",
  "n/a",
  "na",
  "not applicable",
  "not disclosed",
  "none",
  "-",
]);

function cellToString(value) {
  if (value == null) return "";
  // ExcelJS may return rich text / hyperlink objects.
  if (typeof value === "object") {
    if (value.text) return String(value.text).trim();
    if (value.result != null) return String(value.result).trim();
    if (value.hyperlink) return String(value.hyperlink).trim();
    if (Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("").trim();
    }
    return "";
  }
  return String(value).trim();
}

function clean(value) {
  const s = cellToString(value);
  if (NULLISH.has(s.toLowerCase())) return "";
  return s;
}

function splitMulti(value) {
  const s = cellToString(value);
  if (!s || NULLISH.has(s.toLowerCase())) return [];
  return [...new Set(s.split(",").map((p) => p.trim()).filter(Boolean))];
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
  // newest by name (files are date-prefixed) as a reasonable default
  return xlsx.sort().at(-1);
}

async function main() {
  const src = resolveSourcePath();
  console.log(`Reading ${src}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(src);
  const ws = wb.getWorksheet(SHEET);
  if (!ws) throw new Error(`Sheet "${SHEET}" not found.`);

  const records = [];
  for (let r = DATA_START_ROW; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const abbr = clean(row.getCell(1).value);
    if (!abbr) continue; // skip blank / spacer rows

    const rec = {};
    for (const [colStr, field] of Object.entries(COLUMNS)) {
      const col = Number(colStr);
      const raw = row.getCell(col).value;
      if (MULTI_FIELDS.has(field)) {
        rec[field] = splitMulti(raw);
      } else {
        rec[field] = clean(raw);
      }
    }

    rec.id = `${rec.institutionAbbr}-${rec.productId || r}`;
    rec.greenFocus = /^yes/i.test(cellToString(row.getCell(21).value));
    rec.concessionaryFlag = /^concession/i.test(
      cellToString(row.getCell(19).value),
    );
    rec.womenFocus = /^yes/i.test(cellToString(row.getCell(34).value));

    records.push(rec);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(records, null, 2));
  console.log(`Wrote ${records.length} products -> ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
