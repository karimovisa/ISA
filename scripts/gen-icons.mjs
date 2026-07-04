import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });

// Notification icon: black disc + white peak (the "aim"), 20% safe padding.
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <circle cx="96" cy="96" r="96" fill="#0A0A0A"/>
  <g stroke="#F5F0E8" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M44 130 H148" opacity="0.45"/>
    <path d="M58 130 L96 62 L134 130"/>
  </g>
</svg>`;

// Badge: monochrome filled peak (Android tints via alpha).
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">
  <path d="M16 54 L36 22 L56 54 Z" fill="#ffffff"/>
</svg>`;

await sharp(Buffer.from(icon)).resize(192, 192).png().toFile("public/icons/notification-icon-192.png");
await sharp(Buffer.from(icon)).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(badge)).resize(72, 72).png().toFile("public/icons/badge-72.png");
console.log("icons written");
