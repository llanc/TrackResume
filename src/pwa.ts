import { APP_NAME } from './types';

const ICON_CACHE = new Map<number, Uint8Array>();
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = buildCrcTable();

export function renderManifestResponse(): Response {
  return new Response(JSON.stringify({
    name: APP_NAME,
    short_name: APP_NAME,
    description: 'Installable resume tracking workspace for recruiter-only links.',
    lang: 'zh-CN',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f5efe5',
    theme_color: '#102542',
    prefer_related_applications: false,
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  }), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

export function renderServiceWorkerResponse(): Response {
  return new Response(`const CACHE_NAME = '${APP_NAME.toLowerCase()}-shell-v2';
const STATIC_ASSETS = [
  '/admin/login',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];
const OFFLINE_HTML = \`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${APP_NAME}</title>
    <style>
      :root{color-scheme:light;--bg:#f5efe5;--card:#fffdf9;--line:rgba(16,37,66,.12);--text:#102542;--muted:#596579}
      *{box-sizing:border-box}
      body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font-family:'PingFang SC','Microsoft YaHei',sans-serif;background:linear-gradient(180deg,#fdf9f2 0%,var(--bg) 100%);color:var(--text)}
      section{width:min(460px,100%);padding:28px;border-radius:28px;background:var(--card);border:1px solid var(--line);box-shadow:0 20px 60px rgba(16,37,66,.08)}
      h1{margin:0 0 12px;font-size:1.6rem}
      p{margin:0;color:var(--muted);line-height:1.7}
      a{display:inline-flex;margin-top:18px;padding:.9rem 1.1rem;border-radius:999px;background:#102542;color:#fff;text-decoration:none;font-weight:700}
    </style>
  </head>
  <body>
    <section>
      <h1>${APP_NAME} 当前离线</h1>
      <p>网络恢复后可以继续打开后台和分享链接。已安装的应用壳仍可从主屏幕或桌面启动。</p>
      <a href="/admin/login">回到登录页</a>
    </section>
  </body>
</html>\`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(STATIC_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) {
        return cached;
      }
      const response = await fetch(request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      return response;
    })());
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cached = await caches.match('/admin/login');
        if (cached) {
          return cached;
        }
        return new Response(OFFLINE_HTML, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      }
    })());
  }
});`, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

export function renderIconResponse(size: number): Response {
  const bytes = getIcon(size);
  const body = bytes.buffer instanceof ArrayBuffer
    ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    : bytes.slice().buffer;

  return new Response(body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

function getIcon(size: number): Uint8Array {
  const cached = ICON_CACHE.get(size);
  if (cached) {
    return cached;
  }

  const pixels = buildIconPixels(size);
  const png = encodePng(size, size, pixels);
  ICON_CACHE.set(size, png);
  return png;
}

function buildIconPixels(size: number): Uint8Array {
  const pixels = new Uint8Array(size * size * 4);
  const backgroundTop = [16, 37, 66];
  const backgroundBottom = [8, 18, 33];

  for (let y = 0; y < size; y += 1) {
    const mix = y / Math.max(size - 1, 1);
    const rowColor = [
      Math.round(backgroundTop[0] * (1 - mix) + backgroundBottom[0] * mix),
      Math.round(backgroundTop[1] * (1 - mix) + backgroundBottom[1] * mix),
      Math.round(backgroundTop[2] * (1 - mix) + backgroundBottom[2] * mix),
    ];

    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const glow = Math.max(0, 1 - Math.hypot(x - size * 0.24, y - size * 0.18) / (size * 0.75)) * 24;
      pixels[offset] = clampChannel(rowColor[0] + glow);
      pixels[offset + 1] = clampChannel(rowColor[1] + glow * 0.7);
      pixels[offset + 2] = clampChannel(rowColor[2] + glow * 0.5);
      pixels[offset + 3] = 255;
    }
  }

  fillCircle(pixels, size, size * 0.83, size * 0.2, size * 0.22, [201, 132, 47, 255]);
  fillRoundedRect(pixels, size, size * 0.19, size * 0.16, size * 0.58, size * 0.74, size * 0.075, [12, 25, 44, 36]);
  fillRoundedRect(pixels, size, size * 0.21, size * 0.12, size * 0.58, size * 0.74, size * 0.075, [255, 253, 249, 255]);
  fillRect(pixels, size, size * 0.28, size * 0.24, size * 0.06, size * 0.42, [201, 132, 47, 255]);
  fillRect(pixels, size, size * 0.4, size * 0.28, size * 0.28, size * 0.05, [16, 37, 66, 255]);
  fillRect(pixels, size, size * 0.4, size * 0.39, size * 0.2, size * 0.045, [16, 37, 66, 235]);
  fillRect(pixels, size, size * 0.4, size * 0.5, size * 0.24, size * 0.045, [16, 37, 66, 210]);
  fillRect(pixels, size, size * 0.4, size * 0.61, size * 0.16, size * 0.045, [16, 37, 66, 180]);
  fillCircle(pixels, size, size * 0.68, size * 0.7, size * 0.06, [201, 132, 47, 255]);
  fillCircle(pixels, size, size * 0.68, size * 0.7, size * 0.028, [255, 253, 249, 255]);

  return pixels;
}

function fillRect(
  pixels: Uint8Array,
  size: number,
  left: number,
  top: number,
  width: number,
  height: number,
  color: [number, number, number, number],
): void {
  const startX = Math.max(0, Math.floor(left));
  const endX = Math.min(size, Math.ceil(left + width));
  const startY = Math.max(0, Math.floor(top));
  const endY = Math.min(size, Math.ceil(top + height));

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      writePixel(pixels, size, x, y, color);
    }
  }
}

function fillCircle(
  pixels: Uint8Array,
  size: number,
  centerX: number,
  centerY: number,
  radius: number,
  color: [number, number, number, number],
): void {
  const startX = Math.max(0, Math.floor(centerX - radius));
  const endX = Math.min(size, Math.ceil(centerX + radius));
  const startY = Math.max(0, Math.floor(centerY - radius));
  const endY = Math.min(size, Math.ceil(centerY + radius));
  const radiusSquared = radius * radius;

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const dx = x + 0.5 - centerX;
      const dy = y + 0.5 - centerY;
      if (dx * dx + dy * dy <= radiusSquared) {
        writePixel(pixels, size, x, y, color);
      }
    }
  }
}

function fillRoundedRect(
  pixels: Uint8Array,
  size: number,
  left: number,
  top: number,
  width: number,
  height: number,
  radius: number,
  color: [number, number, number, number],
): void {
  const startX = Math.max(0, Math.floor(left));
  const endX = Math.min(size, Math.ceil(left + width));
  const startY = Math.max(0, Math.floor(top));
  const endY = Math.min(size, Math.ceil(top + height));
  const right = left + width;
  const bottom = top + height;

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      if (pointInRoundedRect(x + 0.5, y + 0.5, left, top, right, bottom, radius)) {
        writePixel(pixels, size, x, y, color);
      }
    }
  }
}

function pointInRoundedRect(
  x: number,
  y: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  radius: number,
): boolean {
  if (x >= left + radius && x <= right - radius) {
    return y >= top && y <= bottom;
  }

  if (y >= top + radius && y <= bottom - radius) {
    return x >= left && x <= right;
  }

  const cx = x < left + radius ? left + radius : right - radius;
  const cy = y < top + radius ? top + radius : bottom - radius;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function writePixel(
  pixels: Uint8Array,
  size: number,
  x: number,
  y: number,
  color: [number, number, number, number],
): void {
  const offset = (y * size + x) * 4;
  const alpha = color[3] / 255;
  const inverseAlpha = 1 - alpha;

  pixels[offset] = clampChannel(color[0] * alpha + pixels[offset] * inverseAlpha);
  pixels[offset + 1] = clampChannel(color[1] * alpha + pixels[offset + 1] * inverseAlpha);
  pixels[offset + 2] = clampChannel(color[2] * alpha + pixels[offset + 2] * inverseAlpha);
  pixels[offset + 3] = 255;
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const raw = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    raw[rowOffset] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), rowOffset + 1);
  }

  const ihdr = new Uint8Array(13);
  writeUInt32(ihdr, 0, width);
  writeUInt32(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return concatBytes([
    PNG_SIGNATURE,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', deflateStore(raw)),
    createChunk('IEND', new Uint8Array(0)),
  ]);
}

function createChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + data.length);
  writeUInt32(chunk, 0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  writeUInt32(chunk, chunk.length - 4, crc32(concatBytes([typeBytes, data])));
  return chunk;
}

function deflateStore(data: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [new Uint8Array([0x78, 0x01])];

  for (let offset = 0; offset < data.length; offset += 65535) {
    const blockLength = Math.min(65535, data.length - offset);
    const isFinal = offset + blockLength >= data.length ? 1 : 0;
    const header = new Uint8Array(5);
    header[0] = isFinal;
    header[1] = blockLength & 0xff;
    header[2] = (blockLength >> 8) & 0xff;
    const inverted = (~blockLength) & 0xffff;
    header[3] = inverted & 0xff;
    header[4] = (inverted >> 8) & 0xff;
    parts.push(header, data.subarray(offset, offset + blockLength));
  }

  const checksum = adler32(data);
  parts.push(new Uint8Array([
    (checksum >> 24) & 0xff,
    (checksum >> 16) & 0xff,
    (checksum >> 8) & 0xff,
    checksum & 0xff,
  ]));

  return concatBytes(parts);
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;

  for (const value of data) {
    a = (a + value) % 65521;
    b = (b + a) % 65521;
  }

  return ((b << 16) | a) >>> 0;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const value of data) {
    crc = CRC_TABLE[(crc ^ value) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
}

function writeUInt32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}
