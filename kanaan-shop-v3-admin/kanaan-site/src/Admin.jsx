import React, { useEffect, useRef, useState } from "react";
import {
  Plus, Trash2, Pencil, X, Check, Upload, LogOut, ArrowLeft, Star, Loader2, ImageOff,
} from "lucide-react";

/* Fixed sets (kept in sync with the storefront). */
const CATEGORIES = [
  { id: "tshirts", label: "T-Shirts" },
  { id: "jeans", label: "Jeans" },
  { id: "pants", label: "Pants" },
  { id: "sets", label: "Sets" },
  { id: "shorts", label: "Shorts" },
  { id: "shoes", label: "Shoes" },
];

const COLORS = {
  black: "#141414", charcoal: "#36393F", gray: "#9AA0A6", white: "#F1EFE9", cream: "#EFE7D3",
  beige: "#E3D6BE", sand: "#D8CBB3", khaki: "#B8A98A", brown: "#6B4A2B", coral: "#FF4522",
  red: "#C6362F", maroon: "#7A2E2E", burgundy: "#5C1F2E", pink: "#E58AA6", orange: "#E8863B",
  mustard: "#C9A227", yellow: "#E9C63B", olive: "#556B2F", green: "#3F8F5B", teal: "#12B3A0",
  sky: "#7FB2F0", blue: "#2F6FE0", navy: "#1F2A44", indigo: "#2A3A66", purple: "#6E5BFF",
};

const SIZE_PRESETS = {
  clothing: ["S", "M", "L", "XL", "XXL"],
  shoes: ["40", "41", "42", "43", "44", "45"],
};

const money = (n) => `$${Number(n || 0).toFixed(0)}`;

const emptyProduct = () => ({
  name: "", category: "tshirts", price: "", colors: [], sizes: ["S", "M", "L", "XL"],
  description: "", badge: "", discount: 0, images: [], soldOut: false, active: true,
});

function AdminStyles() {
  return (
    <style>{`
      .a-field { width:100%; border:1px solid var(--border); background:var(--field-bg); color:var(--fg);
        border-radius:12px; padding:0.6rem 0.85rem; font-family:'Inter',sans-serif; font-size:0.9rem; }
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
  const [products, setProducts] = useState([]);
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

  useEffect(() => { load(); }, []); // eslint-disable-line

  const logout = async () => {
    try { await fetch("/api/admin/session", { method: "POST" }); } catch { /* ignore */ }
    onLogout();
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      const r = await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
      if (r.ok) setProducts((prev) => prev.filter((x) => x.id !== p.id));
    } catch { /* ignore */ }
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
      <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button onClick={onExit} className="p-1.5 tap-scale hover:text-coral" aria-label="Back to shop"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="font-display font-bold text-lg">Products</h1>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 font-body text-sm text-muted hover:text-coral tap-scale">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>

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
        <div className="space-y-3">
          {products.map((p) => (
            <div key={p.id} className="glass rounded-2xl p-3 flex items-center gap-3">
              <Thumb src={p.image} />
              <div className="flex-1 min-w-0">
                <p className="font-body font-medium text-sm truncate">{p.name}</p>
                <p className="font-body text-xs text-muted">
                  {CATEGORIES.find((c) => c.id === p.category)?.label} · {money(p.price)}
                  {p.discount > 0 ? ` · −${p.discount}%` : ""}
                </p>
                <div className="flex gap-1.5 mt-1">
                  {p.soldOut && <span className="a-chip" style={{ fontSize: "0.68rem", padding: "1px 8px" }}>Sold out</span>}
                  {!p.active && <span className="a-chip" style={{ fontSize: "0.68rem", padding: "1px 8px" }}>Hidden</span>}
                  {p.badge && <span className="a-chip" style={{ fontSize: "0.68rem", padding: "1px 8px", color: p.badge === "sale" ? "var(--coral)" : "var(--teal)" }}>{p.badge}</span>}
                </div>
              </div>
              <button onClick={() => setEditing(p)} className="glass rounded-full p-2 tap-scale" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(p)} className="glass rounded-full p-2 tap-scale" aria-label="Delete"><Trash2 className="w-4 h-4" style={{ color: "var(--coral)" }} /></button>
            </div>
          ))}
        </div>
      )}
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
function ProductForm({ initial, isNew, onCancel, onSaved }) {
  const [f, setF] = useState({ ...emptyProduct(), ...initial, description: initial.description ?? initial.desc ?? "" });
  // Photos that were already saved on this product when the form opened.
  const originalImages = useRef(Array.isArray(initial.images) ? [...initial.images] : []);
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
        if (r.ok && d.url) setF((p) => ({ ...p, images: [...p.images, d.url] }));
        else setError(d.error || "Upload failed.");
      } catch { setError("Upload failed."); }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (url) => {
    setF((p) => ({ ...p, images: p.images.filter((u) => u !== url) }));
    // If this photo was uploaded just now (not part of the saved product yet),
    // it's safe to delete it from storage immediately.
    if (!originalImages.current.includes(url)) deleteFromStorage(url);
  };
  const makeMain = (url) => setF((p) => ({ ...p, images: [url, ...p.images.filter((u) => u !== url)] }));

  // Leaving without saving: anything uploaded in this session was never
  // attached to a product, so remove it from storage.
  const handleCancel = async () => {
    const unsaved = f.images.filter((u) => !originalImages.current.includes(u));
    unsaved.forEach((u) => deleteFromStorage(u));
    onCancel();
  };

  const save = async () => {
    if (!f.name.trim()) { setError("Please enter a product name."); return; }
    setSaving(true);
    setError("");
    const payload = {
      name: f.name, category: f.category, price: f.price, colors: f.colors, sizes: f.sizes,
      description: f.description, badge: f.badge, discount: f.discount, images: f.images,
      soldOut: !!f.soldOut, active: f.active !== false,
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
        const removed = originalImages.current.filter((u) => !f.images.includes(u));
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
            <select className="a-field" value={f.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Group>
          <Group label="Price ($)">
            <input className="a-field" type="number" inputMode="numeric" value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="0" />
          </Group>
        </div>

        {/* Images */}
        <Group label="Photos (first one is the main image)">
          <div className="flex flex-wrap gap-2 mb-2">
            {f.images.map((url, i) => (
              <div key={url} className="relative rounded-xl overflow-hidden" style={{ width: 76, height: 95, border: i === 0 ? "2px solid var(--coral)" : "1px solid var(--border)" }}>
                <img src={url} alt="" className="w-full h-full" style={{ objectFit: "cover" }} />
                <button onClick={() => removeImage(url)} className="absolute top-1 right-1 rounded-full p-0.5" style={{ background: "rgba(0,0,0,0.6)" }} aria-label="Remove">
                  <X className="w-3.5 h-3.5" style={{ color: "#fff" }} />
                </button>
                {i !== 0 && (
                  <button onClick={() => makeMain(url)} className="absolute bottom-1 left-1 rounded-full p-0.5" style={{ background: "rgba(0,0,0,0.6)" }} aria-label="Make main">
                    <Star className="w-3.5 h-3.5" style={{ color: "#fff" }} />
                  </button>
                )}
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
          <div className="flex flex-wrap gap-2">
            {Object.entries(COLORS).map(([key, hex]) => {
              const on = f.colors.includes(key);
              return (
                <button key={key} onClick={() => toggleColor(key)} title={key}
                  className="rounded-full tap-scale flex items-center justify-center"
                  style={{ width: 30, height: 30, background: hex, border: on ? "2px solid var(--coral)" : "1px solid var(--border)", boxShadow: on ? "0 0 0 2px var(--bg)" : "none" }}>
                  {on && <Check className="w-3.5 h-3.5" style={{ color: hex === "#F1EFE9" || hex === "#EFE7D3" || hex === "#E9C63B" ? "#000" : "#fff" }} />}
                </button>
              );
            })}
          </div>
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
          <div className="flex gap-2">
            <button onClick={() => set("sizes", [...SIZE_PRESETS.clothing])} className="font-body text-xs text-muted hover:text-coral">Use S–XXL</button>
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
