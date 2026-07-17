import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, Pencil, X, Check, Upload, LogOut, ArrowLeft, Star, Loader2, ImageOff,
  Package, ClipboardList, Phone, MapPin, Clock, CheckCircle2, XCircle, ChevronDown, AlertTriangle,
} from "lucide-react";

import { COLORS, COLOR_KEYS, groupedColors, swatchBackground, colorLabel } from "./palette.js";

/* Fixed sets (kept in sync with the storefront). */
const CATEGORIES = [
  { id: "tshirts", label: "T-Shirts" },
  { id: "shirts", label: "Shirts" },
  { id: "jeans", label: "Jeans" },
  { id: "pants", label: "Pants" },
  { id: "shorts", label: "Shorts" },
  { id: "sets", label: "Sets" },
  { id: "underwear", label: "Underwear" },
  { id: "shoes", label: "Shoes" },
  { id: "slippers", label: "Slippers" },
  { id: "accessories", label: "Accessories" },
  { id: "oldmoney", label: "Old Money Collection" },
];

/* Fits — only these categories have them. */
const SUBCATEGORIES = {
  tshirts: [
    { id: "oversized", label: "Oversized" },
    { id: "regular", label: "Regular fit" },
  ],
  jeans: [
    { id: "baggy", label: "Baggy" },
    { id: "regular", label: "Regular" },
  ],
};
const subsFor = (cat) => SUBCATEGORIES[cat] || [];

const SIZE_PRESETS = {
  clothing: ["S", "M", "L", "XL", "XXL"],
  shoes: ["40", "41", "42", "43", "44", "45"],
  // Waist sizes for jeans & pants (29–42, even steps above 33).
  pants: ["29", "30", "31", "32", "33", "34", "36", "38", "40", "42"],
};

const money = (n) => `$${Number(n || 0).toFixed(0)}`;

const emptyProduct = () => ({
  name: "", category: "tshirts", subcategory: "", price: "", colors: [], sizes: ["S", "M", "L", "XL"],
  description: "", badge: "", discount: 0, images: [], soldOut: false, active: true,
  variants: {},
});

function AdminStyles() {
  return (
    <style>{`
      .a-field { width:100%; border:1px solid var(--border); background:var(--field-bg); color:var(--fg);
        border-radius:12px; padding:0.6rem 0.85rem; font-family:'Inter',sans-serif; font-size:16px; }
      .a-field:focus { outline:none; border-color:var(--coral); box-shadow:0 0 0 3px rgba(255,69,34,0.15); }
      .a-chip { display:inline-flex; align-items:center; gap:6px; border-radius:999px; padding:4px 10px;
        font-size:0.8rem; border:1px solid var(--border); background:var(--glass-bg); }
      .spin { animation:aspin 0.9s linear infinite; }
      @keyframes aspin { to { transform:rotate(360deg); } }
    `}</style>
  );
}

/* ============================================================ */
export default function Admin({ onExit }) {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/session");
        const d = await r.json();
        setAuthed(!!d.authed);
      } catch { /* ignore */ }
      setChecking(false);
    })();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 spin text-muted" />
      </div>
    );
  }
  if (!authed) return <><AdminStyles /><Login onSuccess={() => setAuthed(true)} onExit={onExit} /></>;
  return <><AdminStyles /><Dashboard onExit={onExit} onLogout={() => setAuthed(false)} /></>;
}

/* ============================================================ */
function Login({ onSuccess, onExit }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (r.ok) { onSuccess(); return; }
      const d = await r.json().catch(() => ({}));
      setError(d.error || "Login failed.");
    } catch {
      setError("Network error.");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="glass glass-sheen rounded-3xl p-8 w-full" style={{ maxWidth: 380 }}>
        <h1 className="font-display font-bold text-2xl mb-1">Kanaan Admin</h1>
        <p className="font-body text-sm text-muted mb-6">Sign in to manage your products.</p>
        <input
          type="password"
          className="a-field mb-3"
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="font-body text-sm text-coral mb-3">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="glass-btn w-full rounded-full font-body font-medium py-3 tap-scale flex items-center justify-center gap-2"
          style={{ background: "var(--coral)", color: "#fff" }}
        >
          {busy ? <Loader2 className="w-4 h-4 spin" /> : "Sign in"}
        </button>
        <button type="button" onClick={onExit} className="w-full text-center font-body text-sm text-muted mt-4 hover:text-coral">
          ← Back to shop
        </button>
      </form>
    </div>
  );
}

/* ============================================================ */
function Dashboard({ onExit, onLogout }) {
  const [tab, setTab] = useState("products");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // product object or null
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/products");
      if (r.status === 401) { onLogout(); return; }
      const d = await r.json();
      setProducts(Array.isArray(d.products) ? d.products : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/orders");
      if (r.status === 401) { onLogout(); return; }
      const d = await r.json();
      setOrders(Array.isArray(d.orders) ? d.orders : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    if (tab === "products") load();
    else loadOrders();
  }, [tab]); // eslint-disable-line

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  const logout = async () => {
    try { await fetch("/api/admin/session", { method: "POST" }); } catch { /* ignore */ }
    onLogout();
  };

  // Deleting is permanent and takes the photos with it, so it goes through
  // a proper dialog rather than the browser's confirm box (which some phone
  // browsers suppress entirely — the reason a tap could delete by accident).
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const confirmRemove = async () => {
    const p = pendingDelete;
    if (!p) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
      if (r.ok) setProducts((prev) => prev.filter((x) => x.id !== p.id));
      else window.alert("Could not delete that product. Please try again.");
    } catch { window.alert("Network error. Please try again."); }
    setDeleting(false);
    setPendingDelete(null);
  };

  if (editing || creating) {
    return (
      <ProductForm
        initial={editing || emptyProduct()}
        isNew={creating}
        onCancel={() => { setEditing(null); setCreating(false); }}
        onSaved={() => { setEditing(null); setCreating(false); load(); }}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={onExit} className="p-1.5 tap-scale hover:text-coral" aria-label="Back to shop"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="font-display font-bold text-lg">Kanaan Admin</h1>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 font-body text-sm text-muted hover:text-coral tap-scale">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>

      {/* Tabs */}
      <div className="glass rounded-full p-1 flex gap-1 mb-6">
        <button
          onClick={() => setTab("products")}
          className="flex-1 rounded-full py-2 font-body text-sm tap-scale flex items-center justify-center gap-2"
          style={tab === "products" ? { background: "var(--fg)", color: "var(--bg)" } : { color: "var(--fg-muted)" }}
        >
          <Package className="w-4 h-4" /> Products
        </button>
        <button
          onClick={() => setTab("orders")}
          className="flex-1 rounded-full py-2 font-body text-sm tap-scale flex items-center justify-center gap-2"
          style={tab === "orders" ? { background: "var(--fg)", color: "var(--bg)" } : { color: "var(--fg-muted)" }}
        >
          <ClipboardList className="w-4 h-4" /> Orders
          {pendingCount > 0 && (
            <span className="rounded-full font-num" style={{ background: "var(--coral)", color: "#fff", fontSize: "0.68rem", padding: "0 6px", lineHeight: "16px" }}>
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {tab === "orders" ? (
        <OrdersTab orders={orders} loading={loading} reload={loadOrders} />
      ) : (
        <>
          <button
            onClick={() => setCreating(true)}
            className="glass-btn w-full rounded-full font-body font-medium py-3 mb-6 tap-scale flex items-center justify-center gap-2"
            style={{ background: "var(--coral)", color: "#fff" }}
          >
            <Plus className="w-5 h-5" /> Add new product
          </button>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 spin text-muted" /></div>
          ) : products.length === 0 ? (
            <p className="font-body text-muted text-center py-16">No products yet. Add your first one above.</p>
          ) : (
            <ProductsBrowser products={products} onEdit={setEditing} onDelete={setPendingDelete} />
          )}
        </>
      )}

      <DevSignature />

      <ConfirmDialog
        open={!!pendingDelete}
        busy={deleting}
        title="Delete this product?"
        body={pendingDelete
          ? `“${pendingDelete.name}” and its photos will be removed for good. This can't be undone.`
          : ""}
        confirmLabel="Yes, delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

/* ============================================================
   CONFIRM DIALOG
   Used for anything destructive. Deliberately makes Cancel the
   easy, obvious choice.
   ============================================================ */
function ConfirmDialog({ open, busy, title, body, confirmLabel, onCancel, onConfirm }) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === "Escape" && !busy) onCancel(); };
    document.addEventListener("keydown", onEsc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prev;
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(8,8,12,0.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
        onClick={() => !busy && onCancel()}
      />
      <div className="glass glass-sheen rounded-3xl p-6 relative w-full" style={{ maxWidth: 380, boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>
        <div className="flex items-start gap-3 mb-4">
          <span className="rounded-full p-2 flex-shrink-0" style={{ background: "rgba(255,69,34,0.15)" }}>
            <AlertTriangle className="w-5 h-5" style={{ color: "var(--coral)" }} />
          </span>
          <div>
            <p className="font-display font-bold text-base mb-1">{title}</p>
            <p className="font-body text-sm text-muted leading-6">{body}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-full font-body font-medium py-3 tap-scale"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--border)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-full font-body font-medium py-3 tap-scale flex items-center justify-center gap-2"
            style={{ background: "var(--coral)", color: "#fff" }}
          >
            {busy ? <Loader2 className="w-4 h-4 spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PRODUCTS BROWSER
   ------------------------------------------------------------
   The flat list stopped scaling once the catalogue grew: finding one
   product to edit meant scrolling past everything. Now there's an
   instant search box on top, and below it the products live in
   collapsible category folders (with a count on each). Searching
   flattens the folders into one ranked result list.
   ============================================================ */
function ProductCardRow({ p, onEdit, onDelete }) {
  const totalStock = Object.values(p.variants || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  const tracked = Object.keys(p.variants || {}).length > 0;
  return (
    <div className="glass rounded-2xl p-3 flex items-center gap-3">
      <Thumb src={p.image} />
      <div className="flex-1 min-w-0">
        <p className="font-body font-medium text-sm truncate">{p.name}</p>
        <p className="font-body text-xs text-muted">
          {CATEGORIES.find((c) => c.id === p.category)?.label}
          {p.subcategory ? ` / ${p.subcategory}` : ""} · {money(p.price)}
          {p.discount > 0 ? ` · −${p.discount}%` : ""}
          {tracked ? ` · ${totalStock} in stock` : ""}
        </p>
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {p.soldOut && <span className="a-chip" style={{ fontSize: "0.68rem", padding: "1px 8px" }}>Sold out</span>}
          {!p.active && <span className="a-chip" style={{ fontSize: "0.68rem", padding: "1px 8px" }}>Hidden</span>}
          {p.badge && <span className="a-chip" style={{ fontSize: "0.68rem", padding: "1px 8px", color: p.badge === "sale" ? "var(--coral)" : "var(--teal)" }}>{p.badge}</span>}
          {tracked && totalStock === 0 && <span className="a-chip" style={{ fontSize: "0.68rem", padding: "1px 8px", color: "var(--coral)" }}>No stock</span>}
        </div>
      </div>
      <button onClick={() => onEdit(p)} className="glass rounded-full p-2 tap-scale" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
      <button onClick={() => onDelete(p)} className="glass rounded-full p-2 tap-scale" aria-label="Delete"><Trash2 className="w-4 h-4" style={{ color: "var(--coral)" }} /></button>
    </div>
  );
}

function ProductsBrowser({ products, onEdit, onDelete }) {
  const [q, setQ] = useState("");
  // First folder starts open so the page never looks empty.
  const [open, setOpen] = useState(() => {
    const first = CATEGORIES.find((c) => products.some((p) => p.category === c.id));
    return first ? { [first.id]: true } : {};
  });

  const query = q.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!query) return [];
    const score = (p) => {
      const n = p.name.toLowerCase();
      if (n === query) return 100;
      if (n.startsWith(query)) return 80;
      if (n.includes(query)) return 60;
      const cat = (CATEGORIES.find((c) => c.id === p.category)?.label || "").toLowerCase();
      if (cat.includes(query)) return 40;
      if (p.colors?.some((k) => colorLabel(k).toLowerCase().includes(query))) return 30;
      return 0;
    };
    return products
      .map((p) => ({ p, s: score(p) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p);
  }, [query, products]);

  // Folders: keep the site's category order, skip empty ones.
  const folders = useMemo(
    () =>
      CATEGORIES.map((c) => ({ ...c, items: products.filter((p) => p.category === c.id) }))
        .filter((c) => c.items.length > 0),
    [products]
  );

  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div>
      {/* Search */}
      <div className="glass rounded-2xl flex items-center gap-2.5 px-3.5 mb-4" style={{ height: 46 }}>
        <SearchIconGlyph />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your products…"
          className="flex-1 bg-transparent border-0 outline-none font-body"
          style={{ fontSize: 16, color: "var(--fg)" }}
        />
        {q && (
          <button onClick={() => setQ("")} className="p-1 tap-scale text-muted hover:text-coral" aria-label="Clear search">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {query ? (
        matches.length === 0 ? (
          <p className="font-body text-sm text-muted text-center py-10">Nothing matched “{q}”.</p>
        ) : (
          <div className="space-y-3">
            <p className="font-body text-xs text-muted">{matches.length} {matches.length === 1 ? "result" : "results"}</p>
            {matches.map((p) => (
              <ProductCardRow key={p.id} p={p} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {folders.map((c) => {
            const isOpen = !!open[c.id];
            const outCount = c.items.filter((p) => {
              const tracked = Object.keys(p.variants || {}).length > 0;
              const total = Object.values(p.variants || {}).reduce((a, b) => a + (Number(b) || 0), 0);
              return p.soldOut || (tracked && total === 0);
            }).length;
            return (
              <div key={c.id} className="glass rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggle(c.id)}
                  className="w-full flex items-center gap-3 px-4 tap-scale"
                  style={{ height: 52 }}
                  aria-expanded={isOpen}
                >
                  <Package className="w-4 h-4 text-muted flex-shrink-0" />
                  <span className="font-body font-medium text-sm flex-1 text-left">{c.label}</span>
                  {outCount > 0 && (
                    <span className="a-chip" style={{ fontSize: "0.65rem", padding: "1px 7px", color: "var(--coral)" }}>{outCount} out</span>
                  )}
                  <span className="font-num text-xs rounded-full px-2" style={{ background: "var(--field-bg)", border: "1px solid var(--border)", lineHeight: "20px" }}>
                    {c.items.length}
                  </span>
                  <ChevronDown
                    className="w-4 h-4 text-muted flex-shrink-0"
                    style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.25s" }}
                  />
                </button>
                {isOpen && (
                  <div className="px-2.5 pb-2.5 space-y-2.5" style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                    {c.items.map((p) => (
                      <ProductCardRow key={p.id} p={p} onEdit={onEdit} onDelete={onDelete} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Small inline search glyph (keeps the lucide import list tidy).
function SearchIconGlyph() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--fg-muted)" }} xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/* ============================================================
   DEVELOPER SIGNATURE
   Shown only inside the admin panel — never on the storefront.
   ============================================================ */
// Lucide dropped brand marks, so the Facebook "f" is drawn here.
function FacebookIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z" />
    </svg>
  );
}

function DevSignature() {
  return (
    <div className="glass rounded-2xl px-4 py-4 mt-10 text-center">
      <p className="font-body text-xs text-muted mb-1">برمجة وتصميم</p>
      <p className="font-display font-bold text-sm mb-3">يوسف الزريعي</p>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <a
          href="https://wa.me/96171210775"
          target="_blank"
          rel="noopener noreferrer"
          className="a-chip tap-scale hover:text-coral"
          dir="ltr"
        >
          <Phone className="w-3.5 h-3.5" /> +961 71 210 775
        </a>
        <a
          href="https://www.facebook.com/yusufzura3i"
          target="_blank"
          rel="noopener noreferrer"
          className="a-chip tap-scale hover:text-coral"
        >
          <FacebookIcon className="w-3.5 h-3.5" /> Facebook
        </a>
      </div>
    </div>
  );
}

/* ============================================================
   ORDERS TAB
   ============================================================ */
const STATUS_STYLE = {
  pending: { label: "Pending", color: "var(--coral)" },
  confirmed: { label: "Confirmed", color: "var(--teal)" },
  cancelled: { label: "Cancelled", color: "var(--fg-muted)" },
  expired: { label: "Expired", color: "var(--fg-muted)" },
};

function timeAgo(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function OrdersTab({ orders, loading, reload }) {
  const [filter, setFilter] = useState("pending");
  const [busy, setBusy] = useState(null);
  const [pendingCancel, setPendingCancel] = useState(null);

  const act = async (order, action) => {
    setBusy(order.id);
    try {
      const r = await fetch(`/api/admin/orders/${order.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (r.ok) await reload();
      else {
        const d = await r.json().catch(() => ({}));
        window.alert(d.error || "Action failed.");
      }
    } catch { window.alert("Network error."); }
    setBusy(null);
    setPendingCancel(null);
  };

  const shown = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {[["pending", "Pending"], ["confirmed", "Confirmed"], ["all", "All"]].map(([val, lbl]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className="font-body text-sm px-4 py-1.5 rounded-full tap-scale"
            style={filter === val ? { background: "var(--fg)", color: "var(--bg)" } : { background: "var(--glass-bg)", border: "1px solid var(--border)", color: "var(--fg-muted)" }}
          >
            {lbl}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 spin text-muted" /></div>
      ) : shown.length === 0 ? (
        <p className="font-body text-muted text-center py-16">
          {filter === "pending" ? "No orders waiting for you." : "No orders here yet."}
        </p>
      ) : (
        <div className="space-y-3">
          {shown.map((o) => {
            const st = STATUS_STYLE[o.status] || STATUS_STYLE.cancelled;
            return (
              <div key={o.id} className="glass rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-num text-lg">#{o.id}</p>
                    <p className="font-body text-xs text-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {timeAgo(o.createdAt)}
                    </p>
                  </div>
                  <span className="a-chip" style={{ color: st.color }}>{st.label}</span>
                </div>

                <div className="font-body text-sm mb-3 space-y-0.5">
                  <p className="font-medium">{o.name}</p>
                  <a href={`https://wa.me/${String(o.phone).replace(/[^0-9]/g, "").replace(/^0/, "961")}`} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-coral flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> {o.phone}
                  </a>
                  <p className="text-muted flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> <span>{o.area} — {o.address}</span>
                  </p>
                  {o.notes && <p className="text-muted italic">“{o.notes}”</p>}
                </div>

                <div className="rounded-xl p-3 mb-3" style={{ background: "var(--field-bg)" }}>
                  {o.items.map((it, i) => (
                    <div key={i} className="flex justify-between font-body text-xs mb-1">
                      <span className="text-muted">{it.name} — {it.color} / {it.size} × {it.qty}</span>
                      <span className="font-num">{money(it.price * it.qty)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-body text-sm pt-2 mt-1 border-t" style={{ borderColor: "var(--border)" }}>
                    <span>Total <span className="text-muted text-xs">(incl. ${o.delivery} delivery)</span></span>
                    <span className="font-num">{money(o.total)}</span>
                  </div>
                </div>

                {o.status === "pending" ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => act(o, "confirm")}
                      disabled={busy === o.id}
                      className="glass-btn flex-1 rounded-full font-body font-medium py-2.5 tap-scale flex items-center justify-center gap-2"
                      style={{ background: "var(--teal)", color: "#062420" }}
                    >
                      {busy === o.id ? <Loader2 className="w-4 h-4 spin" /> : <><CheckCircle2 className="w-4 h-4" /> Confirm</>}
                    </button>
                    <button
                      onClick={() => setPendingCancel(o)}
                      disabled={busy === o.id}
                      className="flex-1 rounded-full font-body py-2.5 tap-scale flex items-center justify-center gap-2"
                      style={{ border: "1px solid var(--border)", color: "var(--coral)" }}
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                ) : o.status === "confirmed" ? (
                  <button
                    onClick={() => setPendingCancel(o)}
                    disabled={busy === o.id}
                    className="w-full rounded-full font-body text-sm py-2 tap-scale"
                    style={{ border: "1px solid var(--border)", color: "var(--fg-muted)" }}
                  >
                    Cancel this order (stock returns)
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      <p className="font-body text-xs text-muted text-center mt-6">
        Pending orders hold stock for 24 hours, then release it automatically.
      </p>

      <ConfirmDialog
        open={!!pendingCancel}
        busy={busy === pendingCancel?.id}
        title={pendingCancel?.status === "confirmed" ? "Cancel this order?" : "Reject this order?"}
        body={pendingCancel
          ? `Order #${pendingCancel.id} from ${pendingCancel.name}. The stock goes straight back to your shop.`
          : ""}
        confirmLabel={pendingCancel?.status === "confirmed" ? "Yes, cancel it" : "Yes, reject"}
        onCancel={() => setPendingCancel(null)}
        onConfirm={() => act(pendingCancel, "cancel")}
      />
    </div>
  );
}

function Thumb({ src }) {
  const [ok, setOk] = useState(true);
  if (src && ok) {
    return (
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0" style={{ border: "1px solid var(--glass-border)" }}>
        <img src={src} alt="" className="w-full h-full" style={{ objectFit: "cover" }} onError={() => setOk(false)} />
      </div>
    );
  }
  return (
    <div className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ border: "1px solid var(--glass-border)", background: "var(--glass-bg)" }}>
      <ImageOff className="w-5 h-5 text-muted" style={{ opacity: 0.5 }} />
    </div>
  );
}

/* ============================================================ */
function normalizeImages(list) {
  return (Array.isArray(list) ? list : [])
    .map((x) => (typeof x === "string" ? { url: x, color: null } : { url: x.url, color: x.color || null }))
    .filter((x) => x.url);
}

function ProductForm({ initial, isNew, onCancel, onSaved }) {
  const [f, setF] = useState({
    ...emptyProduct(),
    ...initial,
    description: initial.description ?? initial.desc ?? "",
    subcategory: initial.subcategory || "",
    images: normalizeImages(initial.images),
    variants: initial.variants || {},
  });
  // Photos that were already saved on this product when the form opened.
  const originalImages = useRef(normalizeImages(initial.images).map((x) => x.url));
  // Photos uploaded during this session that the user then removed — deleted
  // from storage right away so they never become orphans.
  const deleteFromStorage = async (url) => {
    try {
      await fetch("/api/admin/delete-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
    } catch { /* best effort */ }
  };
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [sizeInput, setSizeInput] = useState("");
  const fileRef = useRef(null);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  // Changing category drops a fit that doesn't exist there (a Baggy
  // T-Shirt shouldn't survive a switch from Jeans).
  const pickCategory = (cat) =>
    setF((p) => {
      const stillValid = subsFor(cat).some((sb) => sb.id === p.subcategory);
      return { ...p, category: cat, subcategory: stillValid ? p.subcategory : "" };
    });

  const toggleColor = (key) =>
    setF((p) => ({ ...p, colors: p.colors.includes(key) ? p.colors.filter((c) => c !== key) : [...p.colors, key] }));

  const addSize = (s) => {
    const v = String(s).trim();
    if (!v) return;
    setF((p) => (p.sizes.includes(v) ? p : { ...p, sizes: [...p.sizes, v] }));
  };
  const removeSize = (s) => setF((p) => ({ ...p, sizes: p.sizes.filter((x) => x !== s) }));

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const d = await r.json();
        if (r.ok && d.url) setF((p) => ({ ...p, images: [...p.images, { url: d.url, color: null }] }));
        else setError(d.error || "Upload failed.");
      } catch { setError("Upload failed."); }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (url) => {
    setF((p) => ({ ...p, images: p.images.filter((x) => x.url !== url) }));
    if (!originalImages.current.includes(url)) deleteFromStorage(url);
  };

  const makeMain = (url) =>
    setF((p) => {
      const hit = p.images.find((x) => x.url === url);
      return { ...p, images: hit ? [hit, ...p.images.filter((x) => x.url !== url)] : p.images };
    });

  // Tag a photo with the colour it shows, so the shop can switch the gallery
  // when a customer picks that colour.
  const setImageColor = (url, colorKey) =>
    setF((p) => ({ ...p, images: p.images.map((x) => (x.url === url ? { ...x, color: colorKey } : x)) }));

  // Leaving without saving: anything uploaded in this session was never
  // attached to a product, so remove it from storage.
  const handleCancel = async () => {
    const unsaved = f.images.filter((x) => !originalImages.current.includes(x.url));
    unsaved.forEach((x) => deleteFromStorage(x.url));
    onCancel();
  };

  const setVariant = (colorKey, size, value) => {
    const n = value === "" ? "" : Math.max(0, Math.round(Number(value) || 0));
    setF((p) => ({ ...p, variants: { ...p.variants, [`${colorKey}|${size}`]: n } }));
  };
  const clearStock = () => setF((p) => ({ ...p, variants: {} }));
  const trackingOn = Object.keys(f.variants || {}).some((k) => Number(f.variants[k]) > 0);

  // Most pieces exist as exactly one item per colour+size, so every combo
  // starts at 1 instead of empty — the owner only edits the exceptions.
  // Existing untracked products are left alone: filling them silently would
  // switch stock tracking on behind the owner's back. "Fill all with 1"
  // below covers those when wanted.
  const wasUntracked = useRef(!isNew && Object.keys(initial.variants || {}).length === 0);
  useEffect(() => {
    if (wasUntracked.current) return;
    setF((p) => {
      const next = { ...p.variants };
      let changed = false;
      for (const c of p.colors) {
        for (const s of p.sizes) {
          const key = `${c}|${s}`;
          if (next[key] === undefined) { next[key] = 1; changed = true; }
        }
      }
      return changed ? { ...p, variants: next } : p;
    });
  }, [f.colors, f.sizes]); // eslint-disable-line

  const fillAllWithOne = () => {
    wasUntracked.current = false;
    setF((p) => {
      const next = {};
      for (const c of p.colors) for (const s of p.sizes) next[`${c}|${s}`] = 1;
      return { ...p, variants: next };
    });
  };

  const save = async () => {
    if (!f.name.trim()) { setError("Please enter a product name."); return; }
    setSaving(true);
    setError("");
    // Only send stock rows for colour/size combos that still exist on the product.
    const validVariants = {};
    for (const c of f.colors) {
      for (const s of f.sizes) {
        const key = `${c}|${s}`;
        const v = f.variants[key];
        if (v !== "" && v != null && Number(v) > 0) validVariants[key] = Number(v);
      }
    }

    const payload = {
      name: f.name, category: f.category, subcategory: f.subcategory || "", price: f.price, colors: f.colors, sizes: f.sizes,
      description: f.description, badge: f.badge, discount: f.discount, images: f.images,
      soldOut: !!f.soldOut, active: f.active !== false, variants: validVariants,
    };
    try {
      const url = isNew ? "/api/admin/products" : `/api/admin/products/${f.id}`;
      const r = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        // Saved successfully — now clean up any previously-saved photos the
        // owner removed, so they don't linger in storage.
        const keptUrls = f.images.map((x) => x.url);
        const removed = originalImages.current.filter((u) => !keptUrls.includes(u));
        await Promise.all(removed.map((u) => deleteFromStorage(u)));
        onSaved();
        return;
      }
      const d = await r.json().catch(() => ({}));
      setError(d.error || "Save failed.");
    } catch { setError("Network error."); }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-28">
      <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between mb-6">
        <button onClick={handleCancel} className="flex items-center gap-1.5 font-body text-sm text-muted hover:text-coral tap-scale">
          <X className="w-4 h-4" /> Cancel
        </button>
        <h1 className="font-display font-bold text-lg">{isNew ? "New product" : "Edit product"}</h1>
        <span style={{ width: 60 }} />
      </div>

      <div className="space-y-5">
        <Group label="Name">
          <input className="a-field" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Harbor Slim Jeans" />
        </Group>

        <div className="grid grid-cols-2 gap-4">
          <Group label="Category">
            <select className="a-field" value={f.category} onChange={(e) => pickCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Group>
          <Group label="Price ($)">
            <input className="a-field" type="number" inputMode="numeric" value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="0" />
          </Group>
        </div>

        {/* Fit — only shown for the categories that have one. */}
        {subsFor(f.category).length > 0 && (
          <Group label="Fit">
            <div className="flex gap-2 flex-wrap">
              {[{ id: "", label: "Not specified" }, ...subsFor(f.category)].map((sb) => (
                <button
                  key={sb.id || "none"}
                  onClick={() => set("subcategory", sb.id)}
                  className="font-body text-sm px-4 py-2 rounded-full tap-scale"
                  style={(f.subcategory || "") === sb.id
                    ? { background: "var(--fg)", color: "var(--bg)" }
                    : { background: "var(--glass-bg)", border: "1px solid var(--border)" }}
                >
                  {sb.label}
                </button>
              ))}
            </div>
            <p className="font-body text-xs text-muted mt-1.5">
              Shoppers can filter by this on the {CATEGORIES.find((c) => c.id === f.category)?.label} page.
            </p>
          </Group>
        )}

        {/* Images */}
        <Group label="Photos (first one is the main image)">
          <div className="flex flex-wrap gap-3 mb-2">
            {f.images.map((img, i) => (
              <div key={img.url} style={{ width: 76 }}>
                <div className="relative rounded-xl overflow-hidden" style={{ width: 76, height: 95, border: i === 0 ? "2px solid var(--coral)" : "1px solid var(--border)" }}>
                  <img src={img.url} alt="" className="w-full h-full" style={{ objectFit: "cover" }} />
                  <button onClick={() => removeImage(img.url)} className="absolute top-1 right-1 rounded-full p-0.5" style={{ background: "rgba(0,0,0,0.6)" }} aria-label="Remove">
                    <X className="w-3.5 h-3.5" style={{ color: "#fff" }} />
                  </button>
                  {i !== 0 && (
                    <button onClick={() => makeMain(img.url)} className="absolute bottom-1 left-1 rounded-full p-0.5" style={{ background: "rgba(0,0,0,0.6)" }} aria-label="Make main">
                      <Star className="w-3.5 h-3.5" style={{ color: "#fff" }} />
                    </button>
                  )}
                  {img.color && (
                    <span className="absolute bottom-1 right-1 rounded-full" style={{ width: 14, height: 14, background: swatchBackground(img.color), border: "1.5px solid #fff" }} />
                  )}
                </div>
                {/* Which colour does this photo show? */}
                <select
                  value={img.color || ""}
                  onChange={(e) => setImageColor(img.url, e.target.value || null)}
                  className="a-field mt-1"
                  style={{ padding: "3px 4px", fontSize: "0.65rem", borderRadius: 8 }}
                  title="Which colour is in this photo?"
                >
                  <option value="">Any colour</option>
                  {f.colors.map((c) => (
                    <option key={c} value={c}>{colorLabel(c)}</option>
                  ))}
                </select>
              </div>
            ))}
            <button
              onClick={() => fileRef.current && fileRef.current.click()}
              disabled={uploading}
              className="glass rounded-xl flex flex-col items-center justify-center tap-scale"
              style={{ width: 76, height: 95 }}
            >
              {uploading ? <Loader2 className="w-5 h-5 spin" /> : <Upload className="w-5 h-5" />}
              <span className="font-body text-[10px] text-muted mt-1">{uploading ? "Uploading" : "Add"}</span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: "none" }} />
          <p className="font-body text-xs text-muted">JPG, PNG or WEBP. They’re cropped to fit automatically.</p>
        </Group>

        {/* Colors */}
        <Group label="Colors">
          <ColorSelector selected={f.colors} onToggle={toggleColor} />
        </Group>

        {/* Sizes */}
        <Group label="Sizes">
          <div className="flex flex-wrap gap-2 mb-2">
            {f.sizes.map((s) => (
              <span key={s} className="a-chip">
                {s}
                <button onClick={() => removeSize(s)} aria-label="Remove size"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 mb-2">
            <input className="a-field" value={sizeInput} onChange={(e) => setSizeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSize(sizeInput); setSizeInput(""); } }}
              placeholder="Add a size then press Enter" />
            <button onClick={() => { addSize(sizeInput); setSizeInput(""); }} className="glass rounded-xl px-4 tap-scale font-body text-sm">Add</button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => set("sizes", [...SIZE_PRESETS.clothing])} className="font-body text-xs text-muted hover:text-coral">Use S–XXL</button>
            <span className="text-muted">·</span>
            <button onClick={() => set("sizes", [...SIZE_PRESETS.pants])} className="font-body text-xs text-muted hover:text-coral">Use pants sizes 29–42</button>
            <span className="text-muted">·</span>
            <button onClick={() => set("sizes", [...SIZE_PRESETS.shoes])} className="font-body text-xs text-muted hover:text-coral">Use shoe sizes 40–45</button>
          </div>
        </Group>

        <Group label="Description">
          <textarea className="a-field" rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Short description shown on the product page" />
        </Group>

        {/* Badge */}
        <Group label="Tag">
          <div className="flex gap-2">
            {[["", "None"], ["new", "New"], ["sale", "Sale"]].map(([val, lbl]) => (
              <button key={val} onClick={() => set("badge", val)}
                className="font-body text-sm px-4 py-2 rounded-full tap-scale"
                style={f.badge === val ? { background: "var(--fg)", color: "var(--bg)" } : { background: "var(--glass-bg)", border: "1px solid var(--border)" }}>
                {lbl}
              </button>
            ))}
            {f.badge === "sale" && (
              <div className="flex items-center gap-2 ml-1">
                <input className="a-field" style={{ width: 80 }} type="number" value={f.discount} onChange={(e) => set("discount", e.target.value)} />
                <span className="font-body text-sm text-muted">% off</span>
              </div>
            )}
          </div>
        </Group>

        {/* Stock matrix */}
        <Group label="Stock (how many pieces you have)">
          {f.colors.length === 0 || f.sizes.length === 0 ? (
            <p className="font-body text-xs text-muted">
              Pick at least one colour and one size above, and the stock table will appear here.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto -mx-1 px-1">
                <table style={{ borderCollapse: "separate", borderSpacing: 4 }}>
                  <thead>
                    <tr>
                      <th />
                      {f.colors.map((c) => (
                        <th key={c} className="font-body text-xs text-muted" style={{ minWidth: 68 }}>
                          <span className="inline-flex items-center gap-1">
                            <span className="rounded-full" style={{ width: 10, height: 10, background: swatchBackground(c), border: "1px solid var(--border)", display: "inline-block" }} />
                            {colorLabel(c)}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {f.sizes.map((s) => (
                      <tr key={s}>
                        <td className="font-num text-xs text-muted pr-1" style={{ whiteSpace: "nowrap" }}>{s}</td>
                        {f.colors.map((c) => {
                          const key = `${c}|${s}`;
                          const held = (f.reserved || {})[key] || 0;
                          return (
                            <td key={key}>
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                value={f.variants[key] ?? ""}
                                onChange={(e) => setVariant(c, s, e.target.value)}
                                placeholder="0"
                                className="a-field"
                                style={{ padding: "5px 6px", textAlign: "center", fontSize: "0.8rem", borderColor: held > 0 ? "var(--coral)" : undefined }}
                                title={held > 0 ? `${held} held by a pending order` : undefined}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-2 gap-3">
                <p className="font-body text-xs text-muted">
                  {trackingOn
                    ? "Stock is tracked: sizes sell out on their own and orders reduce these numbers."
                    : "Leave all empty to keep this product always available (no stock tracking)."}
                </p>
                {trackingOn ? (
                  <button onClick={clearStock} className="font-body text-xs text-muted hover:text-coral flex-shrink-0">
                    Stop tracking
                  </button>
                ) : (
                  <button onClick={fillAllWithOne} className="font-body text-xs text-coral hover:opacity-80 flex-shrink-0">
                    Fill all with 1
                  </button>
                )}
              </div>
            </>
          )}
        </Group>

        {/* Toggles */}
        <div className="flex gap-3">
          <Toggle label="Sold out" on={!!f.soldOut} onClick={() => set("soldOut", !f.soldOut)} />
          <Toggle label="Visible in shop" on={f.active !== false} onClick={() => set("active", !(f.active !== false))} />
        </div>

        {error && <p className="font-body text-sm text-coral">{error}</p>}
      </div>

      {/* Save dock */}
      <div className="fixed bottom-4 left-1/2 z-30" style={{ transform: "translateX(-50%)", width: "calc(100% - 24px)", maxWidth: 640 }}>
        <div className="glass rounded-2xl p-2 flex gap-2">
          <button onClick={handleCancel} className="flex-1 rounded-full font-body py-3 tap-scale" style={{ border: "1px solid var(--border)" }}>Cancel</button>
          <button onClick={save} disabled={saving} className="glass-btn flex-1 rounded-full font-body font-medium py-3 tap-scale flex items-center justify-center gap-2" style={{ background: "var(--coral)", color: "#fff" }}>
            {saving ? <Loader2 className="w-4 h-4 spin" /> : <><Check className="w-4 h-4" /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   COLOUR SELECTOR
   ------------------------------------------------------------
   The palette is large on purpose (clothing colours are), so this
   keeps it usable: the colours you actually reach for are on top,
   there's a search box for finding a shade by name, and everything
   else is tucked into groups you can open when you need them.
   ============================================================ */
function isLightHex(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // perceived brightness
  return (r * 299 + g * 587 + b * 114) / 1000 > 165;
}

function Swatch({ colorKey, on, onToggle, size = 30 }) {
  const c = COLORS[colorKey];
  const tick = isLightHex(c?.hex) ? "#000" : "#fff";
  return (
    <button
      onClick={() => onToggle(colorKey)}
      title={colorLabel(colorKey)}
      aria-label={colorLabel(colorKey)}
      aria-pressed={on}
      className="rounded-full tap-scale flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: swatchBackground(colorKey),
        border: on ? "2px solid var(--coral)" : "1px solid var(--border)",
        boxShadow: on ? "0 0 0 2px var(--bg)" : "none",
      }}
    >
      {on && <Check className="w-3.5 h-3.5" style={{ color: tick }} />}
    </button>
  );
}

function ColorSelector({ selected, onToggle }) {
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const groups = groupedColors();
  const query = q.trim().toLowerCase();

  const matches = query
    ? COLOR_KEYS.filter((k) => colorLabel(k).toLowerCase().includes(query) || k.includes(query))
    : [];

  const basics = groups.find((g) => g.id === "basic")?.keys || [];
  const rest = groups.filter((g) => g.id !== "basic");

  return (
    <div>
      {/* Chosen colours, so you always see what's on the product */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {selected.map((k) => (
            <span key={k} className="a-chip" style={{ paddingLeft: 4 }}>
              <span className="rounded-full flex-shrink-0" style={{ width: 14, height: 14, background: swatchBackground(k), border: "1px solid var(--border)", display: "inline-block" }} />
              {colorLabel(k)}
              <button onClick={() => onToggle(k)} aria-label={`Remove ${colorLabel(k)}`}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a colour… (e.g. olive, burgundy, mint)"
        className="a-field mb-3"
      />

      {query ? (
        matches.length === 0 ? (
          <p className="font-body text-xs text-muted py-2">
            No colour named “{q}”. Try a close one — or pick “Multicolour / Printed” for patterns.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {matches.map((k) => (
              <Swatch key={k} colorKey={k} on={selected.includes(k)} onToggle={onToggle} />
            ))}
          </div>
        )
      ) : (
        <>
          <p className="font-body text-xs text-muted mb-1.5">Most used</p>
          <div className="flex flex-wrap gap-2">
            {basics.map((k) => (
              <Swatch key={k} colorKey={k} on={selected.includes(k)} onToggle={onToggle} />
            ))}
          </div>

          <button
            onClick={() => setShowAll((v) => !v)}
            className="font-body text-xs text-muted hover:text-coral mt-3 flex items-center gap-1"
          >
            {showAll ? "Hide" : `All colours (${COLOR_KEYS.length})`}
            <ChevronDown className="w-3.5 h-3.5" style={{ transform: showAll ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>

          {showAll && (
            <div className="mt-3 space-y-3">
              {rest.map((g) => (
                <div key={g.id}>
                  <p className="font-body text-xs text-muted mb-1.5">{g.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {g.keys.map((k) => (
                      <Swatch key={k} colorKey={k} on={selected.includes(k)} onToggle={onToggle} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Group({ label, children }) {
  return (
    <div>
      <label className="font-body text-sm font-medium block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, on, onClick }) {
  return (
    <button onClick={onClick} className="glass rounded-2xl px-4 py-3 flex items-center gap-3 flex-1 tap-scale">
      <span className="relative rounded-full" style={{ width: 40, height: 24, background: on ? "var(--coral)" : "var(--glass-bg)", border: "1px solid var(--border)", transition: "background 0.2s" }}>
        <span className="absolute rounded-full" style={{ width: 18, height: 18, top: 2, left: on ? 19 : 3, background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
      </span>
      <span className="font-body text-sm">{label}</span>
    </button>
  );
}
