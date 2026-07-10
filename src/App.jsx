import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Package, Truck, Receipt, TrendingUp, TrendingDown, Plus, Trash2, Upload,
  DollarSign, LayoutGrid, Tag, ChevronDown, X, Check, AlertCircle, Search,
  FileImage, CalendarDays, BadgeCheck, Settings, Star, Type, RotateCcw, Coins,
  Users, WifiOff, Layers2, ClipboardList, BookUser
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from "recharts";
import { supabase } from "./supabaseClient";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_CATEGORIES = [
  { id: "giveaways",     label: "Giveaways",       code: "GIV", color: "#C9A227" },
  { id: "branding",      label: "Branding",        code: "BRN", color: "#4C7BD9" },
  { id: "booths",        label: "Booths",          code: "BTH", color: "#8B6BC9" },
  { id: "fixed_tables",  label: "Fixed Tables",    code: "TBL", color: "#5FA8D3" },
  { id: "decoration",    label: "Decoration",      code: "DEC", color: "#3F8F8A" },
  { id: "production",    label: "Production",      code: "PRD", color: "#C94C5F" },
  { id: "props",         label: "Props",           code: "PRP", color: "#E0A458" },
  { id: "lights_sound",  label: "Lights & Sound",  code: "L&S", color: "#9B5DE5" },
];

const FONT_PRESETS = [
  {
    id: "editorial",
    label: "Editorial",
    blurb: "Fraunces display + IBM Plex Sans body",
    display: "'Fraunces', Georgia, serif",
    body: "'IBM Plex Sans', -apple-system, sans-serif",
    mono: "'IBM Plex Mono', 'SFMono-Regular', monospace",
    google: "Fraunces:wght@500;700|IBM+Plex+Sans:wght@400;500;600;700|IBM+Plex+Mono:wght@400;500;600",
  },
  {
    id: "modern",
    label: "Modern",
    blurb: "Space Grotesk display + Inter body",
    display: "'Space Grotesk', 'Arial Black', sans-serif",
    body: "'Inter', -apple-system, sans-serif",
    mono: "'JetBrains Mono', monospace",
    google: "Space+Grotesk:wght@500;700|Inter:wght@400;500;600;700|JetBrains+Mono:wght@400;500;600",
  },
  {
    id: "classic",
    label: "Classic",
    blurb: "Playfair Display + Source Sans 3",
    display: "'Playfair Display', Georgia, serif",
    body: "'Source Sans 3', -apple-system, sans-serif",
    mono: "'Courier Prime', monospace",
    google: "Playfair+Display:wght@500;700|Source+Sans+3:wght@400;500;600;700|Courier+Prime:wght@400;700",
  },
  {
    id: "technical",
    label: "Technical",
    blurb: "All-mono, blueprint feel",
    display: "'IBM Plex Mono', monospace",
    body: "'IBM Plex Mono', monospace",
    mono: "'IBM Plex Mono', monospace",
    google: "IBM+Plex+Mono:wght@400;500;600;700",
  },
];

const CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "THB", symbol: "฿", label: "Thai Baht" },
  { code: "EUR", symbol: "€", label: "Euro" },
];

const currencyMeta = (code) => CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
const fontById = (id) => FONT_PRESETS.find((f) => f.id === id) || FONT_PRESETS[0];

const UID = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// Formats a number as currency in the given ISO code, always rendering an
// actual currency symbol ($ / ฿ / €) rather than a 3-letter code.
function formatMoney(n, code = "USD") {
  const value = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    }).format(value);
  } catch {
    const meta = currencyMeta(code);
    return `${meta.symbol}${value.toFixed(2)}`;
  }
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const DEFAULT_SETTINGS = {
  fontId: "editorial",
  brandName: "EventLedger",
  brandSub: "Ops & Finance",
  welcomeTitle: "Command center",
  welcomeSubtitle: "Where the budget, the boxes, and the bills meet.",
  categoryLabels: {},
  currency: "USD",
};

/* ------------------------------------------------------------------ */
/*  Storage helpers — shared Supabase table, so every visitor reads     */
/*  and writes the same rows. Table: eo_kv(key text pk, value jsonb).   */
/* ------------------------------------------------------------------ */

const KEYS = {
  items: "eo:items",
  counters: "eo:counters",
  suppliers: "eo:suppliers",
  invoices: "eo:invoices",
  revenues: "eo:revenues",
  settings: "eo:settings",
  selectedSuppliers: "eo:selectedSuppliers",
  categorieslabels: "eo:categories",
};

async function loadKey(key, fallback) {
  try {
    const { data, error } = await supabase.from("eo_kv").select("value").eq("key", key).maybeSingle();
    if (error || !data) return fallback;
    return data.value ?? fallback;
  } catch {
    return fallback;
  }
}
async function saveKey(key, value) {
  try {
    await supabase.from("eo_kv").upsert({ key, value, updated_at: new Date().toISOString() });
  } catch {
    /* ignore — the change still applies locally, it just won't sync until the network recovers */
  }
}

/* ------------------------------------------------------------------ */
/*  Root component                                                     */
/* ------------------------------------------------------------------ */

export default function EventOpsApp() {
  const [tab, setTab] = useState("dashboard");
  const [loaded, setLoaded] = useState(false);

  const [items, setItems] = useState([]);
  const [counters, setCounters] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [revenues, setRevenues] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [selectedSuppliers, setSelectedSuppliers] = useState({});
  const [categorieslabels, setCategoriesLabels] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      const [i, c, s, inv, rev, set, sel, cats] = await Promise.all([
        loadKey(KEYS.items, []),
        loadKey(KEYS.counters, {}),
        loadKey(KEYS.suppliers, []),
        loadKey(KEYS.invoices, []),
        loadKey(KEYS.revenues, []),
        loadKey(KEYS.settings, DEFAULT_SETTINGS),
        loadKey(KEYS.selectedSuppliers, {}),
        loadKey(KEYS.categorieslabels, []),
      ]);
      setItems(i); setCounters(c); setSuppliers(s); setInvoices(inv); setRevenues(rev);
      setSettings({ ...DEFAULT_SETTINGS, ...set });
      setSelectedSuppliers(sel);
      setCategoriesLabels(cats);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) saveKey(KEYS.items, items); }, [items, loaded]);
  useEffect(() => { if (loaded) saveKey(KEYS.counters, counters); }, [counters, loaded]);
  useEffect(() => { if (loaded) saveKey(KEYS.suppliers, suppliers); }, [suppliers, loaded]);
  useEffect(() => { if (loaded) saveKey(KEYS.invoices, invoices); }, [invoices, loaded]);
  useEffect(() => { if (loaded) saveKey(KEYS.revenues, revenues); }, [revenues, loaded]);
  useEffect(() => { if (loaded) saveKey(KEYS.settings, settings); }, [settings, loaded]);
  useEffect(() => { if (loaded) saveKey(KEYS.categorieslabels, categorieslabels); }, [categorieslabels, loaded]);
  useEffect(() => { if (loaded) saveKey(KEYS.selectedSuppliers, selectedSuppliers); }, [selectedSuppliers, loaded]);

  // Realtime sync: when anyone else saves a row, apply it here too — so two
  // people looking at the app at once always see the same data within ~1s.
  const [connected, setConnected] = useState(true);
  const applying = useRef(new Set());
  useEffect(() => {
    const setterFor = {
      [KEYS.items]: setItems,
      [KEYS.counters]: setCounters,
      [KEYS.suppliers]: setSuppliers,
      [KEYS.invoices]: setInvoices,
      [KEYS.revenues]: setRevenues,
      [KEYS.settings]: (v) => setSettings({ ...DEFAULT_SETTINGS, ...v }),
      [KEYS.selectedSuppliers]: setSelectedSuppliers,
      [KEYS.categorieslabels]: setCategoriesLabels,
    };
    const channel = supabase
      .channel("eo_kv_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "eo_kv" }, (payload) => {
        const row = payload.new;
        if (!row || !row.key) return;
        const setter = setterFor[row.key];
        if (setter) setter(row.value);
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED" || status === undefined));
    return () => supabase.removeChannel(channel);
  }, []);

  // Load the fonts referenced by all presets once, so switching is instant.
  useEffect(() => {
    const families = FONT_PRESETS.map((f) => f.google).join("|");
    const href = `https://fonts.googleapis.com/css2?${families
      .split("|")
      .map((f) => `family=${f}`)
      .join("&")}&display=swap`;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  const notify = useCallback((msg, tone = "ok") => {
    setToast({ msg, tone, id: UID() });
    setTimeout(() => setToast(null), 2600);
  }, []);

  // Categories merged with any admin-renamed labels.
  const categories = useMemo(
    () => DEFAULT_CATEGORIES.map((c) => ({ ...c, label: settings.categoryLabels[c.id] || c.label })),
    [settings.categoryLabels]
  );

  //const catById = useCallback((id) => categories.find((c) => c.id === id) || categories[0], [categories]);
  const catById = useCallback((id) => {
    const cat = categorieslabels.find((c) => c.label === id);
    return cat || { id: id, label: id, code: id, color: "#8D98A8" };
  });

  const nextSerial = useCallback((categoryId) => {
    const cat = catById(categoryId);
    const n = (counters[categoryId] || 0) + 1;
    setCounters((prev) => ({ ...prev, [categoryId]: n }));
    return `${cat.code}-${String(n).padStart(4, "0")}`;
  }, [counters, catById]);

  const totals = useMemo(() => {
    const inventoryValue = items.reduce((s, it) => s + it.quantity * it.unitCost, 0);
    const totalExpenses = invoices.reduce((s, iv) => s + iv.amount, 0);
    const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
    const net = totalRevenue - totalExpenses;
    const unpaid = invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount, 0);
    return { inventoryValue, totalExpenses, totalRevenue, net, unpaid };
  }, [items, invoices, revenues]);

  const font = fontById(settings.fontId);
  const cssVars = {
    "--font-display": font.display,
    "--font-body": font.body,
    "--font-mono": font.mono,
  };

  // Shared currency: one setting, used everywhere amounts are shown.
  // The dropdown to change it lives on Suppliers, Invoices, P&L, and Inventory.
  const currencyCode = settings.currency;
  const fmt = useCallback((n) => formatMoney(n, currencyCode), [currencyCode]);
  const setCurrency = useCallback((code) => setSettings((prev) => ({ ...prev, currency: code })), []);

  if (!loaded) {
    return (
      <div style={{ ...styles.loadingScreen, ...cssVars }}>
        <div style={styles.spinner} />
      </div>
    );
  }

  return (
    <div style={{ ...styles.app, ...cssVars }}>
      <style>{globalCss}</style>
      <Sidebar tab={tab} setTab={setTab} totals={totals} settings={settings} fmt={fmt} connected={connected} />
      <main style={styles.main}>
        {tab === "dashboard" && (
          <Dashboard
            items={items} suppliers={suppliers} invoices={invoices} revenues={revenues}
            totals={totals} categories={categories} catById={catById}
            selectedSuppliers={selectedSuppliers} settings={settings} fmt={fmt}
          />
        )}
        {tab === "inventory" && (
          <Inventory
            items={items} setItems={setItems} nextSerial={nextSerial} notify={notify}
            categories={categorieslabels} catById={catById}
            fmt={fmt} currencyCode={currencyCode} setCurrency={setCurrency}
          />
        )}
        {tab === "suppliers" && (
          <Suppliers
            suppliers={suppliers} setSuppliers={setSuppliers} notify={notify}
            categories={categorieslabels} selectedSuppliers={selectedSuppliers} setSelectedSuppliers={setSelectedSuppliers}
            fmt={fmt} currencyCode={currencyCode} setCurrency={setCurrency}
          />
        )}
        {tab === "invoices" && (
          <Invoices
            invoices={invoices} setInvoices={setInvoices} notify={notify} categories={categorieslabels} catById={catById}
            fmt={fmt} currencyCode={currencyCode} setCurrency={setCurrency}
          />
        )}
        {tab === "pnl" && (
          <PnL
            invoices={invoices} revenues={revenues} setRevenues={setRevenues} notify={notify}
            fmt={fmt} currencyCode={currencyCode} setCurrency={setCurrency}
          />
        )}
        {tab === "admin" && (
          <AdminSettings settings={settings} setSettings={setSettings} categories={categories} notify={notify} />
        )}
        {tab === "admin" && (
          <CategoriesLabels items={categorieslabels} setItems={setCategoriesLabels} notify={notify} />
        )}
      </main>
      {toast && (
        <div style={{ ...styles.toast, borderColor: toast.tone === "ok" ? "#3F8F8A" : "#C94C5F" }}>
          {toast.tone === "ok" ? <Check size={16} color="#3F8F8A" /> : <AlertCircle size={16} color="#C94C5F" />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                             */
/* ------------------------------------------------------------------ */

function Sidebar({ tab, setTab, totals, settings, fmt, connected }) {
  const nav = [
    { id: "registeration", label: "Registeration", icon: BookUser },
    { id: "quickbook", label: "Quickbooks", icon: ClipboardList },
    { id: "dashboard", label: "Overview", icon: LayoutGrid },
    { id: "inventory", label: "Inventory", icon: Tag },
    { id: "suppliers", label: "Suppliers", icon: Truck },
    { id: "invoices", label: "Invoices", icon: Receipt },
    { id: "pnl", label: "P&L", icon: TrendingUp },
    // { id: "categories", label: "Categories", icon: Layers2 },
    { id: "admin", label: "Admin Settings", icon: Settings },
  ];
  const initials = (settings.brandName || "EO").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <aside style={styles.sidebar}>
      <div style={styles.brand}>
        <div style={styles.brandMark}>
          <img src="https://www.x2logisticsnetworks.com/images/logo/X2-Logo.png" alt="Logo" style={styles.brandMarkLogo} />
          {/* {initials} */}
        </div>
        <div>
          <div style={styles.brandName}>{settings.brandName}</div>
          <div style={styles.brandSub}>{settings.brandSub}</div>
        </div>
      </div>
      <nav style={{ marginTop: 28 }}>
        {nav.map((n) => {
          const Icon = n.icon;
          const active = tab === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              style={{ ...styles.navBtn, ...(active ? styles.navBtnActive : {}) }}
            >
              <Icon size={17} strokeWidth={2} />
              <span>{n.label}</span>
            </button>
          );
        })}
      </nav>
      <div style={styles.sideFooter}>
        <div style={{ ...styles.sideFooterRow, color: connected ? "#7FD1A8" : "#E38B96" }}>
          {connected ? <Users size={13} /> : <WifiOff size={13} />}
          <span>{connected ? "Live · shared with your team" : "Reconnecting…"}</span>
        </div>
        <div style={styles.sideFooterRow}>
          <span>Net P&amp;L</span>
          <b style={{ color: totals.net >= 0 ? "#7FD1A8" : "#E38B96" }}>{fmt(totals.net)}</b>
        </div>
        <div style={styles.sideFooterRow}>
          <span>Unpaid invoices</span>
          <b>{fmt(totals.unpaid)}</b>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Currency selector (shared by Suppliers, Invoices, P&L, Inventory)    */
/* ------------------------------------------------------------------ */

function CurrencySelect({ value, onChange }) {
  return (
    <label style={styles.currencyBox}>
      <Coins size={14} color="#8D98A8" />
      <select
        style={styles.currencySelect}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                           */
/* ------------------------------------------------------------------ */

function Dashboard({ items, suppliers, invoices, revenues, totals, categories, catById, selectedSuppliers, settings, fmt }) {
  const byCategory = categories.map((c) => ({
    name: c.code,
    full: c.label,
    color: c.color,
    count: items.filter((i) => i.category === c.id).length,
    value: items.filter((i) => i.category === c.id).reduce((s, i) => s + i.quantity * i.unitCost, 0),
  }));

  const expenseByCategory = categories.map((c) => ({
    name: c.label,
    value: invoices.filter((i) => i.category === c.id).reduce((s, i) => s + i.amount, 0),
    color: c.color,
  })).filter((d) => d.value > 0);

  // Automated analysis: compare what's budgeted (chosen/cheapest vendor x qty on hand)
  // against what's actually been invoiced, per category.
  const budgetRows = categories.map((c) => {
    const options = suppliers.filter((s) => s.category === c.id);
    if (options.length === 0) return null;
    const cheapest = options.reduce((a, b) => (b.price < a.price ? b : a));
    const chosenId = selectedSuppliers[c.id];
    const chosen = options.find((s) => s.id === chosenId) || cheapest;
    const qty = items.filter((i) => i.category === c.id).reduce((s, i) => s + i.quantity, 0) || 1;
    const projected = chosen.price * qty;
    const actual = invoices.filter((i) => i.category === c.id).reduce((s, i) => s + i.amount, 0);
    return { cat: c, chosen, projected, actual, variance: actual - projected, qty };
  }).filter(Boolean);

  return (
    <div>
      <PageHeader eyebrow="Overview" title={settings.welcomeTitle} subtitle={settings.welcomeSubtitle} />

      <div style={styles.cardRow}>
        <StatCard icon={DollarSign} label="Total revenue" value={fmt(totals.totalRevenue)} tone="good" />
        <StatCard icon={Receipt} label="Total expenses" value={fmt(totals.totalExpenses)} tone="bad" />
        <StatCard icon={TrendingUp} label="Net P&L" value={fmt(totals.net)} tone={totals.net >= 0 ? "good" : "bad"} />
        <StatCard icon={Package} label="Inventory value" value={fmt(totals.inventoryValue)} tone="neutral" />
      </div>

      <div style={styles.twoCol}>
        <Panel title="Inventory by category" subtitle={`${items.length} serialized items tracked`}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byCategory} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#2A3340" />
              <XAxis dataKey="name" tick={{ fill: "#8D98A8", fontSize: 12 }} axisLine={{ stroke: "#2A3340" }} tickLine={false} />
              <YAxis tick={{ fill: "#8D98A8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#ffffff", border: "1px solid #2A3340", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#1B2430" }}
                formatter={(v, k, p) => [k === "count" ? v : fmt(v), p.payload.full]}
              />
              <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                {byCategory.map((d, idx) => <Cell key={idx} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Spend by category" subtitle="From logged invoices">
          {expenseByCategory.length === 0 ? (
            <EmptyState text="No invoice spend logged yet." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={expenseByCategory} dataKey="value" nameKey="name" innerRadius={54} outerRadius={92} paddingAngle={2}>
                  {expenseByCategory.map((d, idx) => <Cell key={idx} fill={d.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#ffffff", border: "1px solid #2A3340", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => fmt(v)}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "#8D98A8" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <Panel title="Selected vendor per category" subtitle="Chosen from the supplier comparison matrix — cheapest wins unless overridden">
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Selected supplier</th>
                <th style={styles.th}>Item / Service</th>
                <th style={styles.th}>Price</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const options = suppliers.filter((s) => s.category === c.id);
                if (options.length === 0) return null;
                const cheapest = options.reduce((a, b) => (b.price < a.price ? b : a));
                const chosenId = selectedSuppliers[c.id];
                const chosen = options.find((s) => s.id === chosenId) || cheapest;
                return (
                  <tr key={c.id}>
                    <td style={styles.td}><CategoryTag cat={c} /></td>
                    <td style={styles.td}>
                      {chosen.name}
                      {chosen.id === cheapest.id ? (
                        <span style={styles.bestBadge}><BadgeCheck size={12} /> Best price</span>
                      ) : (
                        <span style={styles.pickBadge}><Star size={12} /> Chosen</span>
                      )}
                    </td>
                    <td style={styles.td}>{chosen.itemService}</td>
                    <td style={{ ...styles.td, color: "#7FD1A8", fontFamily: "var(--font-mono)" }}>{fmt(chosen.price)}</td>
                  </tr>
                );
              })}
              {suppliers.length === 0 && (
                <tr><td style={styles.td} colSpan={4}><EmptyState text="No suppliers added yet." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Budget vs. actual, by category" subtitle="Projected = chosen vendor's price × quantity on hand. Actual = amount invoiced so far.">
        {budgetRows.length === 0 ? (
          <EmptyState text="Add supplier quotes and inventory items to see projections." />
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Category</th>
                  <th style={styles.th}>Qty</th>
                  <th style={styles.th}>Projected</th>
                  <th style={styles.th}>Actual</th>
                  <th style={styles.th}>Variance</th>
                </tr>
              </thead>
              <tbody>
                {budgetRows.map((r) => (
                  <tr key={r.cat.id}>
                    <td style={styles.td}><CategoryTag cat={r.cat} /></td>
                    <td style={styles.td}>{r.qty}</td>
                    <td style={{ ...styles.td, fontFamily: "var(--font-mono)" }}>{fmt(r.projected)}</td>
                    <td style={{ ...styles.td, fontFamily: "var(--font-mono)" }}>{fmt(r.actual)}</td>
                    <td style={{ ...styles.td, fontFamily: "var(--font-mono)", color: r.variance > 0 ? "#E38B96" : "#7FD1A8" }}>
                      {r.variance > 0 ? "+" : ""}{fmt(r.variance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  const toneColor = tone === "good" ? "#7FD1A8" : tone === "bad" ? "#E38B96" : "#F4EFE4";
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}><Icon size={17} color="#C9A227" /></div>
      <div>
        <div style={styles.statLabel}>{label}</div>
        <div style={{ ...styles.statValue, color: toneColor }}>{value}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inventory (serialized items)                                        */
/* ------------------------------------------------------------------ */

function Inventory({ items, setItems, nextSerial, notify, categories, catById, fmt, currencyCode, setCurrency }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(blankItem());

  function blankItem() {
    return { name: "", category: categories[0].id, quantity: 1, unitCost: 0, event: "" };
  }

  function addItem(e) {
    e.preventDefault();
    if (!form.name.trim()) return notify("Item name is required.", "err");
    const serial = nextSerial(form.category);
    const newItem = {
      id: UID(),
      serial,
      name: form.name.trim(),
      category: form.category,
      quantity: Number(form.quantity) || 1,
      unitCost: Number(form.unitCost) || 0,
      event: form.event.trim(),
      createdAt: todayStr(),
    };
    setItems((prev) => [newItem, ...prev]);
    setForm(blankItem());
    notify(`${serial} added to inventory.`);
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const filtered = items
    .filter((i) => (filter === "all" ? true : i.category === filter))
    .filter((i) => (query ? (i.name + i.serial + i.event).toLowerCase().includes(query.toLowerCase()) : true));

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Serialized items"
        subtitle="Every item gets a tracked tag: category code + running number."
        right={<CurrencySelect value={currencyCode} onChange={setCurrency} />}
      />

      <Panel title="Add item" subtitle={`A serial number is generated automatically on save · unit cost in ${currencyCode}`}>
        <form onSubmit={addItem} style={styles.formGrid}>
          <Field label="Item name">
            <input style={styles.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Branded tote bag" />
          </Field>
          <Field label="Category">
            <select style={styles.input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => <option key={c.id} value={c.label}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Quantity">
            <input type="number" min="1" style={styles.input} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </Field>
          <Field label={`Unit cost (${currencyMeta(currencyCode).symbol})`}>
            <input type="number" min="0" step="0.01" style={styles.input} value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
          </Field>
          <Field label="Event / notes (optional)">
            <input style={styles.input} value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })} placeholder="e.g. TechExpo 2026" />
          </Field>
          <button type="submit" style={styles.primaryBtn}><Plus size={16} /> Add &amp; generate serial</button>
        </form>
      </Panel>

      <Panel
        title="All items"
        subtitle={`${filtered.length} of ${items.length} shown`}
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <div style={styles.searchBox}>
              <Search size={14} color="#8D98A8" />
              <input style={styles.searchInput} placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select style={{ ...styles.input, width: 170 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.label}>{c.label}</option>)}
            </select>
          </div>
        }
      >
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Serial</th>
                <th style={styles.th}>Item</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Qty</th>
                <th style={styles.th}>Unit cost</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Event</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id}>
                  <td style={{ ...styles.td, fontFamily: "var(--font-mono)", color: "#C9A227" }}>{it.serial}</td>
                  <td style={styles.td}>{it.name}</td>
                  <td style={styles.td}><CategoryTag cat={catById(it.category)} /></td>
                  <td style={styles.td}>{it.quantity}</td>
                  <td style={styles.td}>{fmt(it.unitCost)}</td>
                  <td style={{ ...styles.td, fontFamily: "var(--font-mono)" }}>{fmt(it.quantity * it.unitCost)}</td>
                  <td style={styles.td}>{it.event || "—"}</td>
                  <td style={styles.td}>
                    <button style={styles.iconBtn} onClick={() => removeItem(it.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td style={styles.td} colSpan={8}><EmptyState text="No items match. Add one above." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Suppliers (comparison + select-best-price)                          */
/* ------------------------------------------------------------------ */

function Suppliers({ suppliers, setSuppliers, notify, categories, selectedSuppliers, setSelectedSuppliers, fmt, currencyCode, setCurrency }) {
  const [form, setForm] = useState(blank());
  const [group, setGroup] = useState("all");

  function blank() {
    return { name: "", category: categories[0].id, itemService: "", price: "", leadTimeDays: "", contact: "" };
  }

  function addSupplier(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.itemService.trim() || form.price === "") {
      return notify("Name, item/service, and price are required.", "err");
    }
    setSuppliers((prev) => [
      { id: UID(), ...form, price: Number(form.price), leadTimeDays: Number(form.leadTimeDays) || 0 },
      ...prev,
    ]);
    setForm(blank());
    notify("Supplier quote saved.");
  }

  function removeSupplier(id) {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  }

  function selectVendor(categoryId, supplierId) {
    setSelectedSuppliers((prev) => ({ ...prev, [categoryId]: supplierId }));
    notify("Vendor selected for this category.");
  }

  const groups = (group === "all" ? categories : categories.filter((c) => c.id === group)).map((c) => ({
    cat: c,
    rows: suppliers.filter((s) => s.category === c.id).sort((a, b) => a.price - b.price),
  })).filter((g) => g.rows.length > 0);

  return (
    <div>
      <PageHeader
        eyebrow="Suppliers"
        title="Price comparison"
        subtitle="Quotes grouped by category, cheapest first. Pick the vendor you'll actually use."
        right={<CurrencySelect value={currencyCode} onChange={setCurrency} />}
      />

      <Panel title="Add a supplier quote" subtitle={`Quoted price in ${currencyCode}`}>
        <form onSubmit={addSupplier} style={styles.formGrid}>
          <Field label="Supplier name">
            <input style={styles.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Prime Print Co." />
          </Field>
          <Field label="Category">
            <select style={styles.input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => <option key={c.id} value={c.label}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Item / service quoted">
            <input style={styles.input} value={form.itemService} onChange={(e) => setForm({ ...form, itemService: e.target.value })} placeholder="e.g. 500 tote bags" />
          </Field>
          <Field label={`Price (${currencyMeta(currencyCode).symbol})`}>
            <input type="number" min="0" step="0.01" style={styles.input} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label="Lead time (days)">
            <input type="number" min="0" style={styles.input} value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} />
          </Field>
          <Field label="Contact (optional)">
            <input style={styles.input} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="email or phone" />
          </Field>
          <button type="submit" style={styles.primaryBtn}><Plus size={16} /> Save quote</button>
        </form>
      </Panel>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <select style={{ ...styles.input, width: 200 }} value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.label}>{c.label}</option>)}
        </select>
      </div>

      {groups.length === 0 && (
        <Panel><EmptyState text="No supplier quotes yet. Add one above to start comparing." /></Panel>
      )}

      {groups.map(({ cat, rows }) => {
        const cheapest = rows[0];
        const chosenId = selectedSuppliers[cat.id];
        return (
          <Panel key={cat.id} title={<CategoryTag cat={cat} />} subtitle={`${rows.length} quote${rows.length > 1 ? "s" : ""}`}>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Supplier</th>
                    <th style={styles.th}>Item / service</th>
                    <th style={styles.th}>Price</th>
                    <th style={styles.th}>Lead time</th>
                    <th style={styles.th}>Contact</th>
                    <th style={styles.th}></th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const isCheapest = s.id === cheapest.id;
                    const isChosen = chosenId ? chosenId === s.id : isCheapest;
                    return (
                      <tr key={s.id} style={isChosen ? styles.trChosen : undefined}>
                        <td style={styles.td}>
                          {s.name}
                          {isCheapest && <span style={styles.bestBadge}><BadgeCheck size={12} /> Best price</span>}
                          {isChosen && !isCheapest && <span style={styles.pickBadge}><Star size={12} /> Chosen</span>}
                        </td>
                        <td style={styles.td}>{s.itemService}</td>
                        <td style={{ ...styles.td, fontFamily: "var(--font-mono)", color: isCheapest ? "#7FD1A8" : "#F4EFE4" }}>{fmt(s.price)}</td>
                        <td style={styles.td}>{s.leadTimeDays ? `${s.leadTimeDays}d` : "—"}</td>
                        <td style={styles.td}>{s.contact || "—"}</td>
                        <td style={styles.td}>
                          <button
                            style={{ ...styles.chooseBtn, ...(isChosen ? styles.chooseBtnActive : {}) }}
                            onClick={() => selectVendor(cat.id, s.id)}
                          >
                            {isChosen ? "Selected" : "Select"}
                          </button>
                        </td>
                        <td style={styles.td}><button style={styles.iconBtn} onClick={() => removeSupplier(s.id)}><Trash2 size={14} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Invoices (upload + save + payment status)                           */
/* ------------------------------------------------------------------ */

function Invoices({ invoices, setInvoices, notify, categories, catById, fmt, currencyCode, setCurrency }) {
  const [form, setForm] = useState(blank());
  const [statusFilter, setStatusFilter] = useState("all");
  const [preview, setPreview] = useState(null);

  function blank() {
    return { vendor: "", category: categories[5] ? categories[5].id : categories[0].id, amount: "", date: todayStr(), status: "unpaid", notes: "", fileData: null, fileName: "" };
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      notify("File too large — please keep under 4MB.", "err");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, fileData: reader.result, fileName: file.name }));
    reader.readAsDataURL(file);
  }

  function addInvoice(e) {
    e.preventDefault();
    if (!form.vendor.trim() || form.amount === "") return notify("Vendor and amount are required.", "err");
    setInvoices((prev) => [
      { id: UID(), ...form, amount: Number(form.amount) },
      ...prev,
    ]);
    setForm(blank());
    notify("Invoice saved.");
  }

  function removeInvoice(id) {
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  }

  function toggleStatus(id) {
    setInvoices((prev) => prev.map((i) => i.id === id ? { ...i, status: i.status === "paid" ? "unpaid" : "paid" } : i));
  }

  const filtered = invoices.filter((i) => statusFilter === "all" ? true : i.status === statusFilter);

  return (
    <div>
      <PageHeader
        eyebrow="Invoices"
        title="Upload &amp; track payments"
        subtitle="Attach the source file, log the amount, mark it paid when it's settled."
        right={<CurrencySelect value={currencyCode} onChange={setCurrency} />}
      />

      <Panel title="Log an invoice" subtitle={`Amount in ${currencyCode}`}>
        <form onSubmit={addInvoice} style={styles.formGrid}>
          <Field label="Vendor">
            <input style={styles.input} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Prime Print Co." />
          </Field>
          <Field label="Category">
            <select style={styles.input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => <option key={c.id} value={c.label}>{c.label}</option>)}
            </select>
          </Field>
          <Field label={`Amount (${currencyMeta(currencyCode).symbol})`}>
            <input type="number" min="0" step="0.01" style={styles.input} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label="Invoice date">
            <input type="date" style={styles.input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Status">
            <select style={styles.input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </Field>
          <Field label="Attach file (image/PDF, under 4MB)">
            <label style={styles.uploadBox}>
              <Upload size={14} />
              <span>{form.fileName || "Choose file…"}</span>
              <input type="file" accept="image/*,application/pdf" onChange={onFile} style={{ display: "none" }} />
            </label>
          </Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Notes (optional)">
              <input style={styles.input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="What is this invoice for?" />
            </Field>
          </div>
          <button type="submit" style={styles.primaryBtn}><Plus size={16} /> Save invoice</button>
        </form>
      </Panel>

      <Panel
        title="All invoices"
        subtitle={`${filtered.length} of ${invoices.length} shown`}
        right={
          <select style={{ ...styles.input, width: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        }
      >
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Vendor</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>File</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((iv) => (
                <tr key={iv.id}>
                  <td style={styles.td}>{iv.vendor}{iv.notes && <div style={styles.subNote}>{iv.notes}</div>}</td>
                  <td style={styles.td}><CategoryTag cat={catById(iv.category)} /></td>
                  <td style={{ ...styles.td, fontFamily: "var(--font-mono)" }}>{fmt(iv.amount)}</td>
                  <td style={styles.td}>{iv.date}</td>
                  <td style={styles.td}>
                    <button onClick={() => toggleStatus(iv.id)} style={{ ...styles.statusPill, ...(iv.status === "paid" ? styles.statusPaid : styles.statusUnpaid) }}>
                      {iv.status === "paid" ? "Paid" : "Unpaid"}
                    </button>
                  </td>
                  <td style={styles.td}>
                    {iv.fileData ? (
                      <button style={styles.iconBtn} onClick={() => setPreview(iv)}><FileImage size={14} /></button>
                    ) : "—"}
                  </td>
                  <td style={styles.td}><button style={styles.iconBtn} onClick={() => removeInvoice(iv.id)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td style={styles.td} colSpan={7}><EmptyState text="No invoices logged yet." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {preview && (
        <div style={styles.modalOverlay} onClick={() => setPreview(null)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <span>{preview.fileName}</span>
              <button style={styles.iconBtn} onClick={() => setPreview(null)}><X size={16} /></button>
            </div>
            {preview.fileData?.startsWith("data:image") ? (
              <img src={preview.fileData} alt={preview.fileName} style={{ maxWidth: "100%", borderRadius: 8 }} />
            ) : (
              <a href={preview.fileData} download={preview.fileName} style={styles.primaryBtn}>Download file</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  P&L                                                                  */
/* ------------------------------------------------------------------ */

function PnL({ invoices, revenues, setRevenues, notify, fmt, currencyCode, setCurrency }) {
  const [form, setForm] = useState({ event: "", description: "", amount: "", date: todayStr() });

  function addRevenue(e) {
    e.preventDefault();
    if (!form.description.trim() || form.amount === "") return notify("Description and amount are required.", "err");
    setRevenues((prev) => [{ id: UID(), ...form, amount: Number(form.amount) }, ...prev]);
    setForm({ event: "", description: "", amount: "", date: todayStr() });
    notify("Revenue entry added.");
  }

  function removeRevenue(id) {
    setRevenues((prev) => prev.filter((r) => r.id !== id));
  }

  const monthly = useMemo(() => {
    const map = {};
    const bump = (date, key, val) => {
      const m = (date || todayStr()).slice(0, 7);
      map[m] = map[m] || { month: m, revenue: 0, expense: 0 };
      map[m][key] += val;
    };
    revenues.forEach((r) => bump(r.date, "revenue", r.amount));
    invoices.forEach((i) => bump(i.date, "expense", i.amount));
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).map((d) => ({ ...d, net: d.revenue - d.expense }));
  }, [revenues, invoices]);

  const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
  const totalExpense = invoices.reduce((s, i) => s + i.amount, 0);
  const net = totalRevenue - totalExpense;
  const margin = totalRevenue > 0 ? (net / totalRevenue) * 100 : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Profit &amp; loss"
        subtitle="Revenue entries against everything logged in invoices."
        right={<CurrencySelect value={currencyCode} onChange={setCurrency} />}
      />

      <div style={styles.cardRow}>
        <StatCard icon={DollarSign} label="Revenue" value={fmt(totalRevenue)} tone="good" />
        <StatCard icon={Receipt} label="Expenses" value={fmt(totalExpense)} tone="bad" />
        <StatCard icon={net >= 0 ? TrendingUp : TrendingDown} label="Net P&L" value={fmt(net)} tone={net >= 0 ? "good" : "bad"} />
        <StatCard icon={TrendingUp} label="Margin" value={`${margin.toFixed(1)}%`} tone={margin >= 0 ? "good" : "bad"} />
      </div>

      <Panel title="Revenue vs. expense by month">
        {monthly.length === 0 ? (
          <EmptyState text="Add revenue entries and invoices to see the trend." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#2A3340" />
              <XAxis dataKey="month" tick={{ fill: "#8D98A8", fontSize: 12 }} axisLine={{ stroke: "#2A3340" }} tickLine={false} />
              <YAxis tick={{ fill: "#8D98A8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#1B2430", border: "1px solid #2A3340", borderRadius: 8, fontSize: 12 }}
                formatter={(v) => fmt(v)}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8D98A8" }} />
              <Bar dataKey="revenue" name="Revenue" fill="#3F8F8A" radius={[5, 5, 0, 0]} />
              <Bar dataKey="expense" name="Expense" fill="#C94C5F" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel title="Add revenue entry" subtitle={`Amount in ${currencyCode}`}>
        <form onSubmit={addRevenue} style={styles.formGrid}>
          <Field label="Event">
            <input style={styles.input} value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })} placeholder="e.g. TechExpo 2026" />
          </Field>
          <Field label="Description">
            <input style={styles.input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Sponsorship package" />
          </Field>
          <Field label={`Amount (${currencyMeta(currencyCode).symbol})`}>
            <input type="number" min="0" step="0.01" style={styles.input} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label="Date">
            <input type="date" style={styles.input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <button type="submit" style={styles.primaryBtn}><Plus size={16} /> Add revenue</button>
        </form>
      </Panel>

      <Panel title="Revenue log" subtitle={`${revenues.length} entries`}>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Event</th>
                <th style={styles.th}>Description</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {revenues.map((r) => (
                <tr key={r.id}>
                  <td style={styles.td}>{r.event || "—"}</td>
                  <td style={styles.td}>{r.description}</td>
                  <td style={{ ...styles.td, fontFamily: "var(--font-mono)", color: "#7FD1A8" }}>{fmt(r.amount)}</td>
                  <td style={styles.td}>{r.date}</td>
                  <td style={styles.td}><button style={styles.iconBtn} onClick={() => removeRevenue(r.id)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
              {revenues.length === 0 && (
                <tr><td style={styles.td} colSpan={5}><EmptyState text="No revenue entries yet." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Admin Settings (fonts + editable text)                              */
/* ------------------------------------------------------------------ */

function AdminSettings({ settings, setSettings, categories, notify }) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => setDraft(settings), [settings]);

  function save() {
    setSettings(draft);
    notify("Settings saved.");
  }

  function resetAll() {
    setDraft(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
    notify("Settings reset to defaults.");
  }

  function setCatLabel(id, label) {
    setDraft((d) => ({ ...d, categoryLabels: { ...d.categoryLabels, [id]: label } }));
  }

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Settings" subtitle="Adjust typography and rewrite the labels shown throughout the app." />

      <Panel title="Typography" subtitle="Pick a display + body pairing. Applies everywhere immediately after saving.">
        <div style={styles.fontGrid}>
          {FONT_PRESETS.map((f) => {
            const active = draft.fontId === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setDraft((d) => ({ ...d, fontId: f.id }))}
                style={{ ...styles.fontCard, ...(active ? styles.fontCardActive : {}) }}
              >
                <div style={{ fontFamily: f.display, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontFamily: f.body, fontSize: 12, color: "#8D98A8" }}>{f.blurb}</div>
                {active && <span style={styles.fontCheck}><Check size={14} /></span>}
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="Default currency" subtitle="Sets the currency shown on Inventory, Suppliers, Invoices, and P&L. Each of those pages can also switch it directly.">
        <div style={styles.fontGrid}>
          {CURRENCIES.map((c) => {
            const active = draft.currency === c.code;
            return (
              <button
                key={c.code}
                onClick={() => setDraft((d) => ({ ...d, currency: c.code }))}
                style={{ ...styles.fontCard, ...(active ? styles.fontCardActive : {}) }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, fontFamily: "var(--font-mono)" }}>{c.symbol} {c.code}</div>
                <div style={{ fontSize: 12, color: "#8D98A8" }}>{c.label}</div>
                {active && <span style={styles.fontCheck}><Check size={14} /></span>}
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="Brand text" subtitle="Shown in the sidebar and on the Overview page">
        <div style={styles.formGrid}>
          <Field label="Brand name">
            <input style={styles.input} value={draft.brandName} onChange={(e) => setDraft({ ...draft, brandName: e.target.value })} />
          </Field>
          <Field label="Brand tagline">
            <input style={styles.input} value={draft.brandSub} onChange={(e) => setDraft({ ...draft, brandSub: e.target.value })} />
          </Field>
          <Field label="Overview title">
            <input style={styles.input} value={draft.welcomeTitle} onChange={(e) => setDraft({ ...draft, welcomeTitle: e.target.value })} />
          </Field>
          <Field label="Overview subtitle">
            <input style={styles.input} value={draft.welcomeSubtitle} onChange={(e) => setDraft({ ...draft, welcomeSubtitle: e.target.value })} />
          </Field>
        </div>
      </Panel>

      {/* <Panel title="Category labels" subtitle="Rename any category. Serial codes and colors stay the same so old serials keep making sense.">
        <div style={styles.formGrid}>
          {categories.map((c) => (
            <Field key={c.id} label={`${c.code} · ${DEFAULT_CATEGORIES.find((d) => d.id === c.id)?.label}`}>
              <input
                style={styles.input}
                value={draft.categoryLabels?.[c.id] ?? c.label}
                onChange={(e) => setCatLabel(c.id, e.target.value)}
              />
            </Field>
          ))}
        </div>
      </Panel> */}

      <div style={{ display: "flex", gap: 10 }}>
        <button style={styles.primaryBtn} onClick={save}><Check size={16} /> Save changes</button>
        <button style={styles.ghostBtn} onClick={resetAll}><RotateCcw size={14} /> Reset to defaults</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Category Labels                                                   */
/* ------------------------------------------------------------------ */
function CategoriesLabels({ items, setItems, notify }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ label: "", code: "", color: "" });

  function addItem(e) {
    e.preventDefault();
    if (!form.label.trim()) return notify("Category name is required.", "err");
    const newItem = {
      id: UID(),
      label: form.label.trim(),
      color: form.color.trim() || "#C9A227",
    };
    setItems((prev) => [newItem, ...prev]);
    setForm({ label: "", code: "", color: "" });
    notify(`Category "${form.label}" added.`);
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    notify("Category deleted.");
  }

  const filtered = items
    .filter((i) => (filter === "all" ? true : i.label === filter))
    .filter((i) => (query ? (i.label).toLowerCase().includes(query.toLowerCase()) : true));

  return (
    <div style={{ paddingTop: 50 }}>
      <PageHeader eyebrow="Categories" title="Category labels" subtitle="You can add, edit, or delete any category." />
      <Panel title="Add Category">
        <form onSubmit={addItem} style={styles.formGrid}>
          <Field label="Category name">
            <input style={styles.input} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Branded tote bag" />
          </Field>
          <Field label="Tag color (Please fill in the colors in hex format (e.g. #FF0000).)">
            <a href="https://share.google/Kf5On64mjyZIDYyCm" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#C9A227", textDecoration: "underline" }}>Pick a color</a> 
            <input style={styles.input} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="e.g. #FF0000" />
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" style={styles.primaryBtn}><Plus size={16} /> Add Category</button>
          </div>
        </form>
      </Panel>
      <Panel
        title="All Categories" subtitle={`Please always check the list. If you delete a category, items assigned to that category will not be displayed.`}
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <div style={styles.searchBox}>
              <Search size={14} color="#8D98A8" />
              <input style={styles.searchInput} placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
        }
      >
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Item</th>
                <th style={styles.th}>Color</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id}>
                  <td style={styles.td}>{it.label}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.catTag, borderColor: it.color, color: it.color }}>
                      <span style={{ ...styles.catDot, background: it.color }} />
                      {it.color}
                    </span>
                  </td> 
                  <td style={styles.td}>
                    <button style={styles.iconBtn} onClick={() => removeItem(it.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td style={styles.td} colSpan={2}><EmptyState text="No items match. Add one above." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared bits                                                         */
/* ------------------------------------------------------------------ */

function PageHeader({ eyebrow, title, subtitle, right }) {
  return (
    <div style={styles.pageHeadRow}>
      <div style={{ marginBottom: 22 }}>
        <div style={styles.eyebrow}>{eyebrow}</div>
        <h1 style={styles.pageTitle}>{title}</h1>
        {subtitle && <p style={styles.pageSubtitle}>{subtitle}</p>}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

function Panel({ title, subtitle, right, children }) {
  return (
    <div style={styles.panel}>
      {(title || right) && (
        <div style={styles.panelHead}>
          <div>
            {title && <div style={styles.panelTitle}>{title}</div>}
            {subtitle && <div style={styles.panelSubtitle}>{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={styles.fieldWrap}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function CategoryTag({ cat }) {
  return (
    <span style={{ ...styles.catTag, borderColor: cat.color, color: cat.color }}>
      <span style={{ ...styles.catDot, background: cat.color }} />
      {cat.label}
    </span>
  );
}

function EmptyState({ text }) {
  return <div style={styles.emptyState}>{text}</div>;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                               */
/* ------------------------------------------------------------------ */

const globalCss = `
  * { box-sizing: border-box; }
  input:focus, select:focus, button:focus { outline: 2px solid #C9A227; outline-offset: 1px; }
  table { border-collapse: collapse; width: 100%; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: #2A3340; border-radius: 4px; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

const styles = {
  app: {
    display: "flex",
    minHeight: "100vh",
    background: "#141A22",
    color: "#F4EFE4",
    fontFamily: "var(--font-body)",
  },
  loadingScreen: { display: "flex", alignItems: "center", justifyContent: "center", height: 400, background: "#141A22" },
  spinner: { width: 28, height: 28, border: "3px solid #2A3340", borderTopColor: "#C9A227", borderRadius: "50%", animation: "spin 0.8s linear infinite" },

  sidebar: {
    width: 220,
    flexShrink: 0,
    background: "#1B2430",
    borderRight: "1px solid #2A3340",
    padding: "22px 16px",
    display: "flex",
    flexDirection: "column",
  },
  brand: { display: "block", alignItems: "center", gap: 10 },
  /*brandMark: { width: "50%", height: "100%", borderRadius: "50%", background: "linear-gradient(135deg,#C9A227,#8B6B1F)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, color: "#141A22", margin: "0 auto" },*/
  brandMarkLogo: { width: "50%", height: "auto", marginTop: 2, textAlign: "center",display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" },
  brandName: { fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.01em", fontFamily: "var(--font-display)", lineHeight: "20px", textAlign: "center", paddingTop: 20 },
  brandSub: { fontSize: 11, color: "#8D98A8", marginTop: 10, textAlign: "center" },

  navBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    marginBottom: 4,
    background: "transparent",
    border: "none",
    borderRadius: 8,
    color: "#B7C0CC",
    fontSize: 13.5,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
  },
  navBtnActive: { background: "#242E3B", color: "#F4EFE4" },

  sideFooter: { marginTop: "auto", paddingTop: 16, borderTop: "1px solid #2A3340" },
  sideFooterRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, fontSize: 12, color: "#8D98A8", marginBottom: 6, fontFamily: "var(--font-mono)" },

  main: { flex: 1, padding: "30px 34px", overflowX: "hidden" },

  pageHeadRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" },
  eyebrow: { fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C9A227", marginBottom: 6 },
  pageTitle: { fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.02em", fontFamily: "var(--font-display)" },
  pageSubtitle: { fontSize: 13.5, color: "#8D98A8", marginTop: 6 },

  cardRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 22 },
  statCard: { background: "#1B2430", border: "1px solid #2A3340", borderRadius: 12, padding: "16px 18px", display: "flex", gap: 12, alignItems: "flex-start" },
  statIcon: { width: 34, height: 34, borderRadius: 8, background: "#242E3B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  statLabel: { fontSize: 12, color: "#8D98A8" },
  statValue: { fontSize: 19, fontWeight: 700, fontFamily: "var(--font-mono)", marginTop: 3 },

  twoCol: { display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 },

  panel: { background: "#1B2430", border: "1px solid #2A3340", borderRadius: 12, padding: 20, marginBottom: 16 },
  panelHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 },
  panelTitle: { fontSize: 15, fontWeight: 600 },
  panelSubtitle: { fontSize: 12, color: "#8D98A8", marginTop: 2 },

  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, alignItems: "end" },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11.5, color: "#8D98A8" },
  input: { background: "#141A22", border: "1px solid #2A3340", borderRadius: 8, padding: "9px 10px", color: "#F4EFE4", fontSize: 13, fontFamily: "inherit" },

  primaryBtn: { display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "center", background: "#C9A227", border: "none", borderRadius: 8, padding: "10px 16px", color: "#141A22", fontWeight: 600, fontSize: 13, cursor: "pointer", height: 38, textDecoration: "none" },
  ghostBtn: { display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "center", background: "transparent", border: "1px solid #2A3340", borderRadius: 8, padding: "10px 16px", color: "#B7C0CC", fontWeight: 600, fontSize: 13, cursor: "pointer", height: 38 },

  searchBox: { display: "flex", alignItems: "center", gap: 6, background: "#141A22", border: "1px solid #2A3340", borderRadius: 8, padding: "0 10px", height: 36 },
  searchInput: { background: "transparent", border: "none", color: "#F4EFE4", fontSize: 13, outline: "none", width: 130 },

  currencyBox: { display: "flex", alignItems: "center", gap: 6, background: "#1B2430", border: "1px solid #2A3340", borderRadius: 8, padding: "0 10px", height: 38 },
  currencySelect: { background: "transparent", border: "none", color: "#F4EFE4", fontSize: 13, fontFamily: "var(--font-mono)", outline: "none", cursor: "pointer", height: 36 },

  tableWrap: { overflowX: "auto" },
  table: { width: "100%", fontSize: 13 },
  th: { textAlign: "left", padding: "8px 10px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "#8D98A8", borderBottom: "1px solid #2A3340", whiteSpace: "nowrap" },
  td: { padding: "10px 10px", borderBottom: "1px solid #232B37", whiteSpace: "nowrap" },
  subNote: { fontSize: 11, color: "#8D98A8", marginTop: 2, whiteSpace: "normal" },
  trChosen: { background: "rgba(201,162,39,0.06)" },

  catTag: { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid", borderRadius: 20, padding: "3px 9px", fontSize: 11.5, fontWeight: 500 },
  catDot: { width: 6, height: 6, borderRadius: "50%" },

  bestBadge: { display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 8, fontSize: 10.5, color: "#7FD1A8", background: "rgba(127,209,168,0.12)", padding: "2px 7px", borderRadius: 20 },
  pickBadge: { display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 8, fontSize: 10.5, color: "#C9A227", background: "rgba(201,162,39,0.14)", padding: "2px 7px", borderRadius: 20 },

  chooseBtn: { border: "1px solid #2A3340", background: "transparent", borderRadius: 6, padding: "5px 10px", fontSize: 11.5, color: "#B7C0CC", cursor: "pointer", fontWeight: 600 },
  chooseBtnActive: { background: "#C9A227", borderColor: "#C9A227", color: "#141A22" },

  iconBtn: { background: "transparent", border: "1px solid #2A3340", borderRadius: 6, padding: 6, color: "#8D98A8", cursor: "pointer", display: "inline-flex" },

  uploadBox: { display: "flex", alignItems: "center", gap: 8, background: "#141A22", border: "1px dashed #3A4657", borderRadius: 8, padding: "9px 10px", fontSize: 12.5, color: "#8D98A8", cursor: "pointer" },

  statusPill: { border: "none", borderRadius: 20, padding: "4px 11px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" },
  statusPaid: { background: "rgba(127,209,168,0.15)", color: "#7FD1A8" },
  statusUnpaid: { background: "rgba(227,139,150,0.15)", color: "#E38B96" },

  emptyState: { padding: "26px 10px", textAlign: "center", color: "#5E6879", fontSize: 13 },

  toast: { position: "fixed", bottom: 22, right: 22, background: "#1B2430", border: "1px solid", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" },

  modalOverlay: { position: "fixed", inset: 0, background: "rgba(10,13,18,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 },
  modalBox: { background: "#1B2430", border: "1px solid #2A3340", borderRadius: 12, padding: 18, maxWidth: 480, width: "100%", maxHeight: "80vh", overflow: "auto" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, fontSize: 13, color: "#8D98A8" },

  fontGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  fontCard: { position: "relative", textAlign: "left", background: "#141A22", border: "1px solid #2A3340", borderRadius: 10, padding: "14px 16px", cursor: "pointer" },
  fontCardActive: { borderColor: "#C9A227", background: "rgba(201,162,39,0.06)" },
  fontCheck: { position: "absolute", top: 12, right: 12, color: "#C9A227" },
};
