/**
 * 调色板接口 —— 移植自 functions/palette.ts
 * GET /palette?image=<url>
 *
 * 主要差异：
 *   - 去掉 cf: { image: { ... } } Cloudflare 专有 fetch 选项（直接 fetch 原图）
 *   - 用本地内存缓存替代 caches.default（缓存 1 小时）
 *   - 颜色分析算法代码原样移植，无任何改动
 *   - 注意：PNG 图片会返回 415（unsupported），前端已有 Canvas 降级处理
 */

const { Router } = require('express');
const path = require('path');
const cache = require('../cache');

// jpeg-decoder.js 是 ESM 模块（export default），Node.js 需用动态 import()
// 用一个 Promise 缓存，确保只 import 一次
const DECODER_PATH = path.join(__dirname, '../../functions/lib/vendor/jpeg-decoder.js').replace(/\\/g, '/');
const _decoderPromise = import(`file:///${DECODER_PATH}`).then(m => m.default || m.decode);

async function getDecoder() {
  return _decoderPromise;
}

// ─── 常量（与 palette.ts 一致）─────────────────────────────────────────────────
const MAX_DIMENSION = 96;
const TARGET_SAMPLE_COUNT = 2400;

// ─── 工具函数（直接从 palette.ts 移植）────────────────────────────────────────

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function componentToHex(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}

function rgbToHex({ r, g, b }) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

function rgbToHsl(r, g, b) {
  const rN = clamp(r / 255, 0, 1);
  const gN = clamp(g / 255, 0, 1);
  const bN = clamp(b / 255, 0, 1);
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rN) h = ((gN - bN) / delta) % 6;
    else if (max === gN) h = (bN - rN) / delta + 2;
    else h = (rN - gN) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

function hueToRgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  const sat = clamp(s, 0, 1);
  const lit = clamp(l, 0, 1);
  const nh = (((h % 360) + 360) % 360) / 360;
  if (sat === 0) { const v = lit * 255; return { r: v, g: v, b: v }; }
  const q = lit < 0.5 ? lit * (1 + sat) : lit + sat - lit * sat;
  const p = 2 * lit - q;
  return {
    r: hueToRgb(p, q, nh + 1 / 3) * 255,
    g: hueToRgb(p, q, nh) * 255,
    b: hueToRgb(p, q, nh - 1 / 3) * 255,
  };
}

function hslToHex(color) {
  return rgbToHex(hslToRgb(color.h, color.s, color.l));
}

function relativeLuminance(r, g, b) {
  const normalize = v => {
    const c = clamp(v / 255, 0, 1);
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
}

function pickContrastColor(color) {
  return relativeLuminance(color.r, color.g, color.b) > 0.45 ? '#1f2937' : '#f8fafc';
}

function adjustSaturation(base, factor, offset = 0) {
  return clamp(base * factor + offset, 0, 1);
}

function adjustLightness(base, offset, factor = 1) {
  return clamp(base * factor + offset, 0, 1);
}

function analyzeImageColors(image) {
  const { data } = image;
  const totalPixels = data.length / 4;
  const step = Math.max(1, Math.floor(totalPixels / TARGET_SAMPLE_COUNT));
  let totalR = 0, totalG = 0, totalB = 0, count = 0;
  let accent = null;
  for (let i = 0; i < data.length; i += step * 4) {
    if (data[i + 3] < 48) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    totalR += r; totalG += g; totalB += b; count++;
    const hsl = rgbToHsl(r, g, b);
    const score = hsl.s * 0.65 + (1 - Math.abs(hsl.l - 0.5)) * 0.35;
    if (!accent || score > accent.score) accent = { color: hsl, score };
  }
  if (count === 0) throw new Error('No opaque pixels available for analysis');
  const average = rgbToHsl(totalR / count, totalG / count, totalB / count);
  return { average, accent: accent ? accent.color : average };
}

function buildGradientStops(accent) {
  const lc = [
    hslToHex({ h: accent.h, s: adjustSaturation(accent.s, 0.4, 0.08), l: adjustLightness(accent.l, 0.42, 0.52) }),
    hslToHex({ h: accent.h, s: adjustSaturation(accent.s, 0.52, 0.05), l: adjustLightness(accent.l, 0.26, 0.62) }),
    hslToHex({ h: accent.h, s: adjustSaturation(accent.s, 0.65), l: adjustLightness(accent.l, 0.12, 0.72) }),
  ];
  const dc = [
    hslToHex({ h: accent.h, s: adjustSaturation(accent.s, 0.55, 0.04), l: adjustLightness(accent.l, 0.14, 0.38) }),
    hslToHex({ h: accent.h, s: adjustSaturation(accent.s, 0.62, 0.02), l: adjustLightness(accent.l, 0.04, 0.3) }),
    hslToHex({ h: accent.h, s: adjustSaturation(accent.s, 0.72), l: adjustLightness(accent.l, -0.04, 0.22) }),
  ];
  return {
    light: { colors: lc, gradient: `linear-gradient(140deg, ${lc[0]} 0%, ${lc[1]} 45%, ${lc[2]} 100%)` },
    dark:  { colors: dc, gradient: `linear-gradient(135deg, ${dc[0]} 0%, ${dc[1]} 55%, ${dc[2]} 100%)` },
  };
}

function buildThemeTokens(accent) {
  return {
    light: {
      primaryColor:     hslToHex({ h: accent.h, s: adjustSaturation(accent.s, 0.6, 0.06),  l: adjustLightness(accent.l, 0.22, 0.6) }),
      primaryColorDark: hslToHex({ h: accent.h, s: adjustSaturation(accent.s, 0.72, 0.02), l: adjustLightness(accent.l, 0.06, 0.52) }),
    },
    dark: {
      primaryColor:     hslToHex({ h: accent.h, s: adjustSaturation(accent.s, 0.58, 0.04), l: adjustLightness(accent.l, 0.16, 0.42) }),
      primaryColorDark: hslToHex({ h: accent.h, s: adjustSaturation(accent.s, 0.68),        l: adjustLightness(accent.l, 0.02, 0.32) }),
    },
  };
}

function resizeImage(image) {
  const maxSide = Math.max(image.width, image.height);
  if (maxSide <= MAX_DIMENSION) return image;
  const scale = MAX_DIMENSION / maxSide;
  const width  = Math.max(1, Math.round(image.width  * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const resized = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcY = Math.min(image.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x++) {
      const srcX = Math.min(image.width - 1, Math.floor(x / scale));
      const si = (srcY * image.width + srcX) * 4;
      const di = (y * width + x) * 4;
      resized[di]     = image.data[si];
      resized[di + 1] = image.data[si + 1];
      resized[di + 2] = image.data[si + 2];
      resized[di + 3] = image.data[si + 3];
    }
  }
  return { width, height, data: resized };
}

async function decodeImage(arrayBuffer, contentType) {
  const subtype = (contentType.split('/')[1] || '').split(';')[0].toLowerCase();
  const supported = ['jpeg', 'jpg', 'pjpeg'];
  if (!supported.includes(subtype)) {
    const err = new Error(`Unsupported image format: ${subtype}`);
    err.name = 'UnsupportedImageFormatError';
    throw err;
  }
  const decodeJpeg = await getDecoder();
  const bytes = new Uint8Array(arrayBuffer);
  const decoded = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true });
  return resizeImage({
    width: decoded.width,
    height: decoded.height,
    data: new Uint8ClampedArray(decoded.data),
  });
}

async function buildPalette(arrayBuffer, contentType) {
  const imageData = await decodeImage(arrayBuffer, contentType);
  const analyzed  = analyzeImageColors(imageData);
  const gradients = buildGradientStops(analyzed.accent);
  const tokens    = buildThemeTokens(analyzed.accent);
  const accentRgb = hslToRgb(analyzed.accent.h, analyzed.accent.s, analyzed.accent.l);
  return {
    source: '',
    baseColor:     hslToHex(analyzed.accent),
    averageColor:  hslToHex(analyzed.average),
    accentColor:   hslToHex(analyzed.accent),
    contrastColor: pickContrastColor(accentRgb),
    gradients: { light: gradients.light, dark: gradients.dark },
    tokens,
  };
}

// ─── Express 路由 ──────────────────────────────────────────────────────────────

module.exports = function createPaletteRouter() {
  const router = Router();

  router.options('/', (req, res) => {
    res.status(204).set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    }).end();
  });

  router.get('/', async (req, res) => {
    const imageParam = req.query.image || req.query.url;
    if (!imageParam) {
      return res.status(400).json({ error: 'Missing image parameter' });
    }

    let target;
    try {
      target = new URL(imageParam);
    } catch {
      return res.status(400).json({ error: 'Invalid image URL' });
    }

    const cacheKey = `palette:${target.toString()}`;

    // ── Cache HIT ────────────────────────────────────────────────────────────
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.set({
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
        'X-Cache-Status': 'HIT',
      }).send(cached.body);
    }

    // ── Fetch 上游图片（无 Cloudflare 专有选项）────────────────────────────────
    let upstream;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      upstream = await fetch(target.toString(), { signal: controller.signal });
    } catch (err) {
      console.error('[Palette fetch]', err);
      return res.status(502).json({ error: 'Failed to fetch image' });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream request failed with status ${upstream.status}` });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return res.status(415).json({ error: 'Unsupported content type' });
    }

    const buffer = await upstream.arrayBuffer();

    try {
      const palette = await buildPalette(buffer, contentType);
      palette.source = target.toString();
      const json = JSON.stringify(palette);

      // 缓存 1 小时
      cache.set(cacheKey, { body: json, contentType: 'application/json' }, 3600);

      return res.set({
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
        'X-Cache-Status': 'MISS',
      }).send(json);
    } catch (err) {
      if (err.name === 'UnsupportedImageFormatError') {
        return res.status(415).json({ error: err.message });
      }
      console.error('[Palette build]', err);
      return res.status(500).json({ error: 'Failed to analyze image' });
    }
  });

  return router;
};
