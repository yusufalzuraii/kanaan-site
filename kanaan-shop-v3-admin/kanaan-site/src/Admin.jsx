import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, Pencil, X, Check, Upload, LogOut, ArrowLeft, Star, Loader2, ImageOff,
  Package, ClipboardList, Phone, MapPin, Clock, CheckCircle2, XCircle, ChevronDown, AlertTriangle,
  Sparkles, Image as ImageIcon, GripVertical, Pin, Layers, Bell, Send, LayoutGrid,
} from "lucide-react";

import { COLORS, COLOR_KEYS, groupedColors, swatchBackground, colorLabel } from "./palette.js";
import { optimizeImage, formatBytes } from "./imageOptimizer.js";

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
  isSpotlight: false, appExclusive: false,
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
  const [tab, setTab] = useState("home");
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

  /* The dashboard summarises products AND orders together, so both are
     loaded up front rather than one per tab. It's two requests on open
     instead of one, and every tab after that is instant. */
  useEffect(() => {
    load();
    loadOrders();
  }, []); // eslint-disable-line

  // Coming back to a tab should show current data, not a stale snapshot.
  useEffect(() => {
    if (tab === "orders") loadOrders();
    else if (tab === "products" || tab === "stories") load();
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

      {/* Navigation
          ------------------------------------------------------------
          This was five equal tabs in one row, which on a phone meant five
          cramped, half-readable labels. They aren't equally important:
          orders and products are checked daily, the rest occasionally.
          So the bar now carries the three daily ones, and everything else
          lives as cards on the dashboard where there's room to explain
          what each actually does. */}
      <div className="glass rounded-full p-1 flex gap-1 mb-6">
        {[
          { id: "home", label: "Home", Icon: LayoutGrid },
          { id: "products", label: "Products", Icon: Package },
          { id: "orders", label: "Orders", Icon: ClipboardList, badge: pendingCount },
        ].map(({ id, label, Icon, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex-1 rounded-full py-2 font-body text-sm tap-scale flex items-center justify-center gap-1.5"
            style={tab === id ? { background: "var(--fg)", color: "var(--bg)" } : { color: "var(--fg-muted)" }}
          >
            <Icon className="w-4 h-4" /> {label}
            {badge > 0 && (
              <span className="rounded-full font-num" style={{ background: "var(--coral)", color: "#fff", fontSize: "0.68rem", padding: "0 6px", lineHeight: "16px" }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Secondary sections keep a slim back-link so you're never stranded. */}
      {["stories", "notify", "errors"].includes(tab) && (
        <button onClick={() => setTab("home")} className="flex items-center gap-1.5 font-body text-sm text-muted hover:text-coral tap-scale mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </button>
      )}

      {tab === "home" ? (
        <HomeTab
          products={products}
          orders={orders}
          loading={loading}
          go={setTab}
          onAddProduct={() => setCreating(true)}
        />
      ) : tab === "notify" ? (
        <NotifyTab onLogout={onLogout} />
      ) : tab === "errors" ? (
        <ErrorsTab />
      ) : tab === "stories" ? (
        <StoriesTab products={products} onLogout={onLogout} />
      ) : tab === "orders" ? (
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
/* ============================================================
   NOTIFY TAB — إرسال إشعار push لكل مستخدمي التطبيق دفعة وحدة.
   ============================================================ */
function NotifyTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { ok, sent, failed, removed, total } | { error }

  const [appVersion, setAppVersion] = useState(null);
  const [versionInput, setVersionInput] = useState("");
  const [versionMsg, setVersionMsg] = useState(null);
  const [versionSaving, setVersionSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/app-version");
        const d = await r.json();
        const v = d.latest ?? 1;
        setAppVersion(v);
        setVersionInput(String(v));
      } catch { setAppVersion(1); setVersionInput("1"); }
    })();
  }, []);

  /* حفظ رقم النسخة المنشورة فعلياً على Google Play.

     ليش صار حقل إدخال بدل زر "+1": الزر القديم كان بيزيد عدّاد أعمى
     ما إلو أي علاقة بالرقم الحقيقي المنشور. أي ضغطة تجريبية كانت
     بتخلي الرقم يسبق الواقع (مثلاً صار 4 والمنشور فعلياً 1)، والنتيجة
     إنو *كل* المستخدمين بيشوفوا بانر "في تحديث" للأبد — وهو تحديث
     مش موجود أصلاً. هلق بتكتب الرقم بالضبط زي ما هو بـ Play Console،
     فما بيقدر يبعد عن الواقع مهما ضغطت. */
  const saveVersion = async () => {
    const n = parseInt(versionInput, 10);
    if (!n || n < 1) {
      setVersionMsg({ error: "اكتب رقم صحيح (1 أو أكبر)." });
      return;
    }
    setVersionSaving(true);
    setVersionMsg(null);
    try {
      const r = await fetch("/api/admin/app-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latest: n }),
      });
      if (r.ok) {
        setAppVersion(n);
        setVersionMsg({ ok: true });
      } else {
        setVersionMsg({ error: "ما انحفظ، جرب كمان مرة." });
      }
    } catch {
      setVersionMsg({ error: "مشكلة اتصال." });
    }
    setVersionSaving(false);
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      setResult({ error: "لازم تكتب عنوان ونص للإشعار." });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const r = await fetch("/api/admin/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url: url.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) setResult({ error: d.error || "صار خطأ، جرب كمان مرة." });
      else {
        setResult(d);
        setTitle("");
        setBody("");
        setUrl("");
      }
    } catch {
      setResult({ error: "مشكلة اتصال. تأكد من الإنترنت وجرب كمان مرة." });
    }
    setSending(false);
  };

  const templates = [
    {
      label: "🔥 Sale ending soon",
      title: "Last chance ⏳",
      body: "The sale wraps up soon — grab your pieces before they're back to full price.",
      url: "/sale",
    },
    {
      label: "✨ New drop",
      title: "Just landed ✨",
      body: "New pieces are in the shop — come see what's new.",
      url: "/shop",
    },
    {
      label: "🔒 App exclusives reminder",
      title: "Prices only you can see 🔒",
      body: "A few pieces are priced lower right now — visible only here, in the app.",
      url: "/exclusives",
    },
    {
      label: "📦 Restock",
      title: "Back in stock",
      body: "A piece you've been eyeing just came back — it won't last long.",
      url: "/shop",
    },
  ];

  const applyTemplate = (t) => {
    setTitle(t.title);
    setBody(t.body);
    setUrl(t.url);
    setResult(null);
  };

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-5">
        <p className="font-body text-sm text-muted mb-4">
          بيوصل هالإشعار لكل مستخدمي تطبيق أندرويد/آيفون اللي وافقوا يستقبلوا إشعارات — مش مستخدمي الموقع بالمتصفح.
        </p>

        <p className="font-body text-xs text-muted mb-2">قوالب جاهزة — اضغط وحدة لتعبئة النص، وعدّل قبل الإرسال إذا حبيت:</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {templates.map((t) => (
            <button
              key={t.label}
              onClick={() => applyTemplate(t)}
              className="a-chip tap-scale"
              style={{ cursor: "pointer" }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="font-body text-sm font-medium block mb-1.5">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="a-field mb-4"
          placeholder="مثلاً: تخفيضات الصيف بدأت 🔥"
        />

        <label className="font-body text-sm font-medium block mb-1.5">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={300}
          rows={3}
          className="a-field mb-4 resize-none"
          placeholder="نص قصير وواضح — هيك بيظهر بالإشعار نفسو"
        />

        <label className="font-body text-sm font-medium block mb-1.5">Link (optional)</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="a-field mb-1"
          placeholder="https://kanaanshop.com/sale"
        />
        <p className="font-body text-xs text-muted mb-4">إذا حطيت رابط، بيفتح التطبيق عليه لما حد يدوس عالإشعار.</p>

        <button
          onClick={send}
          disabled={sending}
          className="glass-btn w-full rounded-full font-body font-medium py-3 tap-scale flex items-center justify-center gap-2"
          style={{ background: "var(--coral)", color: "#fff", opacity: sending ? 0.6 : 1 }}
        >
          {sending ? <Loader2 className="w-5 h-5 spin" /> : <Send className="w-5 h-5" />}
          {sending ? "عم يرسل..." : "ابعت الإشعار"}
        </button>

        {result?.error && (
          <p className="font-body text-sm text-coral mt-3 text-center">{result.error}</p>
        )}
        {result?.ok && (
          <p className="font-body text-sm text-teal mt-3 text-center">
            وصل لـ {result.sent} جهاز من أصل {result.total}
            {result.failed > 0 ? ` (فشل ${result.failed})` : ""}
            {result.removed > 0 ? ` — تنضّف ${result.removed} جهاز قديم مش مستخدم` : ""}
          </p>
        )}
      </div>

      <div className="glass rounded-2xl p-5">
        <p className="font-body text-sm font-medium mb-1">بانر "تحديث متوفر" بالتطبيق</p>
        <p className="font-body text-xs text-muted mb-1">
          اكتب هون <strong>رقم النسخة (versionCode) المنشورة فعلياً على Google Play</strong> — نفس الرقم يلي بيبين بـ Play Console تحت الإصدار، مثلاً <span className="font-num">1 (1.0)</span> ← الرقم هو <span className="font-num">1</span>.
        </p>
        <p className="font-body text-xs text-muted mb-3">
          أي مستخدم رقم نسخته <em>أقل</em> من هالرقم بيشوف بانر يقترح عليه يحدّث. ⚠️ لا تكتب رقم أكبر من المنشور فعلياً — وقتها بيشوف الكل بانر تحديث وهمي ما إلو وجود.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            min="1"
            value={versionInput}
            onChange={(e) => { setVersionInput(e.target.value); setVersionMsg(null); }}
            className="a-field"
            style={{ width: 110 }}
            placeholder="1"
          />
          <button
            onClick={saveVersion}
            disabled={versionSaving || appVersion === null}
            className="a-chip tap-scale"
            style={{ cursor: "pointer", opacity: versionSaving ? 0.6 : 1 }}
          >
            {versionSaving ? "..." : "احفظ"}
          </button>
          <span className="font-body text-xs text-muted">
            المحفوظ حالياً: <span className="font-num">{appVersion ?? "..."}</span>
          </span>
        </div>
        {versionMsg?.error && <p className="font-body text-xs text-coral mt-2">{versionMsg.error}</p>}
        {versionMsg?.ok && <p className="font-body text-xs text-teal mt-2">✓ انحفظ</p>}
      </div>
    </div>
  );
}

/* ============================================================
   ERRORS TAB — آخر 30 خطأ برمجي حقيقي صار للزباين (موقع أو
   تطبيق). شبكة أمان بسيطة حتى ما تعتمد بس على شكاوى الناس.
   ============================================================ */
function ErrorsTab() {
  const [errors, setErrors] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/errors");
        const d = await r.json();
        setErrors(Array.isArray(d.errors) ? d.errors : []);
      } catch {
        setErrors([]);
      }
    })();
  }, []);

  const timeAgo = (ts) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="glass rounded-2xl p-5">
      <p className="font-body text-sm text-muted mb-4">
        آخر 30 خطأ برمجي حقيقي صار لزباين الموقع أو التطبيق — بيتسجّل تلقائياً، بلا ما حدا يشتكي.
      </p>

      {errors === null ? (
        <p className="font-body text-sm text-muted">عم يحمّل...</p>
      ) : errors.length === 0 ? (
        <p className="font-body text-sm text-teal">✓ ولا خطأ مسجّل لهلق — تمام.</p>
      ) : (
        <div className="space-y-2">
          {errors.map((e) => (
            <div key={e.id} className="rounded-xl p-3" style={{ background: "var(--field-bg)", border: "1px solid var(--border)" }}>
              <button onClick={() => setExpandedId(expandedId === e.id ? null : e.id)} className="w-full text-left">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-body text-sm font-medium truncate">{e.message || "Unknown error"}</p>
                  <span className="a-chip flex-shrink-0" style={{ fontSize: "0.65rem" }}>{e.platform || "web"}</span>
                </div>
                <p className="font-body text-xs text-muted mt-1">{timeAgo(e.created_at)} · {e.url}</p>
              </button>
              {expandedId === e.id && (
                <pre className="font-num text-[10px] text-muted mt-2 whitespace-pre-wrap break-all" style={{ maxHeight: 200, overflow: "auto" }}>
                  {e.stack || "(no stack trace)"}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
   STORIES TAB — "The Edit"
   ------------------------------------------------------------
   Two ways in: quick "Find your fit" comparison ring (two photos,
   side by side), or a regular editorial ring (a lookbook / behind
   the scenes moment) where each photo can be tagged with the
   products it's showing — tap the photo to drop a pin, then pick
   which product that pin points to.
   ============================================================ */
const RING_TYPE_META = {
  editorial: { icon: Sparkles, label: "Editorial" },
  compare: { icon: Layers, label: "Find your fit" },
};

function StoriesTab({ products, onLogout }) {
  const [rings, setRings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null); // 'editorial' | 'compare' | null
  const [managingRing, setManagingRing] = useState(null); // ring object | null
  const [pendingDeleteRing, setPendingDeleteRing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/stories");
      if (r.status === 401) { onLogout(); return; }
      const d = await r.json();
      setRings(Array.isArray(d.rings) ? d.rings : []);
    } catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const deleteRing = async () => {
    if (!pendingDeleteRing) return;
    try {
      await fetch("/api/admin/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteRing", ringId: pendingDeleteRing.id }),
      });
    } catch { /* ignore */ }
    setPendingDeleteRing(null);
    load();
  };

  if (creating) {
    return (
      <StoryRingEditor
        products={products}
        ringType={creating}
        onCancel={() => setCreating(null)}
        onSaved={() => { setCreating(null); load(); }}
      />
    );
  }
  if (managingRing) {
    return (
      <StoryRingEditor
        products={products}
        ringType={managingRing.kind}
        existingRing={managingRing}
        onCancel={() => setManagingRing(null)}
        onSaved={() => { setManagingRing(null); load(); }}
      />
    );
  }

  return (
    <div>
      <p className="font-body text-sm text-muted mb-4 leading-6">
        "The Edit" is the story rail on your homepage. <strong style={{ color: "var(--fg)" }}>On Sale</strong> and{" "}
        <strong style={{ color: "var(--fg)" }}>New In</strong> build themselves from your products — nothing to manage.
        Add editorial moments or fit comparisons below.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setCreating("editorial")}
          className="glass-btn rounded-2xl py-4 tap-scale flex flex-col items-center gap-2"
          style={{ background: "var(--coral)", color: "#fff" }}
        >
          <Sparkles className="w-5 h-5" />
          <span className="font-body text-sm font-medium">New editorial</span>
        </button>
        <button
          onClick={() => setCreating("compare")}
          className="glass rounded-2xl py-4 tap-scale flex flex-col items-center gap-2"
        >
          <Layers className="w-5 h-5" />
          <span className="font-body text-sm font-medium">New fit comparison</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 spin text-muted" /></div>
      ) : rings.length === 0 ? (
        <p className="font-body text-muted text-center py-12">No editorial stories yet — add your first one above.</p>
      ) : (
        <div className="space-y-3">
          {rings.map((ring) => {
            const meta = RING_TYPE_META[ring.kind] || RING_TYPE_META.editorial;
            const Icon = meta.icon;
            const cover = ring.slides[0];
            return (
              <div key={ring.id} className="glass rounded-2xl p-3 flex items-center gap-3">
                <div className="rounded-xl overflow-hidden flex-shrink-0" style={{ width: 52, height: 65, background: "#1A1A1E" }}>
                  {cover?.image && <img src={cover.image} alt="" className="w-full h-full" style={{ objectFit: "cover" }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body font-medium text-sm truncate">{ring.title}</p>
                  <p className="font-body text-xs text-muted flex items-center gap-1.5">
                    <Icon className="w-3 h-3" /> {meta.label} · {ring.slides.length} {ring.slides.length === 1 ? "slide" : "slides"}
                    {ring.pinned ? (
                      <span className="inline-flex items-center gap-0.5"><Pin className="w-3 h-3" /> Pinned</span>
                    ) : ring.expiresAt ? (
                      <span style={{ color: ring.expiresAt < Date.now() ? "var(--coral)" : undefined }}>
                        {ring.expiresAt < Date.now() ? "Expired" : `Expires ${new Date(ring.expiresAt).toLocaleDateString()}`}
                      </span>
                    ) : null}
                  </p>
                </div>
                <button onClick={() => setManagingRing(ring)} className="glass rounded-full p-2 tap-scale" aria-label="Manage"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => setPendingDeleteRing(ring)} className="glass rounded-full p-2 tap-scale" aria-label="Delete"><Trash2 className="w-4 h-4" style={{ color: "var(--coral)" }} /></button>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDeleteRing}
        title="Delete this story?"
        body={pendingDeleteRing ? `“${pendingDeleteRing.title}” and all its photos will be removed for good.` : ""}
        confirmLabel="Yes, delete"
        onCancel={() => setPendingDeleteRing(null)}
        onConfirm={deleteRing}
      />
    </div>
  );
}

// Searchable product picker used when assigning a tag to a spot on a photo.
function ProductPicker({ products, onPick, onClose }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const results = query
    ? products.filter((p) => p.name.toLowerCase().includes(query)).slice(0, 30)
    : products.slice(0, 30);

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="glass rounded-t-3xl w-full p-4" style={{ maxHeight: "70%", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-body font-medium text-sm">Which product is this?</p>
          <button onClick={onClose} className="p-1 tap-scale text-muted"><X className="w-4 h-4" /></button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="a-field mb-3" autoFocus />
        <div className="space-y-2">
          {results.map((p) => (
            <button key={p.id} onClick={() => onPick(p.id)} className="w-full flex items-center gap-3 p-2 rounded-xl tap-scale text-left" style={{ background: "var(--glass-bg)" }}>
              <Thumb src={p.image} />
              <span className="flex-1 min-w-0">
                <span className="block font-body text-sm truncate">{p.name}</span>
                <span className="block font-body text-xs text-muted">{money(p.price)}</span>
              </span>
            </button>
          ))}
          {results.length === 0 && <p className="font-body text-xs text-muted text-center py-6">No products match.</p>}
        </div>
      </div>
    </div>
  );
}

// One editable photo: click to drop a tag pin, tap an existing pin to
// reassign or remove it.
function TaggableImage({ image, tags, onChangeTags, products }) {
  const imgRef = useRef(null);
  const [placing, setPlacing] = useState(null); // { x, y } while choosing a product
  const [editingIdx, setEditingIdx] = useState(null);

  const onImageClick = (e) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setPlacing({ x, y });
  };

  const assign = (productId) => {
    if (placing) {
      onChangeTags([...tags, { productId, x: placing.x, y: placing.y }]);
      setPlacing(null);
    } else if (editingIdx != null) {
      onChangeTags(tags.map((t, i) => (i === editingIdx ? { ...t, productId } : t)));
      setEditingIdx(null);
    }
  };
  const removeTag = (idx) => { onChangeTags(tags.filter((_, i) => i !== idx)); setEditingIdx(null); };

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "4/5", background: "#1A1A1E" }}>
      {image ? (
        <img ref={imgRef} src={image} alt="" className="absolute inset-0 w-full h-full cursor-crosshair" style={{ objectFit: "cover" }} onClick={onImageClick} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center"><ImageIcon className="w-8 h-8" style={{ color: "rgba(255,255,255,0.3)" }} /></div>
      )}
      {tags.map((t, i) => {
        const p = products.find((pp) => pp.id === t.productId);
        return (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setEditingIdx(i); }}
            className="absolute rounded-full flex items-center justify-center tap-scale"
            style={{ left: `${t.x}%`, top: `${t.y}%`, transform: "translate(-50%,-50%)", width: 22, height: 22, background: "#fff", border: "2px solid var(--coral)" }}
            title={p?.name || "Unknown product"}
          >
            <span style={{ width: 8, height: 8, borderRadius: 9999, background: "var(--coral)" }} />
          </button>
        );
      })}
      {image && (
        <p className="absolute bottom-2 left-2 right-2 font-body text-center" style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.65)" }}>
          Tap the photo to tag a piece
        </p>
      )}
      {placing && <ProductPicker products={products} onPick={assign} onClose={() => setPlacing(null)} />}
      {editingIdx != null && (
        <div className="absolute inset-0 z-30 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setEditingIdx(null)}>
          <div className="glass rounded-t-3xl w-full p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-body text-sm mb-3">
              Tagged: <strong>{products.find((p) => p.id === tags[editingIdx]?.productId)?.name || "—"}</strong>
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPlacing({ x: tags[editingIdx].x, y: tags[editingIdx].y }) || setEditingIdx(null)} className="flex-1 rounded-full font-body text-sm py-2.5 tap-scale" style={{ border: "1px solid var(--border)" }}>
                Change product
              </button>
              <button onClick={() => removeTag(editingIdx)} className="flex-1 rounded-full font-body text-sm py-2.5 tap-scale" style={{ background: "var(--coral)", color: "#fff" }}>
                Remove tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Create OR manage (add slides to / edit settings of) one ring.
function StoryRingEditor({ products, ringType, existingRing, onCancel, onSaved }) {
  const isCompare = ringType === "compare";
  const [ringTitle, setRingTitle] = useState(existingRing?.title || (isCompare ? "Find Your Fit" : ""));
  const [pinned, setPinned] = useState(existingRing?.pinned !== false);
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const fileBRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  // New-slide draft (used both for the ring's first slide and for
  // appending more slides to an existing ring).
  const blankSlide = () => ({ image: "", imageB: "", labelA: "Oversized", labelB: "Regular", caption: "", ctaCategory: "", ctaSubcategory: "", tags: [] });
  const [draft, setDraft] = useState(blankSlide());

  const uploadOne = async (file, which) => {
    setUploading(true);
    try {
      const opt = await optimizeImage(file); // same shrink-before-upload as products
      const fd = new FormData();
      fd.append("file", opt.full);
      if (opt.thumb) fd.append("thumb", opt.thumb);
      const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (r.ok && d.url) setDraft((p) => ({ ...p, [which]: d.url }));
    } catch { /* ignore */ }
    setUploading(false);
  };

  const addOrCreate = async () => {
    if (!draft.image) { setError("Add a photo first."); return; }
    if (isCompare && !draft.imageB) { setError("The comparison needs a second photo."); return; }
    setError(""); setSaving(true);
    try {
      if (!existingRing) {
        const r = await fetch("/api/admin/stories", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "createRing", ringTitle, ringType, pinned, expiresInHours, slide: draft }),
        });
        const d = await r.json();
        if (!r.ok) { setError(d.error || "Something went wrong."); setSaving(false); return; }
        onSaved();
      } else {
        const r = await fetch("/api/admin/stories", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "addSlide", ringId: existingRing.id, slide: draft }),
        });
        const d = await r.json();
        if (!r.ok) { setError(d.error || "Something went wrong."); setSaving(false); return; }
        setDraft(blankSlide());
        onSaved();
      }
    } catch { setError("Network error."); }
    setSaving(false);
  };

  const saveRingSettings = async () => {
    if (!existingRing) return;
    setSaving(true);
    try {
      await fetch("/api/admin/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateRing", ringId: existingRing.id, ringTitle, pinned, expiresInHours }),
      });
      onSaved();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const deleteSlide = async (slideId) => {
    setSaving(true);
    try {
      await fetch("/api/admin/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteSlide", id: slideId }),
      });
      onSaved();
    } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={onCancel} className="flex items-center gap-1.5 font-body text-sm text-muted hover:text-coral tap-scale mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to The Edit
      </button>

      <h1 className="font-display font-bold text-xl mb-1">
        {existingRing ? existingRing.title : isCompare ? "New fit comparison" : "New editorial story"}
      </h1>
      <p className="font-body text-xs text-muted mb-5">
        {isCompare
          ? "Two photos of the same piece — the shopper drags to compare the fits."
          : "A photo (or a few) with the pieces it's showing tagged directly on the image."}
      </p>

      {/* Existing slides, when managing a ring */}
      {existingRing && (
        <div className="mb-6">
          <p className="font-body text-sm font-medium mb-2">Slides ({existingRing.slides.length})</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {existingRing.slides.map((s) => (
              <div key={s.id} className="relative flex-shrink-0" style={{ width: 90 }}>
                <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "4/5", background: "#1A1A1E" }}>
                  {s.image && <img src={s.image} alt="" className="w-full h-full" style={{ objectFit: "cover" }} />}
                </div>
                <button onClick={() => deleteSlide(s.id)} className="absolute -top-1.5 -right-1.5 rounded-full p-1" style={{ background: "var(--coral)" }} aria-label="Delete slide">
                  <X className="w-3 h-3" style={{ color: "#fff" }} />
                </button>
                {s.tags.length > 0 && (
                  <span className="absolute bottom-1 left-1 a-chip" style={{ fontSize: "0.6rem", padding: "0 6px" }}>{s.tags.length} tagged</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ring settings */}
      <Group label="Story title">
        <input className="a-field" value={ringTitle} onChange={(e) => setRingTitle(e.target.value)} placeholder={isCompare ? "Find Your Fit" : "Old Money Edit"} />
      </Group>

      <Group label="How long should it stay up?">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setPinned(true)} className="font-body text-sm px-4 py-2 rounded-full tap-scale flex items-center gap-1.5" style={pinned ? { background: "var(--fg)", color: "var(--bg)" } : { background: "var(--glass-bg)", border: "1px solid var(--border)" }}>
            <Pin className="w-3.5 h-3.5" /> Pinned (until you remove it)
          </button>
          <button onClick={() => setPinned(false)} className="font-body text-sm px-4 py-2 rounded-full tap-scale" style={!pinned ? { background: "var(--fg)", color: "var(--bg)" } : { background: "var(--glass-bg)", border: "1px solid var(--border)" }}>
            Limited time
          </button>
        </div>
        {!pinned && (
          <div className="flex gap-2 mt-2">
            {[24, 48, 72].map((h) => (
              <button key={h} onClick={() => setExpiresInHours(h)} className="font-num text-xs px-3 py-1.5 rounded-full tap-scale" style={expiresInHours === h ? { background: "var(--coral)", color: "#fff" } : { background: "var(--glass-bg)", border: "1px solid var(--border)" }}>
                {h}h
              </button>
            ))}
          </div>
        )}
      </Group>

      {existingRing && (
        <button onClick={saveRingSettings} disabled={saving} className="font-body text-sm text-coral hover:underline mb-6">
          Save these settings
        </button>
      )}

      <div className="my-6" style={{ borderTop: "1px solid var(--border)" }} />

      <p className="font-body text-sm font-medium mb-3">{existingRing ? "Add another slide" : "First slide"}</p>

      {!isCompare ? (
        <>
          <Group label="Photo">
            <div className="flex items-center gap-3">
              <div style={{ width: 140 }}>
                <TaggableImage image={draft.image} tags={draft.tags} onChangeTags={(tags) => setDraft((p) => ({ ...p, tags }))} products={products} />
              </div>
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="glass rounded-full px-4 py-2.5 tap-scale font-body text-sm flex items-center gap-2">
                {uploading ? <Loader2 className="w-4 h-4 spin" /> : <Upload className="w-4 h-4" />} {draft.image ? "Replace photo" : "Upload photo"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files[0] && uploadOne(e.target.files[0], "image")} />
            </div>
          </Group>
          <Group label="Caption (optional)">
            <input className="a-field" value={draft.caption} onChange={(e) => setDraft((p) => ({ ...p, caption: e.target.value }))} placeholder="Tailored looks for the weekend" maxLength={200} />
          </Group>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Group label="Photo A">
              <div style={{ width: "100%", maxWidth: 160 }}>
                <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "4/5", background: "#1A1A1E" }}>
                  {draft.image && <img src={draft.image} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "cover" }} />}
                </div>
              </div>
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="glass rounded-full px-3 py-2 tap-scale font-body text-xs mt-2 flex items-center gap-1.5">
                {uploading ? <Loader2 className="w-3.5 h-3.5 spin" /> : <Upload className="w-3.5 h-3.5" />} {draft.image ? "Replace" : "Upload"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files[0] && uploadOne(e.target.files[0], "image")} />
              <input className="a-field mt-2" value={draft.labelA} onChange={(e) => setDraft((p) => ({ ...p, labelA: e.target.value }))} placeholder="Oversized" />
            </Group>
            <Group label="Photo B">
              <div style={{ width: "100%", maxWidth: 160 }}>
                <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "4/5", background: "#1A1A1E" }}>
                  {draft.imageB && <img src={draft.imageB} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "cover" }} />}
                </div>
              </div>
              <button onClick={() => fileBRef.current?.click()} disabled={uploading} className="glass rounded-full px-3 py-2 tap-scale font-body text-xs mt-2 flex items-center gap-1.5">
                {uploading ? <Loader2 className="w-3.5 h-3.5 spin" /> : <Upload className="w-3.5 h-3.5" />} {draft.imageB ? "Replace" : "Upload"}
              </button>
              <input ref={fileBRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files[0] && uploadOne(e.target.files[0], "imageB")} />
              <input className="a-field mt-2" value={draft.labelB} onChange={(e) => setDraft((p) => ({ ...p, labelB: e.target.value }))} placeholder="Regular" />
            </Group>
          </div>
          <Group label="Link to (optional — adds a 'Shop' button)">
            <div className="flex gap-2 flex-wrap">
              <select className="a-field" style={{ maxWidth: 160 }} value={draft.ctaCategory} onChange={(e) => setDraft((p) => ({ ...p, ctaCategory: e.target.value, ctaSubcategory: "" }))}>
                <option value="">No link</option>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              {draft.ctaCategory && subsFor(draft.ctaCategory).length > 0 && (
                <select className="a-field" style={{ maxWidth: 140 }} value={draft.ctaSubcategory} onChange={(e) => setDraft((p) => ({ ...p, ctaSubcategory: e.target.value }))}>
                  <option value="">Any fit</option>
                  {subsFor(draft.ctaCategory).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              )}
            </div>
          </Group>
        </>
      )}

      {error && <p className="font-body text-sm text-coral mb-3">{error}</p>}

      <button onClick={addOrCreate} disabled={saving || uploading} className="glass-btn w-full rounded-full font-body font-medium py-3 tap-scale flex items-center justify-center gap-2" style={{ background: "var(--coral)", color: "#fff" }}>
        {saving ? <Loader2 className="w-4 h-4 spin" /> : (existingRing ? "Add this slide" : "Publish story")}
      </button>
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
   DASHBOARD (HOME)
   ------------------------------------------------------------
   The panel grew one feature at a time, and what never got built was
   the screen that answers the only question that matters when you open
   it: what needs me right now?

   So this leads with problems, not statistics. Anything on the "needs
   attention" list is a thing a customer is waiting on, or money not
   being made — orders sitting unconfirmed, pieces that have quietly
   sold out, crashes shoppers hit this week. If none of that applies,
   the list says so plainly instead of showing an empty panel.

   Numbers come second, and the rarely-used tools come last as cards
   that say what they're for — rather than five cryptic tabs competing
   for space at the top of a phone screen.
   ============================================================ */
function HomeTab({ products, orders, loading, go, onAddProduct }) {
  const stats = useMemo(() => {
    const pending = orders.filter((o) => o.status === "pending");
    const confirmed = orders.filter((o) => o.status === "confirmed");

    // "Out of stock" means the owner marked it sold out, OR it tracks
    // stock and every colour/size is at zero. An untracked product is
    // always available, so it never counts.
    const outOfStock = products.filter((p) => {
      if (!p.active) return false;
      if (p.soldOut) return true;
      const v = p.variants || {};
      const keys = Object.keys(v);
      return keys.length > 0 && keys.every((k) => (Number(v[k]) || 0) <= 0);
    });

    // Tracked pieces down to their last one or two — the ones worth
    // restocking before they disappear.
    const lowStock = products.filter((p) => {
      if (!p.active || p.soldOut) return false;
      const v = p.variants || {};
      const keys = Object.keys(v);
      if (keys.length === 0) return false;
      const total = keys.reduce((sum, k) => sum + (Number(v[k]) || 0), 0);
      return total > 0 && total <= 2;
    });

    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return {
      pending,
      confirmedToday: confirmed.filter((o) => o.updatedAt >= dayAgo).length,
      revenueToday: confirmed.filter((o) => o.updatedAt >= dayAgo).reduce((sum, o) => sum + (Number(o.total) || 0), 0),
      outOfStock,
      lowStock,
      onSale: products.filter((p) => p.active && p.discount > 0).length,
      hidden: products.filter((p) => !p.active).length,
      total: products.filter((p) => p.active).length,
    };
  }, [products, orders]);

  const alerts = [];
  if (stats.pending.length > 0) {
    alerts.push({
      tone: "coral",
      Icon: ClipboardList,
      title: `${stats.pending.length} order${stats.pending.length === 1 ? "" : "s"} waiting for you`,
      body: "Stock stays reserved until you confirm or reject — after 24 hours it's released automatically.",
      action: "Review orders",
      onClick: () => go("orders"),
    });
  }
  if (stats.outOfStock.length > 0) {
    alerts.push({
      tone: "muted",
      Icon: Package,
      title: `${stats.outOfStock.length} product${stats.outOfStock.length === 1 ? " is" : "s are"} out of stock`,
      body: stats.outOfStock.slice(0, 3).map((p) => p.name).join(", ") + (stats.outOfStock.length > 3 ? "…" : ""),
      action: "Update stock",
      onClick: () => go("products"),
    });
  }
  if (stats.lowStock.length > 0) {
    alerts.push({
      tone: "muted",
      Icon: AlertTriangle,
      title: `${stats.lowStock.length} running low`,
      body: stats.lowStock.slice(0, 3).map((p) => p.name).join(", ") + (stats.lowStock.length > 3 ? "…" : ""),
      action: "View",
      onClick: () => go("products"),
    });
  }

  if (loading && products.length === 0 && orders.length === 0) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 spin text-muted" /></div>;
  }

  return (
    <div>
      {/* What needs attention */}
      {alerts.length > 0 ? (
        <div className="space-y-2.5 mb-6">
          {alerts.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              className="glass rounded-2xl p-4 w-full text-left tap-scale flex items-start gap-3"
              style={a.tone === "coral" ? { borderColor: "rgba(255,69,34,0.4)" } : undefined}
            >
              <span
                className="rounded-full p-2 flex-shrink-0"
                style={{ background: a.tone === "coral" ? "rgba(255,69,34,0.14)" : "var(--field-bg)" }}
              >
                <a.Icon className="w-4 h-4" style={{ color: a.tone === "coral" ? "var(--coral)" : "var(--fg-muted)" }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-body font-medium text-sm">{a.title}</span>
                <span className="block font-body text-xs text-muted mt-0.5 leading-5">{a.body}</span>
              </span>
              <span className="font-body text-xs flex-shrink-0 mt-1" style={{ color: "var(--coral)" }}>{a.action} →</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="glass rounded-2xl p-5 mb-6 flex items-center gap-3">
          <span className="rounded-full p-2 flex-shrink-0" style={{ background: "rgba(18,179,160,0.14)" }}>
            <CheckCircle2 className="w-4 h-4" style={{ color: "var(--teal)" }} />
          </span>
          <div>
            <p className="font-body font-medium text-sm">All caught up</p>
            <p className="font-body text-xs text-muted mt-0.5">No orders waiting, nothing out of stock.</p>
          </div>
        </div>
      )}

      {/* Today at a glance */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
        <StatCard label="Confirmed today" value={stats.confirmedToday} />
        <StatCard label="Earned today" value={money(stats.revenueToday)} accent />
        <StatCard label="Live products" value={stats.total} />
        <StatCard label="On sale" value={stats.onSale} />
      </div>

      {/* Quick actions */}
      <p className="font-body text-xs text-muted mb-2">Quick actions</p>
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        <button
          onClick={onAddProduct}
          className="glass-btn rounded-2xl py-3.5 tap-scale flex items-center justify-center gap-2 font-body text-sm font-medium"
          style={{ background: "var(--coral)", color: "#fff" }}
        >
          <Plus className="w-4 h-4" /> Add product
        </button>
        <button
          onClick={() => go("stories")}
          className="glass rounded-2xl py-3.5 tap-scale flex items-center justify-center gap-2 font-body text-sm font-medium"
        >
          <Sparkles className="w-4 h-4" /> New story
        </button>
      </div>

      {/* Everything else, with an explanation rather than a bare label */}
      <p className="font-body text-xs text-muted mb-2">More</p>
      <div className="space-y-2.5">
        <ToolCard
          Icon={Sparkles}
          title="The Edit"
          desc="Story rail on your homepage — lookbooks and fit comparisons."
          onClick={() => go("stories")}
        />
        <ToolCard
          Icon={Bell}
          title="Send a notification"
          desc="Push a message to everyone with the app installed."
          onClick={() => go("notify")}
        />
        <ToolCard
          Icon={AlertTriangle}
          title="Error reports"
          desc="Problems shoppers hit, reported automatically."
          onClick={() => go("errors")}
        />
      </div>

      {stats.hidden > 0 && (
        <p className="font-body text-xs text-muted text-center mt-6">
          {stats.hidden} product{stats.hidden === 1 ? " is" : "s are"} hidden from the shop.
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="glass rounded-2xl px-3 py-3.5 text-center">
      <p className="font-num font-bold text-xl leading-tight" style={accent ? { color: "var(--teal)" } : undefined}>{value}</p>
      <p className="font-body text-muted mt-1" style={{ fontSize: "0.68rem" }}>{label}</p>
    </div>
  );
}

function ToolCard({ Icon, title, desc, onClick }) {
  return (
    <button onClick={onClick} className="glass rounded-2xl p-3.5 w-full text-left tap-scale flex items-center gap-3">
      <span className="rounded-full p-2 flex-shrink-0" style={{ background: "var(--field-bg)" }}>
        <Icon className="w-4 h-4 text-muted" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-body font-medium text-sm">{title}</span>
        <span className="block font-body text-xs text-muted mt-0.5">{desc}</span>
      </span>
      <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" style={{ transform: "rotate(-90deg)" }} />
    </button>
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

// Same "-thumb" convention the storefront uses. The product list can show
// dozens of these at once, so pulling the small copy keeps the admin panel
// quick even over a phone connection in the shop.
function thumbUrlFor(url) {
  const u = String(url || "");
  if (!u.startsWith("/img/")) return "";
  const dot = u.lastIndexOf(".");
  if (dot <= 0) return "";
  return `${u.slice(0, dot)}-thumb${u.slice(dot)}`;
}

function Thumb({ src }) {
  const [ok, setOk] = useState(true);
  const small = thumbUrlFor(src) || src;
  if (src && ok) {
    return (
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0" style={{ border: "1px solid var(--glass-border)" }}>
        <img
          src={small}
          alt=""
          className="w-full h-full"
          style={{ objectFit: "cover" }}
          loading="lazy"
          onError={(e) => { if (small !== src) e.currentTarget.src = src; else setOk(false); }}
        />
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
  const [uploadNote, setUploadNote] = useState("");
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
    setUploadNote("");

    let savedBefore = 0;
    let savedAfter = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const label = files.length > 1 ? ` (${i + 1}/${files.length})` : "";
      try {
        // Shrink on this device first — a phone photo is 4–8 MB, and both
        // the upload and every future shopper would otherwise carry that.
        setUploadNote(`Preparing photo${label}…`);
        const opt = await optimizeImage(file);
        savedBefore += opt.originalSize;
        savedAfter += opt.optimizedSize;

        setUploadNote(`Uploading${label}…`);
        const fd = new FormData();
        fd.append("file", opt.full);
        if (opt.thumb) fd.append("thumb", opt.thumb);

        const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const d = await r.json();
        if (r.ok && d.url) setF((p) => ({ ...p, images: [...p.images, { url: d.url, color: null }] }));
        else setError(d.error || "Upload failed.");
      } catch { setError("Upload failed."); }
    }

    // Worth telling the owner — it's the difference between a shop that
    // loads instantly on mobile data and one that doesn't.
    if (savedBefore > savedAfter) {
      const pct = Math.round((1 - savedAfter / savedBefore) * 100);
      setUploadNote(`Optimized: ${formatBytes(savedBefore)} → ${formatBytes(savedAfter)} (${pct}% smaller)`);
    } else {
      setUploadNote("");
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
      isSpotlight: !!f.isSpotlight, appExclusive: !!f.appExclusive,
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
          {uploadNote ? (
            <p className="font-body text-xs" style={{ color: uploading ? "var(--fg-muted)" : "var(--teal)" }}>{uploadNote}</p>
          ) : (
            <p className="font-body text-xs text-muted">
              JPG, PNG or WEBP. They’re cropped to fit automatically, and shrunk for fast loading before upload.
            </p>
          )}
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
        <div className="flex gap-3 flex-wrap">
          <Toggle label="Sold out" on={!!f.soldOut} onClick={() => set("soldOut", !f.soldOut)} />
          <Toggle label="Visible in shop" on={f.active !== false} onClick={() => set("active", !(f.active !== false))} />
        </div>
        <div className="flex gap-3 flex-wrap mt-3">
          <Toggle label="⭐ Feature on app home" on={!!f.isSpotlight} onClick={() => set("isSpotlight", !f.isSpotlight)} />
          <Toggle label="🔥 App-exclusive price" on={!!f.appExclusive} onClick={() => set("appExclusive", !f.appExclusive)} />
        </div>
        {f.appExclusive && (
          <p className="font-body text-xs text-muted mt-2">
            This product will be completely hidden from the website — only visible to app users, under "App Exclusives".
          </p>
        )}
        {f.isSpotlight && (
          <p className="font-body text-xs text-muted mt-2">
            If more than one product is marked as featured, the app shows the most recently added one.
          </p>
        )}

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
