/* The shop window: its three mannequins wear the shop's real pieces.

   Each mannequin wears a top, trousers and shoes, coloured like the piece
   it wears (the colour of the piece's first photo). The page hands over,
   for each mannequin, the outfits it can wear (HomeLab planWindow: the
   middle one the pieces looked at most this week, the two beside it the
   newest); every few seconds one of them changes into its next outfit, the
   colours easing over, while you're standing outside. Nothing changes
   while the mouse is on a piece, inside the shop, or while the tab is
   hidden — and the store draws only while a colour is easing.

   A piece is a place to point and tap: the mouse finds it (it lights a
   touch and the page shows its little tag), a click opens it; a finger's
   tap shows its tag first, and the tag opens it.

   Driven by the store: setData(), update(dt) every frame, pickables(),
   anchor() for where a piece's tag goes on the screen. */
import * as THREE from "three";

const CHANGE_EVERY = 7; // seconds between two changes
const EASE = 0.9;       // seconds a change takes

export class WindowDisplay {
  constructor(store, mannequins) {
    this.store = store;
    this.list = mannequins || [];
    this.slots = this.list.map(() => ({ outfits: [], at: 0, now: null, from: {}, to: {}, t: 1 }));
    this.clock = 0;
    this.turn = 0;
    this.held = false;
    this.hot = null;
  }

  /* slots: for each mannequin, a list of outfits
     [{ top: { product, color }, bottom: { product, color }, shoes: { product, color } | null }] */
  setData(slots) {
    const key = JSON.stringify((slots || []).map((s) => (s || []).map((o) => ["top", "bottom", "shoes"].map((z) => (o[z] && o[z].product ? `${o[z].product.id}:${o[z].color}` : "")).join("/"))));
    if (key === this.key) return;
    this.key = key;
    this.list.forEach((m, i) => {
      const s = this.slots[i];
      s.outfits = (slots && slots[i]) || [];
      s.at = 0;
      this.dress(i, s.outfits[0] || null, true);
    });
    this.clock = 0;
    this.store.wake();
  }

  /* put mannequin i into an outfit (easing over unless now) */
  dress(i, outfit, now) {
    const m = this.list[i];
    const s = this.slots[i];
    s.now = outfit;
    for (const z of ["top", "bottom", "shoes"]) {
      const mat = m.mats[z];
      const piece = outfit && outfit[z];
      const want = new THREE.Color(piece && piece.color ? piece.color : z === "shoes" ? "#f4f3ef" : mat.color.getHex());
      s.from[z] = mat.color.clone();
      s.to[z] = want;
      if (now) mat.color.copy(want);
    }
    s.t = now ? 1 : 0;
  }

  /* can the window be seen (and tapped) now: outside, before the door */
  get open() {
    const st = this.store;
    return st.mode === "facade" || st.progress < 0.17;
  }

  update(dt) {
    let moving = false;
    // the colours easing into a new outfit
    for (let i = 0; i < this.list.length; i++) {
      const s = this.slots[i];
      if (s.t >= 1) continue;
      s.t = Math.min(1, s.t + dt / EASE);
      const k = s.t * s.t * (3 - 2 * s.t);
      for (const z of ["top", "bottom", "shoes"]) this.list[i].mats[z].color.copy(s.from[z]).lerp(s.to[z], k);
      moving = true;
    }
    // the one being pointed at glows a touch
    for (const m of this.list) {
      for (const z of ["top", "bottom", "shoes"]) {
        const on = this.hot && this.hot.mannequin === m && this.hot.zone === z ? 1 : 0;
        const mat = m.mats[z];
        const cur = mat.emissiveIntensity;
        const tgt = on ? 0.16 : 0;
        if (Math.abs(cur - tgt) > 1e-3) {
          mat.emissive.set("#ffffff");
          mat.emissiveIntensity = cur + (tgt - cur) * (1 - Math.exp(-dt * 12));
          moving = true;
        } else mat.emissiveIntensity = tgt;
      }
    }
    return moving;
  }

  /* Called by the store while it isn't drawing, too (a timer): is it time
     for the next change? Returns true when one started. */
  tick(seconds) {
    if (this.held || this.hot || !this.open || document.visibilityState === "hidden") return false;
    const many = this.slots.filter((s) => s.outfits.length > 1);
    if (!many.length) return false;
    this.clock += seconds;
    if (this.clock < CHANGE_EVERY) return false;
    this.clock = 0;
    // the next mannequin that has something else to wear
    for (let n = 0; n < this.list.length; n++) {
      const i = (this.turn + n) % this.list.length;
      const s = this.slots[i];
      if (s.outfits.length < 2) continue;
      this.turn = i + 1;
      s.at = (s.at + 1) % s.outfits.length;
      this.dress(i, s.outfits[s.at], false);
      return true;
    }
    return false;
  }

  /* [mesh, { mannequin, zone, piece }] for the pieces that can be tapped */
  pickables() {
    if (!this.open) return [];
    const out = [];
    this.list.forEach((m, i) => {
      const now = this.slots[i].now;
      if (!now) return;
      for (const z of ["top", "bottom", "shoes"]) {
        const piece = now[z];
        if (!piece) continue;
        for (const mesh of m.zones[z]) out.push([mesh, { window: true, mannequin: m, index: i, zone: z, piece, product: piece.product || null }]);
      }
    });
    return out;
  }

  /* where a piece's tag goes, in CSS pixels on the page */
  anchor(hit) {
    const st = this.store;
    const r = st.canvas.getBoundingClientRect();
    const v = hit.mannequin.anchors[hit.zone].clone();
    hit.mannequin.group.localToWorld(v);
    v.project(st.camera);
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  /* Where the middle of each piece in the window is on the page (CSS px),
     for the page's own tests, which point at them like a shopper would. */
  screenPoints() {
    const st = this.store;
    st.camera.updateMatrixWorld();
    const out = [];
    this.list.forEach((m, i) => {
      const now = this.slots[i].now;
      if (!now) return;
      for (const z of ["top", "bottom", "shoes"]) {
        if (!now[z]) continue;
        // a leg for the trousers (the top hangs over the hips)
        const mesh = m.zones[z][0];
        const box = new THREE.Box3().setFromObject(mesh);
        const c = box.getCenter(new THREE.Vector3());
        const r = st.canvas.getBoundingClientRect();
        c.project(st.camera);
        out.push({ index: i, zone: z, id: now[z].product ? now[z].product.id : null, x: r.left + ((c.x + 1) / 2) * r.width, y: r.top + ((1 - c.y) / 2) * r.height });
      }
    });
    return out;
  }
}
