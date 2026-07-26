/* ============================================================
   IMAGE OPTIMIZER — runs in the browser, before upload
   ------------------------------------------------------------
   Why this exists: product photos come straight off a phone, which
   means 3000×4000px files of 4–8 MB each. Those were being stored and
   served to shoppers at full size — a category page with 12 products
   could pull 50 MB+ over mobile data. On a Lebanese 3G/4G connection
   that's a page that never finishes loading, and it drags down the
   site's Google ranking too (page speed is a ranking signal).

   Doing it here rather than on the server is deliberate:
     • Cloudflare's own image resizing is a paid add-on
     • Resizing in a Worker would burn CPU time on every upload
     • The shop owner's phone/laptop does it for free, in ~1 second,
       and only the small file ever crosses the network — so uploading
       is faster for them too

   Each photo produces two files:
     • full  — up to 1400px, for the product page gallery
     • thumb — up to 600px, for grid cards (12 on screen at once)

   Nothing here throws: if anything at all goes wrong (unsupported
   browser, corrupt file, out of memory) we fall back to uploading the
   original file untouched. A slow photo is much better than no photo.
   ============================================================ */

const FULL_MAX = 1400;   // long edge, px — sharp on a retina product page
const THUMB_MAX = 600;   // long edge, px — sharp on a retina grid card
const QUALITY = 0.82;    // WebP quality; visually lossless for clothing photos
const SKIP_UNDER = 120 * 1024; // don't bother re-encoding files already this small

/* Does this browser actually produce WebP from a canvas?
   Safari silently hands back a PNG instead of failing, so we check the
   real output rather than trusting that toBlob accepted the type. */
let _webpSupport = null;
function supportsWebP() {
  if (_webpSupport !== null) return _webpSupport;
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    _webpSupport = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    _webpSupport = false;
  }
  return _webpSupport;
}

/* Decode the file, honouring EXIF orientation.
   Phone cameras usually store the photo in landscape and add an EXIF
   "rotate me" flag. Drawing to a canvas discards that flag, so without
   `imageOrientation: "from-image"` every portrait photo would come out
   lying on its side. Older browsers ignore the option, so we fall back
   to a plain <img>, which applies orientation itself. */
async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* option unsupported, or decode failed — try the fallback below */
    }
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

/* Resize onto a canvas. Shrinking by more than half in one draw makes
   the browser skip source pixels, which turns fine detail — fabric
   weave, stitching, print texture — into aliased noise. Halving
   repeatedly and only then hitting the target keeps that detail. */
function drawResized(source, targetW, targetH) {
  const srcW = source.width;
  const srcH = source.height;

  let canvas = document.createElement("canvas");
  let ctx;
  let curW = srcW;
  let curH = srcH;
  let current = source;

  while (curW / 2 > targetW && curH / 2 > targetH) {
    const nextW = Math.max(targetW, Math.round(curW / 2));
    const nextH = Math.max(targetH, Math.round(curH / 2));
    const step = document.createElement("canvas");
    step.width = nextW;
    step.height = nextH;
    ctx = step.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(current, 0, 0, nextW, nextH);
    current = step;
    curW = nextW;
    curH = nextH;
  }

  canvas.width = targetW;
  canvas.height = targetH;
  ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(current, 0, 0, targetW, targetH);
  return canvas;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/* Fit within a max long edge, never scaling a small photo up. */
function fit(width, height, max) {
  const longest = Math.max(width, height);
  if (longest <= max) return { w: width, h: height, scaled: false };
  const ratio = max / longest;
  return { w: Math.round(width * ratio), h: Math.round(height * ratio), scaled: true };
}

async function renderVariant(bitmap, max, mime) {
  const { w, h } = fit(bitmap.width, bitmap.height, max);
  const canvas = drawResized(bitmap, w, h);
  const blob = await canvasToBlob(canvas, mime, QUALITY);
  // Free the canvas immediately — several 1400px canvases held at once
  // is a real memory problem on an older phone.
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

/**
 * Optimize one image file for upload.
 *
 * Returns { full, thumb, originalSize, optimizedSize, optimized }.
 * `full` is always a File ready to upload — the original itself if
 * optimization wasn't possible or wasn't worth it. `thumb` may be null.
 */
export async function optimizeImage(file) {
  const originalSize = file.size;
  const untouched = { full: file, thumb: null, originalSize, optimizedSize: originalSize, optimized: false };

  // GIFs are usually animated; a canvas would flatten them to one frame.
  if (file.type === "image/gif") return untouched;
  // Already small enough that re-encoding risks losing more quality than
  // it saves bytes.
  if (originalSize <= SKIP_UNDER) return untouched;

  let bitmap;
  try {
    bitmap = await decode(file);
  } catch {
    return untouched;
  }

  try {
    const useWebP = supportsWebP();
    const mime = useWebP ? "image/webp" : "image/jpeg";
    const ext = useWebP ? "webp" : "jpg";
    const base = (file.name || "photo").replace(/\.[^.]+$/, "") || "photo";

    const [fullBlob, thumbBlob] = await Promise.all([
      renderVariant(bitmap, FULL_MAX, mime),
      renderVariant(bitmap, THUMB_MAX, mime),
    ]);

    if (!fullBlob) return untouched;

    // If the "optimized" version somehow came out bigger (can happen with
    // an already-compressed small image), keep the original.
    if (fullBlob.size >= originalSize) return untouched;

    return {
      full: new File([fullBlob], `${base}.${ext}`, { type: mime }),
      thumb: thumbBlob ? new File([thumbBlob], `${base}-thumb.${ext}`, { type: mime }) : null,
      originalSize,
      optimizedSize: fullBlob.size + (thumbBlob ? thumbBlob.size : 0),
      optimized: true,
    };
  } catch {
    return untouched;
  } finally {
    // createImageBitmap results hold native memory until closed.
    if (bitmap && typeof bitmap.close === "function") bitmap.close();
  }
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
