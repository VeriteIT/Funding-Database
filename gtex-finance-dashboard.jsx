import { useEffect, useMemo, useRef, useState } from "react";

const DATA_URL = `${import.meta.env.BASE_URL}finance.json`;

// ── GTEX brand tokens (from the ITC GTEX Sri Lanka Finance Guide) ──
const BRAND = {
  pageBg: "#F8F3EB",
  cream: "#FDF9F4",
  sand: "#EDE5D5",
  heroBg: "#0B2818",
  heroBg2: "#14542E",
  heroEyebrow: "#D4A84B",
  heroText: "#FDF9F4",
  heroSubtle: "rgba(253,249,244,0.82)",
  heroError: "#ffd4d4",
  toolbarShell: "rgba(248,243,235,0.94)",
  toolbarCardBg: "rgba(255,255,255,0.97)",
  toolbarShadow: "0 12px 30px rgba(11,40,24,0.12)",
  border: "#DDD2BE",
  softBorder: "#EDE5D5",
  ink: "#1A1A18",
  mutedText: "#4A5568",
  softText: "#8A9BA8",
  searchBg: "#FDF9F4",
  accent: "#14542E",
  accentDeep: "#0B2818",
  leaf: "#1D7A45",
  mint: "#2EAD65",
  gold: "#B8882A",
  goldLt: "#D4A84B",
  accentSoft: "rgba(29,122,69,0.12)",
  accentBorder: "rgba(29,122,69,0.34)",
  cardBg: "#FFFFFF",
  green: "#1D7A45",
  greenSoft: "rgba(46,173,101,0.14)",
  greenBorder: "rgba(46,173,101,0.4)",
};

// Filter facets. `field` maps to the record key; multi:true for array fields.
const FACETS = [
  { key: "sourceOfFinance", label: "Source of Finance" },
  { key: "institutionType", label: "Institution Type" },
  { key: "instrument", label: "Finance Instrument" },
  { key: "businessSize", label: "Business Size" },
  { key: "tenor", label: "Tenor" },
  { key: "useCases", label: "Use Case", multi: true },
];

// Boolean toggles.
const TOGGLES = [
  { key: "greenFocus", label: "Green / Sustainable", color: BRAND.mint },
  { key: "concessionaryFlag", label: "Concessionary", color: BRAND.gold },
  { key: "womenFocus", label: "Women-led focus", color: BRAND.leaf },
];

const UI_FONT = 'Outfit, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const HEADING_FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const PAGE_SIZE = 24;

const SOURCE_COLORS = {
  Debt: "#14542E",
  Equity: "#B8882A",
  Grant: "#2EAD65",
  Guarantee: "#1D7A45",
  "Blended Finance": "#4A5568",
};

function sourceColor(src) {
  return SOURCE_COLORS[src] || BRAND.accent;
}

function shadeHex(hex, amount) {
  const h = (hex || "#000000").replace("#", "");
  const num = parseInt(h, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function hexToRgba(hex, alpha) {
  const h = (hex || "#000000").replace("#", "");
  const num = parseInt(h, 16);
  return `rgba(${(num >> 16) & 0xff}, ${(num >> 8) & 0xff}, ${num & 0xff}, ${alpha})`;
}

// Strip the "NN. " prefix instruments carry (e.g. "06. Long-term loan").
function tidyInstrument(value) {
  return (value || "").replace(/^\d+\.\s*/, "").trim();
}

const GLOBAL_STYLES = `
  .gx-root *:focus-visible { outline: 2px solid ${BRAND.accent}; outline-offset: 2px; }
  @keyframes gx-pulse { 0%,100%{opacity:1;} 50%{opacity:0.55;} }
  .gx-skeleton {
    background: linear-gradient(90deg, ${BRAND.searchBg} 0%, ${BRAND.sand} 50%, ${BRAND.searchBg} 100%);
    background-size: 200% 100%;
    animation: gx-pulse 1.5s ease-in-out infinite;
    border-radius: 12px;
  }
  .gx-card {
    transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
    will-change: transform;
  }
  .gx-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 24px rgba(11,40,24,0.12);
    border-color: ${BRAND.accentBorder};
  }
  .gx-cta { transition: transform 160ms ease, filter 160ms ease, box-shadow 160ms ease; }
  .gx-cta:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 8px 18px rgba(11,40,24,0.24); }
  .gx-see-more { transition: transform 160ms ease, filter 160ms ease, box-shadow 160ms ease; }
  .gx-see-more:hover { transform: translateY(-1px); filter: brightness(0.98); box-shadow: 0 6px 14px rgba(11,40,24,0.14); }
  .gx-clamp-2 { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .gx-clamp-3 { display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
  .gx-search:focus {
    border-color: ${BRAND.accent} !important;
    box-shadow: 0 0 0 3px rgba(29,122,69,0.14), inset 0 1px 0 rgba(255,255,255,0.6) !important;
  }
`;

function collectFacetValues(products, facet) {
  const counts = new Map();
  products.forEach((p) => {
    const raw = p[facet.key];
    const values = facet.multi ? raw || [] : raw ? [raw] : [];
    values.forEach((v) => {
      const val = String(v).trim();
      if (!val) return;
      counts.set(val, (counts.get(val) || 0) + 1);
    });
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value);
}

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({}); // { facetKey: Set(values) }
  const [toggles, setToggles] = useState({}); // { toggleKey: true }
  const [selected, setSelected] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );
  const [scrolled, setScrolled] = useState(false);
  const toolbarRef = useRef(null);

  const isMobile = viewportWidth <= 768;
  const pagePadding = isMobile ? "1rem" : "2rem";

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch(DATA_URL, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
        setError("");
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error(err);
        setProducts([]);
        setError(err.message || "Unable to load finance data.");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || !isMobile || !selected) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobile, selected]);

  const facetOptions = useMemo(() => {
    const map = {};
    FACETS.forEach((f) => {
      map[f.key] = collectFacetValues(products, f);
    });
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q) {
        const hay = [
          p.institution,
          p.institutionAbbr,
          p.productName,
          p.description,
          p.useCaseText,
          p.instrument,
          ...(p.useCases || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      for (const facet of FACETS) {
        const active = filters[facet.key];
        if (!active || active.size === 0) continue;
        const raw = p[facet.key];
        const values = facet.multi ? raw || [] : raw ? [raw] : [];
        if (!values.some((v) => active.has(String(v).trim()))) return false;
      }
      for (const t of TOGGLES) {
        if (toggles[t.key] && !p[t.key]) return false;
      }
      return true;
    });
  }, [products, search, filters, toggles]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, filters, toggles]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const activeFilterCount =
    Object.values(filters).reduce((n, s) => n + (s ? s.size : 0), 0) +
    Object.values(toggles).filter(Boolean).length;
  const hasActiveFilters = search.trim() || activeFilterCount > 0;

  function toggleFacet(facetKey, value) {
    setFilters((prev) => {
      const next = { ...prev };
      const set = new Set(next[facetKey] || []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      next[facetKey] = set;
      return next;
    });
  }

  function toggleFlag(key) {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function clearFilters() {
    setSearch("");
    setFilters({});
    setToggles({});
  }

  const statusText = loading
    ? "Loading finance products..."
    : "Your single source for finance and funding available to Sri Lankan textile & apparel SMEs. Filter by institution, instrument, business size, use case and green focus to find the right option.";

  return (
    <div className="gx-root" style={{ fontFamily: HEADING_FONT, minHeight: "100vh", background: BRAND.pageBg }}>
      <style>{GLOBAL_STYLES}</style>

      {/* ── Hero ── */}
      <div
        style={{
          position: "relative",
          background: BRAND.heroBg,
          backgroundImage:
            "radial-gradient(circle at 12% 0%, rgba(212,168,75,0.20), transparent 55%), radial-gradient(circle at 95% 110%, rgba(46,173,101,0.22), transparent 50%)",
          padding: isMobile ? "1.5rem 1rem 1.6rem" : "2.2rem 2rem 1.9rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            maxWidth: 1500,
            margin: "0 auto",
            display: "flex",
            gap: isMobile ? 14 : 24,
            alignItems: "center",
            flexDirection: isMobile ? "column" : "row",
            textAlign: isMobile ? "center" : "left",
          }}
        >
          <div style={{ minWidth: isMobile ? 0 : 280, flex: 1 }}>
            <p
              style={{
                color: BRAND.heroEyebrow,
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                margin: "0 0 6px",
                fontFamily: UI_FONT,
                fontWeight: 700,
              }}
            >
              ITC GTEX · Sri Lanka
            </p>
            <h1
              style={{
                color: BRAND.heroText,
                fontSize: isMobile ? 30 : 44,
                fontWeight: 700,
                lineHeight: 1.05,
                margin: "0 0 10px",
                letterSpacing: "-0.01em",
              }}
            >
              Textile &amp; Apparel SME Finance Guide
            </h1>
            <div
              style={{
                width: 52,
                height: 3,
                background: BRAND.heroEyebrow,
                borderRadius: 999,
                margin: isMobile ? "0 auto 14px" : "0 0 14px",
              }}
            />
            <p
              style={{
                color: BRAND.heroSubtle,
                fontSize: isMobile ? 13 : 14.5,
                lineHeight: 1.7,
                margin: 0,
                maxWidth: 820,
                marginInline: isMobile ? "auto" : 0,
                fontFamily: UI_FONT,
              }}
            >
              {statusText}
            </p>
            {error && (
              <div
                style={{
                  marginTop: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255,212,212,0.12)",
                  border: "1px solid rgba(255,212,212,0.35)",
                  color: BRAND.heroError,
                  fontSize: 12,
                  fontFamily: UI_FONT,
                  padding: "7px 12px",
                  borderRadius: 8,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v5" />
                  <path d="M12 16h.01" />
                </svg>
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div
        ref={toolbarRef}
        style={{
          background: BRAND.toolbarShell,
          borderBottom: `1px solid ${BRAND.softBorder}`,
          padding: isMobile ? "0.9rem 1rem 1rem" : "1rem 2rem 1.1rem",
          position: isMobile ? "static" : "sticky",
          top: isMobile ? "auto" : 0,
          zIndex: isMobile ? "auto" : 20,
          backdropFilter: isMobile ? "none" : "blur(10px)",
          transition: "box-shadow 220ms ease",
          boxShadow: !isMobile && scrolled ? "0 8px 24px rgba(11,40,24,0.10)" : "none",
        }}
      >
        <div
          style={{
            maxWidth: 1500,
            margin: "0 auto",
            background: BRAND.toolbarCardBg,
            border: `1px solid ${BRAND.border}`,
            borderRadius: 18,
            boxShadow: BRAND.toolbarShadow,
            padding: isMobile ? "14px" : "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* search */}
          <div style={{ position: "relative" }}>
            <svg
              style={{
                position: "absolute",
                left: 16,
                top: "50%",
                transform: "translateY(-50%)",
                width: 18,
                height: 18,
                color: BRAND.softText,
                opacity: 0.7,
              }}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className="gx-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, institution, working capital, green, export finance..."
              style={{
                width: "100%",
                padding: isMobile ? "13px 14px 13px 44px" : "14px 16px 14px 46px",
                border: `1px solid ${BRAND.border}`,
                borderRadius: 14,
                fontSize: isMobile ? 14 : 15,
                fontFamily: UI_FONT,
                color: BRAND.ink,
                background: BRAND.searchBg,
                boxSizing: "border-box",
                outline: "none",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
                transition: "border-color 160ms ease, box-shadow 160ms ease",
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  border: "none",
                  background: BRAND.sand,
                  color: BRAND.mutedText,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* facet dropdowns + toggles */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
            {FACETS.map((facet) => (
              <FacetDropdown
                key={facet.key}
                facet={facet}
                options={facetOptions[facet.key] || []}
                selected={filters[facet.key] || new Set()}
                onToggle={(v) => toggleFacet(facet.key, v)}
                onClear={() => setFilters((prev) => ({ ...prev, [facet.key]: new Set() }))}
              />
            ))}
            {TOGGLES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => toggleFlag(t.key)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "9px 14px",
                  borderRadius: 999,
                  border: `1px solid ${toggles[t.key] ? t.color : BRAND.border}`,
                  background: toggles[t.key] ? t.color : BRAND.searchBg,
                  color: toggles[t.key] ? "#fff" : BRAND.mutedText,
                  fontSize: 12,
                  fontFamily: UI_FONT,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 140ms ease",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: toggles[t.key] ? "#fff" : t.color,
                  }}
                />
                {t.label}
              </button>
            ))}
          </div>

          {/* result count + clear */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              justifyContent: "space-between",
              flexWrap: "wrap",
              borderTop: `1px solid ${BRAND.softBorder}`,
              paddingTop: 12,
            }}
          >
            <div style={{ display: "inline-flex", alignItems: "baseline", gap: 5, fontFamily: UI_FONT }}>
              <span style={{ fontSize: 19, fontWeight: 800, color: BRAND.accent, letterSpacing: "-0.01em" }}>
                {filtered.length}
              </span>
              <span style={{ fontSize: 12.5, color: BRAND.mutedText, fontWeight: 600 }}>
                financing option{filtered.length !== 1 ? "s" : ""}
                {products.length ? ` of ${products.length}` : ""}
              </span>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "7px 13px",
                  fontSize: 11.5,
                  fontWeight: 600,
                  fontFamily: UI_FONT,
                  border: `1px solid ${BRAND.accentBorder}`,
                  borderRadius: 999,
                  cursor: "pointer",
                  background: BRAND.accentSoft,
                  color: BRAND.accent,
                  whiteSpace: "nowrap",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Results grid ── */}
      <div
        style={{
          maxWidth: 1500,
          margin: "0 auto",
          padding: isMobile ? `1rem ${pagePadding}` : "1.5rem 2rem",
        }}
      >
        {loading ? (
          <GridSkeleton isMobile={isMobile} />
        ) : filtered.length === 0 ? (
          <EmptyState onClear={clearFilters} />
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 16,
              }}
            >
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} onClick={() => setSelected(p)} />
              ))}
            </div>
            {hasMore && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
                <button
                  type="button"
                  className="gx-see-more"
                  onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                  style={{
                    padding: "12px 26px",
                    background: BRAND.accentSoft,
                    border: `1px solid ${BRAND.accentBorder}`,
                    borderRadius: 999,
                    color: BRAND.accent,
                    fontSize: 13,
                    fontFamily: UI_FONT,
                    fontWeight: 700,
                    cursor: "pointer",
                    letterSpacing: "0.02em",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  Show more ({filtered.length - visibleCount} remaining)
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Detail overlay ── */}
      {selected && <DetailPanel product={selected} isMobile={isMobile} onClose={() => setSelected(null)} />}

      {/* ── Footer ── */}
      <footer
        style={{
          marginTop: 32,
          background: BRAND.heroBg,
          backgroundImage: "radial-gradient(circle at 50% 0%, rgba(212,168,75,0.12), transparent 60%)",
          color: BRAND.heroText,
          padding: isMobile ? "26px 1rem 22px" : "32px 2rem 26px",
        }}
      >
        <div
          style={{
            maxWidth: 1500,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            textAlign: "center",
          }}
        >
          <div style={{ width: 60, height: 2, background: BRAND.heroEyebrow, opacity: 0.55, borderRadius: 999 }} />
          <p
            style={{
              color: BRAND.heroEyebrow,
              fontSize: 10.5,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              margin: 0,
              fontFamily: UI_FONT,
              fontWeight: 700,
            }}
          >
            ITC GTEX · Sri Lanka T&amp;C Finance Guide
          </p>
          <p style={{ fontSize: 12, lineHeight: 1.6, fontFamily: UI_FONT, color: BRAND.heroSubtle, margin: 0 }}>
            Copyright &copy; 2026 · International Trade Centre — GTEX/MENATEX
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ────────────────────────── Product card ────────────────────────── */
function ProductCard({ product, onClick }) {
  const color = sourceColor(product.sourceOfFinance);
  return (
    <div
      role="button"
      tabIndex={0}
      className="gx-card"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        background: BRAND.cardBg,
        border: `1px solid ${BRAND.border}`,
        borderRadius: 14,
        padding: "16px 16px 16px 19px",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <span aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: color }} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 10.5,
            fontFamily: UI_FONT,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#fff",
            background: color,
            padding: "3px 9px",
            borderRadius: 6,
            whiteSpace: "nowrap",
          }}
        >
          {product.sourceOfFinance || "Finance"}
        </span>
        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
          {product.greenFocus && <Dot title="Green / Sustainable" color={BRAND.mint} />}
          {product.concessionaryFlag && <Dot title="Concessionary" color={BRAND.gold} />}
          {product.womenFocus && <Dot title="Women-led focus" color={BRAND.leaf} />}
        </div>
      </div>

      <h3
        className="gx-clamp-2"
        style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px", lineHeight: 1.25, color: BRAND.ink, fontFamily: HEADING_FONT }}
      >
        {product.productName || "Financing product"}
      </h3>
      <p style={{ fontSize: 11.5, fontFamily: UI_FONT, color: BRAND.softText, margin: "0 0 10px", fontWeight: 600 }}>
        {product.institution || product.institutionAbbr}
      </p>

      {product.description && (
        <p
          className="gx-clamp-3"
          style={{ fontSize: 12.5, fontFamily: UI_FONT, color: BRAND.mutedText, margin: "0 0 12px", lineHeight: 1.55 }}
        >
          {product.description}
        </p>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "auto" }}>
        {product.instrument && <Tag label={tidyInstrument(product.instrument)} />}
        {product.tenor && <Tag label={product.tenor} subtle />}
        {(product.useCases || []).slice(0, 1).map((u) => (
          <Tag key={u} label={u} subtle />
        ))}
      </div>
    </div>
  );
}

function Dot({ color, title }) {
  return <span title={title} style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block" }} />;
}

function Tag({ label, subtle }) {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontFamily: UI_FONT,
        fontWeight: 600,
        background: subtle ? BRAND.searchBg : BRAND.accentSoft,
        color: subtle ? BRAND.mutedText : BRAND.accent,
        border: `1px solid ${subtle ? BRAND.border : BRAND.accentBorder}`,
        padding: "3px 9px",
        borderRadius: 20,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: 180,
      }}
    >
      {label}
    </span>
  );
}

/* ────────────────────────── Detail panel ────────────────────────── */
function DetailPanel({ product, isMobile, onClose }) {
  const color = sourceColor(product.sourceOfFinance);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const detailRows = [
    ["Finance instrument", tidyInstrument(product.instrument)],
    ["Currency", product.currency],
    ["Tenor", product.tenor || product.tenorText],
    ["Cost of finance", product.costText],
    ["Grace period", product.gracePeriod],
    ["Funding range", fundingRange(product)],
    ["Eligible business size", product.businessSize],
    ["Eligible applicants", product.eligibleApplicants],
    ["Collateral / security", product.collateralText || product.collateral],
    ["Value chain segment", (product.valueChain || []).join(", ")],
    ["Processing time", product.processingTime],
    ["Guarantee / risk-sharing", product.guarantee],
  ].filter(([, v]) => v);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        justifyContent: isMobile ? "stretch" : "flex-end",
        background: "rgba(11,40,24,0.42)",
        backdropFilter: "blur(2px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? "100%" : 480,
          maxWidth: "100%",
          height: "100%",
          background: BRAND.cardBg,
          overflowY: "auto",
          boxShadow: "-16px 0 40px rgba(11,40,24,0.24)",
          animation: "gx-slide 220ms ease",
        }}
      >
        <style>{`@keyframes gx-slide{from{transform:translateX(24px);opacity:0;}to{transform:translateX(0);opacity:1;}}`}</style>

        {/* header */}
        <div
          style={{
            background: `linear-gradient(180deg, ${color} 0%, ${shadeHex(color, -26)} 100%)`,
            padding: "18px 22px 20px",
            position: "sticky",
            top: 0,
            zIndex: 2,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                <HeaderChip label={product.sourceOfFinance} />
                {product.institutionType && <HeaderChip label={product.institutionType} />}
                {product.greenFocus && <HeaderChip label="Green" />}
                {product.concessionaryFlag && <HeaderChip label="Concessionary" />}
                {product.womenFocus && <HeaderChip label="Women-led" />}
              </div>
              <h2 style={{ color: "#fff", fontSize: isMobile ? 24 : 26, fontWeight: 700, lineHeight: 1.15, margin: 0, fontFamily: HEADING_FONT }}>
                {product.productName}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: UI_FONT, margin: "6px 0 0", fontWeight: 500 }}>
                {product.institution}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.25)",
                color: "#fff",
                borderRadius: "50%",
                width: 32,
                height: 32,
                cursor: "pointer",
                fontSize: 17,
                lineHeight: 1,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ padding: isMobile ? "20px 18px 40px" : "22px 22px 40px" }}>
          {product.description && (
            <p style={{ fontSize: 13.5, fontFamily: UI_FONT, color: BRAND.mutedText, lineHeight: 1.65, margin: "0 0 18px" }}>
              {product.description}
            </p>
          )}

          {product.useCaseText && (
            <Section title="What it funds">
              <p style={{ fontSize: 13, fontFamily: UI_FONT, color: BRAND.mutedText, lineHeight: 1.6, margin: 0 }}>
                {product.useCaseText}
              </p>
              {(product.useCases || []).length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  {product.useCases.map((u) => (
                    <Tag key={u} label={u} />
                  ))}
                </div>
              )}
            </Section>
          )}

          <Section title="Terms">
            <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr", gap: 0 }}>
              {detailRows.map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "9px 0",
                    borderBottom: `1px solid ${BRAND.softBorder}`,
                    fontFamily: UI_FONT,
                  }}
                >
                  <dt style={{ flex: "0 0 40%", fontSize: 12, color: BRAND.softText, fontWeight: 600 }}>{label}</dt>
                  <dd style={{ flex: 1, margin: 0, fontSize: 12.5, color: BRAND.ink, lineHeight: 1.5 }}>{value}</dd>
                </div>
              ))}
            </dl>
          </Section>

          {product.eligibilityText && (
            <Section title="Eligibility">
              <p style={{ fontSize: 13, fontFamily: UI_FONT, color: BRAND.mutedText, lineHeight: 1.6, margin: 0 }}>
                {product.eligibilityText}
              </p>
            </Section>
          )}

          {product.smeApplicabilityText && (
            <Section title="T&C SME applicability">
              <p style={{ fontSize: 13, fontFamily: UI_FONT, color: BRAND.mutedText, lineHeight: 1.6, margin: 0 }}>
                {product.smeApplicabilityText}
              </p>
            </Section>
          )}

          {(product.contactPerson || product.contactEmail || product.contactNumber) && (
            <Section title="Contact">
              <div style={{ fontSize: 12.5, fontFamily: UI_FONT, color: BRAND.mutedText, lineHeight: 1.7 }}>
                {product.contactPerson && <div>{product.contactPerson}</div>}
                {product.contactEmail && (
                  <div>
                    <a href={`mailto:${product.contactEmail}`} style={{ color: BRAND.accent }}>
                      {product.contactEmail}
                    </a>
                  </div>
                )}
                {product.contactNumber && <div>{product.contactNumber}</div>}
              </div>
            </Section>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
            {product.productUrl && (
              <a
                className="gx-cta"
                href={product.productUrl}
                target="_blank"
                rel="noreferrer"
                style={ctaStyle(BRAND.accent)}
              >
                View product
                <ExternalIcon />
              </a>
            )}
            {product.institutionUrl && (
              <a
                href={product.institutionUrl}
                target="_blank"
                rel="noreferrer"
                style={{ ...ctaStyle("#fff"), color: BRAND.accent, border: `1px solid ${BRAND.accentBorder}`, boxShadow: "none" }}
              >
                Institution site
                <ExternalIcon />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function fundingRange(p) {
  const min = p.minFunding && p.minFunding !== "Not applicable" ? p.minFunding : "";
  const max = p.maxFunding && p.maxFunding !== "Not applicable" ? p.maxFunding : "";
  if (min && max) return `${min} — ${max}`;
  return max || min || "";
}

function ctaStyle(bg) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "11px 18px",
    background: bg,
    color: "#fff",
    borderRadius: 999,
    fontFamily: UI_FONT,
    fontSize: 13,
    fontWeight: 700,
    textDecoration: "none",
    boxShadow: "0 6px 14px rgba(11,40,24,0.22)",
    letterSpacing: "0.02em",
  };
}

function ExternalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <p
        style={{
          fontSize: 10.5,
          fontFamily: UI_FONT,
          fontWeight: 800,
          color: BRAND.accent,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          margin: "0 0 10px",
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function HeaderChip({ label }) {
  if (!label) return null;
  return (
    <span
      style={{
        background: "rgba(255,255,255,0.2)",
        color: "#fff",
        fontSize: 10.5,
        fontFamily: UI_FONT,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.3)",
      }}
    >
      {label}
    </span>
  );
}

/* ────────────────────────── Facet dropdown ────────────────────────── */
function FacetDropdown({ facet, options, selected, onToggle, onClear }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const count = selected.size;
  const filteredOpts = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "9px 13px",
          borderRadius: 999,
          border: `1px solid ${count ? BRAND.accent : BRAND.border}`,
          background: count ? BRAND.accentSoft : BRAND.searchBg,
          color: count ? BRAND.accent : BRAND.mutedText,
          fontSize: 12,
          fontFamily: UI_FONT,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 140ms ease",
          whiteSpace: "nowrap",
        }}
      >
        {facet.label}
        {count > 0 && (
          <span
            style={{
              background: BRAND.accent,
              color: "#fff",
              borderRadius: 999,
              fontSize: 10.5,
              fontWeight: 700,
              minWidth: 17,
              height: 17,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 5px",
            }}
          >
            {count}
          </span>
        )}
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.6}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 40,
            width: 280,
            maxWidth: "80vw",
            background: "#fff",
            border: `1px solid ${BRAND.border}`,
            borderRadius: 14,
            boxShadow: "0 16px 40px rgba(11,40,24,0.18)",
            padding: 10,
          }}
        >
          {options.length > 8 && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${facet.label.toLowerCase()}...`}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "8px 10px",
                marginBottom: 8,
                border: `1px solid ${BRAND.border}`,
                borderRadius: 9,
                fontSize: 12.5,
                fontFamily: UI_FONT,
                background: BRAND.searchBg,
                outline: "none",
              }}
            />
          )}
          <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {filteredOpts.length === 0 && (
              <p style={{ fontSize: 12, fontFamily: UI_FONT, color: BRAND.softText, margin: "8px 4px", textAlign: "center" }}>
                No matches
              </p>
            )}
            {filteredOpts.map((opt) => {
              const active = selected.has(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onToggle(opt)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "8px 9px",
                    borderRadius: 8,
                    border: "none",
                    background: active ? BRAND.accentSoft : "transparent",
                    color: active ? BRAND.accent : BRAND.mutedText,
                    fontSize: 12.5,
                    fontFamily: UI_FONT,
                    fontWeight: active ? 600 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                    lineHeight: 1.35,
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 5,
                      flexShrink: 0,
                      border: `1.5px solid ${active ? BRAND.accent : BRAND.border}`,
                      background: active ? BRAND.accent : "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {active && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.4}>
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                  <span style={{ flex: 1 }}>{tidyInstrument(opt)}</span>
                </button>
              );
            })}
          </div>
          {count > 0 && (
            <button
              type="button"
              onClick={onClear}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "8px",
                border: `1px solid ${BRAND.border}`,
                borderRadius: 9,
                background: BRAND.searchBg,
                color: BRAND.mutedText,
                fontSize: 11.5,
                fontFamily: UI_FONT,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Clear {facet.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── Skeleton + empty ────────────────────────── */
function GridSkeleton({ isMobile }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))",
        gap: 16,
      }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="gx-skeleton" style={{ height: 190 }} />
      ))}
    </div>
  );
}

function EmptyState({ onClear }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px",
        gap: 14,
        color: BRAND.softText,
      }}
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} opacity={0.6}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <p style={{ fontSize: 15, fontFamily: UI_FONT, margin: 0, color: BRAND.mutedText }}>
        No financing options match your filters.
      </p>
      <button
        type="button"
        onClick={onClear}
        style={{
          padding: "9px 18px",
          border: `1px solid ${BRAND.accentBorder}`,
          borderRadius: 999,
          background: BRAND.accentSoft,
          color: BRAND.accent,
          fontSize: 12.5,
          fontFamily: UI_FONT,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Clear filters
      </button>
    </div>
  );
}
