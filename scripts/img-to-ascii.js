// Converts the generated Sif hologram PNG into orange-on-black ASCII art and
// writes it to constants/sif-ascii.ts as a plain string.
//
//   node scripts/img-to-ascii.js [width]
//
// Default width is 100 characters. Rows are derived from the image aspect
// ratio with a correction factor because monospace cells are ~2x taller than
// they are wide.
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const SRC = path.resolve(__dirname, '../assets/brand/sif-holo-reference.png');
const OUT = path.resolve(__dirname, '../constants/sif-ascii.ts');

// Sparse -> dense. Bright (holographic) pixels map to the densest glyphs;
// the black background falls through to a space. A long ramp preserves the
// subtle tonal detail in her hair and face when viewed at high resolution.
const RAMP =
  " .'^,:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@";
const CHAR_ASPECT = 2.0; // glyph height / width
const BLACK_CUTOFF = 0.05; // below this luminance -> background (space)
const GAMMA = 0.9; // <1 lifts midtones so the figure reads fuller

function clamp01(n) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function luminanceAt(data, iw, x, y) {
  const i = (y * iw + x) << 2;
  return (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
}

// Bounding box of the lit figure, so we drop the black margins and convert the
// subject at full resolution instead of squashing it.
function boundingBox(png, threshold = 0.1) {
  const { width: iw, height: ih, data } = png;
  let minX = iw;
  let minY = ih;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++) {
      if (luminanceAt(data, iw, x, y) > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const padX = Math.round((maxX - minX) * 0.04);
  const padY = Math.round((maxY - minY) * 0.02);
  return {
    x0: Math.max(0, minX - padX),
    y0: Math.max(0, minY - padY),
    x1: Math.min(iw, maxX + padX),
    y1: Math.min(ih, maxY + padY),
  };
}

function convert(png, width) {
  const { width: iw, data } = png;
  const box = boundingBox(png);
  const cropW = box.x1 - box.x0;
  const cropH = box.y1 - box.y0;
  const rows = Math.max(1, Math.round(((cropH / cropW) * width) / CHAR_ASPECT));
  const cellW = cropW / width;
  const cellH = cropH / rows;
  const lines = [];

  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < width; c++) {
      const x0 = box.x0 + Math.floor(c * cellW);
      const x1 = box.x0 + Math.min(cropW, Math.floor((c + 1) * cellW));
      const y0 = box.y0 + Math.floor(r * cellH);
      const y1 = box.y0 + Math.min(cropH, Math.floor((r + 1) * cellH));
      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * iw + x) << 2;
          const lum =
            (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
          sum += lum;
          count++;
        }
      }
      const avg = count ? sum / count : 0;
      if (avg < BLACK_CUTOFF) {
        line += ' ';
        continue;
      }
      const shaped = clamp01(Math.pow(avg, GAMMA));
      const idx = Math.min(RAMP.length - 1, Math.round(shaped * (RAMP.length - 1)));
      line += RAMP[idx];
    }
    lines.push(line.replace(/\s+$/u, '')); // trim trailing spaces per row
  }
  return lines;
}

function main() {
  const width = Number(process.argv[2]) || 100;
  const png = PNG.sync.read(fs.readFileSync(SRC));
  const lines = convert(png, width);

  const body = lines.join('\n');
  const ts =
    '// AUTO-GENERATED from assets/sif-holo-reference.png by scripts/img-to-ascii.js\n' +
    '// Run `node scripts/img-to-ascii.js [width]` to regenerate. Do not edit by hand.\n' +
    '/* eslint-disable */\n' +
    'export const SIF_ASCII_IMAGE = `\n' +
    body.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') +
    '\n`;\n';
  fs.writeFileSync(OUT, ts, 'utf8');

  const cols = Math.max(...lines.map((l) => l.length));
  console.log(`Wrote ${OUT}`);
  console.log(`ASCII size: ${cols} cols x ${lines.length} rows (target width ${width})`);
}

main();
