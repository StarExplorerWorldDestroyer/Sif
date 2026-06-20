/**
 * Generates all Sif app icons from a single horizontal "glowing spear" mark.
 *
 * Outputs:
 *  - assets/images/favicon.png            (web tab, rounded dark badge)
 *  - assets/images/icon.png               (iOS app icon, full-bleed)
 *  - assets/images/splash-icon.png        (splash, transparent glyph)
 *  - assets/images/android-icon-foreground.png (adaptive fg, safe-zone glyph)
 *  - assets/images/android-icon-background.png (adaptive bg, solid warm-black)
 *  - assets/images/android-icon-monochrome.png (themed icon, white silhouette)
 *  - assets/brand/spear.svg               (canonical source badge)
 *
 * Run: node scripts/gen-icons.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'assets', 'images');
const BRAND = path.join(__dirname, '..', 'assets', 'brand');

// Shared <defs>; `id` keeps gradients/filter unique per generated SVG.
function defs(id, { glow = true } = {}) {
  return `
  <defs>
    <linearGradient id="blade-${id}" x1="67" y1="50" x2="96" y2="50" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#b4220c"/>
      <stop offset="0.5" stop-color="#FF5733"/>
      <stop offset="1" stop-color="#ffd9a0"/>
    </linearGradient>
    <linearGradient id="shaft-${id}" x1="16" y1="50" x2="68" y2="50" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#d8401e"/>
      <stop offset="1" stop-color="#ff9d63"/>
    </linearGradient>
    ${
      glow
        ? `<filter id="glow-${id}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="1.6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`
        : ''
    }
  </defs>`;
}

// The horizontal spear (tip pointing right), drawn in a 0..100 user space.
function glyph(id, { glow = true, mono = false } = {}) {
  const blade = mono ? '#fff' : `url(#blade-${id})`;
  const shaft = mono ? '#fff' : `url(#shaft-${id})`;
  const pommel = mono ? '#fff' : '#FF5733';
  const socket = mono ? '#fff' : '#ffb27a';
  const rib = mono ? '#fff' : '#ffe7c8';
  const filter = glow ? ` filter="url(#glow-${id})"` : '';
  return `
  <g${filter}>
    <rect x="18" y="46.5" width="50" height="7" rx="3.5" fill="${shaft}"/>
    <circle cx="16" cy="50" r="4.5" fill="${pommel}"/>
    <rect x="62" y="42.5" width="6" height="15" rx="2" fill="${socket}"/>
    <path d="M96 50 L72 36 L67 50 L72 64 Z" fill="${blade}"/>
    <path d="M70 50 L92 50" stroke="${rib}" stroke-width="1.6" stroke-linecap="round" stroke-opacity="${mono ? 1 : 0.9}"/>
  </g>`;
}

// Place the glyph centered and scaled (about the 50,50 center) within 0..100.
function placed(id, scale, opts) {
  return `<g transform="translate(50 50) scale(${scale}) translate(-50 -50)">${glyph(id, opts)}</g>`;
}

function badgeSVG(id, { rounded }) {
  const rim = rounded
    ? `<rect x="2.75" y="2.75" width="94.5" height="94.5" rx="${rounded - 0.75}" fill="none" stroke="#FF5733" stroke-opacity="0.35" stroke-width="1.5"/>`
    : '';
  const bg = rounded
    ? `<rect x="2" y="2" width="96" height="96" rx="${rounded}" fill="#0a0402"/>`
    : `<rect width="100" height="100" fill="#0a0402"/>
       <rect width="100" height="100" fill="url(#bgrad-${id})"/>`;
  const bgGrad = rounded
    ? ''
    : `<radialGradient id="bgrad-${id}" cx="50" cy="38" r="70" gradientUnits="userSpaceOnUse">
         <stop offset="0" stop-color="#1a0a04"/>
         <stop offset="0.55" stop-color="#0a0402"/>
         <stop offset="1" stop-color="#050201"/>
       </radialGradient>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  ${defs(id)}
  <defs>${bgGrad}</defs>
  ${bg}
  ${rim}
  ${placed(id, 0.9, {})}
</svg>`;
}

function glyphSVG(id, { scale, mono = false }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  ${defs(id, { glow: !mono })}
  ${placed(id, scale, { glow: !mono, mono })}
</svg>`;
}

const render = (svg, size, file, density = 384) =>
  sharp(Buffer.from(svg), { density })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(OUT, file));

(async () => {
  const faviconSVG = badgeSVG('fav', { rounded: 15 });
  // Persist the canonical source mark (rounded badge) for reference.
  fs.writeFileSync(path.join(BRAND, 'spear.svg'), faviconSVG + '\n');

  await render(faviconSVG, 48, 'favicon.png');
  await render(badgeSVG('icon', { rounded: 0 }), 1024, 'icon.png', 640);
  await render(glyphSVG('splash', { scale: 0.72 }), 1024, 'splash-icon.png', 640);
  await render(glyphSVG('afg', { scale: 0.5 }), 512, 'android-icon-foreground.png', 512);
  await render(glyphSVG('mono', { scale: 0.5, mono: true }), 432, 'android-icon-monochrome.png', 432);

  await sharp({
    create: { width: 512, height: 512, channels: 4, background: '#0A0503' },
  })
    .png()
    .toFile(path.join(OUT, 'android-icon-background.png'));

  console.log('Generated icons:', [
    'favicon.png',
    'icon.png',
    'splash-icon.png',
    'android-icon-foreground.png',
    'android-icon-background.png',
    'android-icon-monochrome.png',
  ].join(', '));
})();
