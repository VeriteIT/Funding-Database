/**
 * fetch-sharepoint.mjs
 *
 * Downloads the GTEX finance workbook from SharePoint via the Microsoft Graph
 * API (app-only, client-credentials flow) and writes it to `source.xlsx`.
 *
 * Required env vars (set as GitHub Actions secrets):
 *   GRAPH_TENANT_ID       Azure AD tenant id
 *   GRAPH_CLIENT_ID       App registration client id
 *   GRAPH_CLIENT_SECRET   App registration client secret
 *   SHAREPOINT_SHARE_URL  The sharing URL of the .xlsx file
 *
 * The app registration needs the application permission `Files.Read.All`
 * (or `Sites.Read.All`) granted with admin consent.
 */
import { writeFileSync } from "node:fs";

const {
  GRAPH_TENANT_ID,
  GRAPH_CLIENT_ID,
  GRAPH_CLIENT_SECRET,
  SHAREPOINT_SHARE_URL,
} = process.env;

const OUT = "source.xlsx";

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function getToken() {
  const tenant = requireEnv("GRAPH_TENANT_ID", GRAPH_TENANT_ID);
  const body = new URLSearchParams({
    client_id: requireEnv("GRAPH_CLIENT_ID", GRAPH_CLIENT_ID),
    client_secret: requireEnv("GRAPH_CLIENT_SECRET", GRAPH_CLIENT_SECRET),
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    { method: "POST", body },
  );
  if (!res.ok) {
    throw new Error(`Token request failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()).access_token;
}

// Graph accepts a base64url-encoded sharing URL via the /shares endpoint.
function encodeShareUrl(url) {
  const b64 = Buffer.from(url).toString("base64");
  return "u!" + b64.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
}

async function main() {
  const shareUrl = requireEnv("SHAREPOINT_SHARE_URL", SHAREPOINT_SHARE_URL);
  const token = await getToken();
  const shareId = encodeShareUrl(shareUrl);

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem/content`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}): ${await res.text()}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(OUT, buf);
  console.log(`Downloaded ${buf.length} bytes -> ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
