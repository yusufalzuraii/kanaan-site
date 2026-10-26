The phone app's portrait maker (phone/src/portrait.js), self-hosted so nothing comes from another site. These files
are not in the app's precache: they download the first time the photo editor opens in Team, then the phone keeps them
(the service worker caches /pos/ files as they are used), so it works offline after that.

- MediaPipe Selfie Segmentation — @mediapipe/selfie_segmentation 0.1.1675465747, Apache-2.0, © Google LLC:
  selfie_segmentation.js, selfie_segmentation.binarypb, selfie_segmentation.tflite (the general model),
  selfie_segmentation_solution_{simd_,}wasm_bin.{js,wasm} — copied as they are from the package.
- WebP encoder for Safari (its canvas can't write WebP) — @jsquash/webp 1.5.0 (libwebp from Squoosh), Apache-2.0:
  webp_enc_simd.wasm, webp_enc.wasm from node_modules/@jsquash/webp/codec/enc/, and webp-encode.js made with
  `node -e "require('esbuild').buildSync({entryPoints:['node_modules/@jsquash/webp/encode.js'],bundle:true,format:'esm',minify:true,outfile:'phone/public/mp/webp-encode.js'})"`
