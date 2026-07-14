// ISA — generate the PWA / home-screen icons.  Run:  node scripts/gen-icons.mjs
//
// The app icons must be FULL-BLEED and OPAQUE. iOS rounds the corners itself, so
// any transparency (or a circle on a transparent canvas) shows up as a white ring
// on the home screen. Only the notification BADGE stays transparent — Android
// tints it via its alpha channel, which is what that format expects.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });

// The ISA mark: the mountain (aim) standing on the life line. Square, edge-to-edge.
// The mark fills ~60% of the canvas: big enough to read at 60px on a home screen,
// with enough margin to survive a maskable crop.
const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0A0A0A"/>
  <g stroke="#F5F0E8" stroke-width="34" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M112 374 H400" opacity="0.45"/>
    <path d="M150 344 L256 104 L362 344"/>
  </g>
</svg>`;

// Badge: monochrome filled peak on transparent (Android tints via alpha).
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">
  <path d="M16 54 L36 22 L56 54 Z" fill="#ffffff"/>
</svg>`;

const OPAQUE = [
  ["public/icons/icon-512.png", 512],
  ["public/icons/icon-192.png", 192],
  ["public/icons/notification-icon-192.png", 192],
  ["src/app/apple-icon.png", 180], // Next emits <link rel="apple-touch-icon">
  ["src/app/icon.png", 192],
];

for (const [file, size] of OPAQUE) {
  await sharp(Buffer.from(appIcon))
    .resize(size, size)
    .flatten({ background: "#0A0A0A" }) // drop alpha — no white corners on iOS
    .png()
    .toFile(file);
  console.log("wrote", file, `${size}x${size}`);
}

await sharp(Buffer.from(badge)).resize(72, 72).png().toFile("public/icons/badge-72.png");
console.log("wrote public/icons/badge-72.png (transparent, by design)");
