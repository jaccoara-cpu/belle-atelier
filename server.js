const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'images', 'uploads');

// Ensure required directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

// --- DATA ACCESS & ATOMIC WRITING ---
function readJSON(file, defaultValue = []) {
  try {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return defaultValue;
  }
}

function writeJSON(file, data) {
  const filePath = path.join(DATA_DIR, file);
  const tempPath = path.join(DATA_DIR, `${file}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (err) {
    console.error(`Error atomic writing ${file}:`, err);
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
    return false;
  }
}

// Config file management
function getConfig() {
  return readJSON('config.json', {
    telegram: {
      botToken: '8682075215:AAEfRKiuZo443UCaZop9I3CPrGGSKGM2IEs',
      chatId: '-5522138796',
      isActive: true
    }
  });
}

function saveConfig(cfg) {
  return writeJSON('config.json', cfg);
}

// --- TELEGRAM DISPATCHER (SERVER-SIDE) ---
function sendTelegramMessage(text) {
  return new Promise((resolve) => {
    const config = getConfig();
    const { botToken, chatId, isActive } = config.telegram || {};

    if (!isActive || !botToken || !chatId) {
      console.log(`[Telegram Disabled]: Would send message:\n${text}`);
      return resolve({ success: false, error: 'Telegram-бот не налаштований або вимкнений' });
    }

    const payload = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            resolve({ success: true, result: parsed.result });
          } else {
            console.error('[Telegram API Error]:', parsed);
            resolve({ success: false, error: parsed.description || 'Помилка Telegram API' });
          }
        } catch (e) {
          resolve({ success: false, error: 'Некоректна відповідь Telegram' });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Telegram Network Error]:', err.message);
      resolve({ success: false, error: 'Помилка підключення до Telegram' });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Таймаут з\'єднання з Telegram' });
    });

    req.write(payload);
    req.end();
  });
}

// --- IN-MEMORY SESSIONS & 2FA STORAGE ---
// Admin active sessions: token -> { createdAt, expiresAt }
const activeSessions = new Map();
// Pending 2FA codes: ip -> { code, expiresAt, attempts }
const pending2FA = new Map();

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TWO_FA_TTL_MS = 5 * 60 * 1000;         // 5 minutes

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt <= now) activeSessions.delete(token);
  }
  for (const [key, p] of pending2FA.entries()) {
    if (p.expiresAt <= now) pending2FA.delete(key);
  }
}
setInterval(cleanExpiredSessions, 10 * 60 * 1000);

// --- RATE LIMITER (SLIDING WINDOW / IP BUCKETS) ---
const rateLimits = new Map();

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || '127.0.0.1';
}

function checkRateLimit(ip, bucket, maxHits, windowSeconds) {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  let entry = rateLimits.get(key);

  if (!entry || entry.resetTime <= now) {
    entry = { hits: 1, resetTime: now + (windowSeconds * 1000) };
    rateLimits.set(key, entry);
    return { allowed: true, remaining: maxHits - 1, resetSeconds: windowSeconds };
  }

  entry.hits++;
  if (entry.hits > maxHits) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, remaining: 0, resetSeconds: retryAfter };
  }

  return { allowed: true, remaining: maxHits - entry.hits, resetSeconds: Math.ceil((entry.resetTime - now) / 1000) };
}

// --- SECURITY HEADERS ---
function setSecurityHeaders(res, isApi = false) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  if (!isApi) {
    // Content-Security-Policy for HTML pages
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "img-src 'self' data: https: blob:; " +
      "connect-src 'self' https://api.telegram.org; " +
      "frame-ancestors 'none'; " +
      "object-src 'none'; " +
      "base-uri 'self';"
    );
  }
}

// --- RESPONSE HELPERS ---
function sendJSON(res, statusCode, data, headers = {}) {
  setSecurityHeaders(res, true);
  const baseHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...headers
  };
  res.writeHead(statusCode, baseHeaders);
  res.end(JSON.stringify(data));
}

// --- AUTHENTICATION MIDDLEWARE ---
function verifyAdminSession(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const session = activeSessions.get(token);
      if (session && session.expiresAt > Date.now()) {
        return true;
      }
    }
  }

  // Local loopback admin access
  const ip = req.socket?.remoteAddress || '';
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  const origin = req.headers['origin'] || req.headers['referer'] || '';
  if (isLocal && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    return true;
  }

  return false;
}

// --- SAFE BODY PARSER WITH INJECTION & SIZE CHECKS ---
function parseBody(req, maxSize = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxSize) {
        req.destroy();
        reject({ statusCode: 413, message: 'Розмір запиту перевищує дозволений ліміт' });
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});

      try {
        const parsed = JSON.parse(raw);
        // Prototype pollution check
        if (raw.includes('__proto__') || raw.includes('constructor') || raw.includes('prototype')) {
          const hasPollution = (obj) => {
            if (!obj || typeof obj !== 'object') return false;
            for (const key of Object.keys(obj)) {
              if (key === '__proto__' || key === 'constructor' || key === 'prototype') return true;
              if (typeof obj[key] === 'object' && hasPollution(obj[key])) return true;
            }
            return false;
          };
          if (hasPollution(parsed)) {
            return reject({ statusCode: 400, message: 'Виявлено неприпустимі параметри об\'єкта (Prototype Pollution)' });
          }
        }
        resolve(parsed);
      } catch (err) {
        reject({ statusCode: 400, message: 'Некоректний формат JSON' });
      }
    });

    req.on('error', err => {
      reject({ statusCode: 500, message: err.message });
    });
  });
}

// --- SANITIZE HTML TO STRING ---
function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim();
}

// --- STATIC FILE SERVER ---
function serveStatic(req, res, pathname) {
  setSecurityHeaders(res, false);

  let filePath = pathname === '/' ? 'index.html' : pathname;
  if (filePath.startsWith('/')) filePath = filePath.slice(1);

  // Safeguard: handle clean routing and sub-route assets
  // e.g. /product/beregynya -> product.html
  // and /product/images/... -> images/...
  if (filePath.startsWith('product/images/')) {
    filePath = filePath.replace('product/', '');
  }

  if (!path.extname(filePath)) {
    if (fs.existsSync(path.join(PUBLIC_DIR, filePath + '.html'))) {
      filePath += '.html';
    } else if (filePath.startsWith('product/')) {
      filePath = 'product.html';
    }
  }

  const fullPath = path.normalize(path.join(PUBLIC_DIR, filePath));

  // Security check: ensure path is strictly within PUBLIC_DIR
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
        <!DOCTYPE html>
        <html lang="uk">
        <head><meta charset="utf-8"><title>404 — Belle Atelier</title>
        <style>body{font-family:sans-serif;text-align:center;padding:10vh 20px;background:#fbf9f4;color:#1b1c19;}h1{color:#5e1020;}a{color:#725b38;}</style>
        </head><body>
          <h1>404 — Сторінку не знайдено</h1>
          <p>Виріб або сторінка була переміщена чи видалена.</p>
          <p><a href="/">Повернутися на головну</a> | <a href="/catalog.html">Перейти до каталогу</a></p>
        </body></html>
      `);
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(fullPath).pipe(res);
  });
}

// --- SERVER MAIN REQUEST ROUTER ---
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;
  const clientIP = getClientIP(req);

  // CORS preflight
  if (method === 'OPTIONS') {
    setSecurityHeaders(res, true);
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // --- API ROUTES ---
  if (pathname.startsWith('/api/')) {
    // 1. General Rate Limit for API
    const generalLimit = checkRateLimit(clientIP, 'general_api', 150, 60);
    if (!generalLimit.allowed) {
      return sendJSON(res, 429, {
        success: false,
        error: `Забагато запитів. Будь ласка, зачекайте ${generalLimit.resetSeconds} с.`
      }, { 'Retry-After': String(generalLimit.resetSeconds) });
    }

    // ==========================================
    // 2. ADMIN AUTHENTICATION & 2FA ENDPOINTS
    // ==========================================

    // POST /api/admin/login/request
    if (pathname === '/api/admin/login/request' && method === 'POST') {
      const authLimit = checkRateLimit(clientIP, 'auth_request', 3, 300);
      if (!authLimit.allowed) {
        return sendJSON(res, 429, {
          success: false,
          error: `Перевищено ліміт запитів 2FA. Зачекайте ${authLimit.resetSeconds} с.`
        }, { 'Retry-After': String(authLimit.resetSeconds) });
      }

      // Generate 6-digit code
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + TWO_FA_TTL_MS;
      pending2FA.set(clientIP, { code, expiresAt, attempts: 0 });

      const config = getConfig();
      const timeStr = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
      const tgMessage = `🔐 <b>Belle Atelier • Вхід в Адмін-панель</b>\n\n` +
        `Одноразовий 2FA-код для входу:\n` +
        `👉 <code>${code}</code> 👈\n\n` +
        `⏱ Код дійсний 5 хвилин.\n` +
        `🕒 Час: <i>${timeStr}</i>\n` +
        `🌐 IP: <code>${clientIP}</code>\n` +
        `⚠️ Якщо це були не ви, зверніться до системного адміністратора.`;

      let via = 'demo';
      if (config.telegram && config.telegram.isActive) {
        const tgRes = await sendTelegramMessage(tgMessage);
        if (tgRes.success) {
          via = 'telegram';
        }
      }

      console.log(`\n========================================`);
      console.log(`[ADMIN 2FA CODE]: ${code} (IP: ${clientIP}, Method: ${via})`);
      console.log(`========================================\n`);

      return sendJSON(res, 200, {
        success: true,
        via,
        message: via === 'telegram'
          ? 'Одноразовий 2FA-код успішно надіслано у ваш Telegram!'
          : 'Telegram-бот ще не підключено. Демонстраційний код відображено для первинного налаштування.',
        code: via === 'demo' ? code : undefined // only expose code if demo mode
      });
    }

    // POST /api/admin/login/verify
    if (pathname === '/api/admin/login/verify' && method === 'POST') {
      const verifyLimit = checkRateLimit(clientIP, 'auth_verify', 5, 300);
      if (!verifyLimit.allowed) {
        return sendJSON(res, 429, {
          success: false,
          error: `Забагато невірних спроб введення 2FA коду. Доступ заблоковано на ${verifyLimit.resetSeconds} с.`
        }, { 'Retry-After': String(verifyLimit.resetSeconds) });
      }

      try {
        const body = await parseBody(req, 4096);
        const inputCode = String(body.code || '').trim();

        const pending = pending2FA.get(clientIP);
        if (!pending) {
          return sendJSON(res, 400, {
            success: false,
            error: 'Сесія запиту коду не знайдена або термін її дії вичерпано. Запитайте новий код.'
          });
        }

        if (pending.expiresAt <= Date.now()) {
          pending2FA.delete(clientIP);
          return sendJSON(res, 400, {
            success: false,
            error: 'Термін дії коду (5 хв) закінчився. Запитайте новий код.'
          });
        }

        if (pending.code !== inputCode) {
          pending.attempts++;
          if (pending.attempts >= 5) {
            pending2FA.delete(clientIP);
            return sendJSON(res, 403, {
              success: false,
              error: 'Вичерпано максимальну кількість спроб (5). Запитайте новий код.'
            });
          }
          return sendJSON(res, 401, {
            success: false,
            error: `Невірний код підтвердження. Залишилось спроб: ${5 - pending.attempts}`
          });
        }

        // Code is valid! Issue 256-bit cryptotoken
        pending2FA.delete(clientIP);
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + SESSION_TTL_MS;
        activeSessions.set(token, { createdAt: Date.now(), expiresAt, clientIP });

        return sendJSON(res, 200, {
          success: true,
          token,
          expiresAt,
          message: 'Автентифікація успішна. Вітаємо в системі керування Belle Atelier! ✨'
        });
      } catch (err) {
        return sendJSON(res, err.statusCode || 400, { success: false, error: err.message });
      }
    }

    // GET /api/admin/check-auth
    if (pathname === '/api/admin/check-auth' && method === 'GET') {
      const isAuth = verifyAdminSession(req);
      if (!isAuth) {
        return sendJSON(res, 401, { success: false, authenticated: false, error: 'Сесія недійсна або вичерпана' });
      }
      return sendJSON(res, 200, { success: true, authenticated: true });
    }

    // POST /api/admin/logout
    if (pathname === '/api/admin/logout' && method === 'POST') {
      const authHeader = req.headers['authorization'] || '';
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        activeSessions.delete(token);
      }
      return sendJSON(res, 200, { success: true, message: 'Сесію завершено' });
    }

    // POST /api/admin/telegram-config
    if (pathname === '/api/admin/telegram-config' && method === 'POST') {
      if (!verifyAdminSession(req)) {
        return sendJSON(res, 401, { success: false, error: 'Доступ заборонено (потрібна авторизація)' });
      }

      try {
        const body = await parseBody(req, 8192);
        const botToken = String(body.botToken || '').trim();
        const chatId = String(body.chatId || '').trim();

        const config = getConfig();
        config.telegram = {
          botToken,
          chatId,
          isActive: Boolean(botToken && chatId)
        };
        saveConfig(config);

        return sendJSON(res, 200, {
          success: true,
          message: 'Налаштування Telegram-бота безпечно збережено на сервері!',
          isActive: config.telegram.isActive
        });
      } catch (err) {
        return sendJSON(res, 400, { success: false, error: err.message });
      }
    }

    // POST /api/admin/telegram-test
    if (pathname === '/api/admin/telegram-test' && method === 'POST') {
      if (!verifyAdminSession(req)) {
        return sendJSON(res, 401, { success: false, error: 'Доступ заборонено' });
      }

      const timeStr = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
      const testMsg = `🤖 <b>Belle Atelier • Тест зв'язку</b>\n\n` +
        `Бот успішно підключено до панелі керування сайтом!\n` +
        `🕒 Час: <i>${timeStr}</i>\n` +
        `🌐 Сервер: <code>Belle Couture Engine</code>`;

      const resTg = await sendTelegramMessage(testMsg);
      if (resTg.success) {
        return sendJSON(res, 200, { success: true, message: 'Тестове повідомлення успішно надіслано в Telegram!' });
      } else {
        return sendJSON(res, 400, { success: false, error: resTg.error || 'Помилка відправки в Telegram' });
      }
    }

    // ==========================================
    // 3. PRODUCTS CATALOG ENDPOINTS (PUBLIC & ADMIN)
    // ==========================================

    // GET /api/products
    if (pathname === '/api/products' && method === 'GET') {
      const products = readJSON('products.json', []);
      const { category, search, minPrice, maxPrice, size } = parsedUrl.query;

      let filtered = products.filter(p => !p.isArchived);
      if (category && category !== 'all') {
        filtered = filtered.filter(p => p.category === category || p.cat === category);
      }
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(p =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.art && p.art.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
        );
      }
      if (minPrice) filtered = filtered.filter(p => p.price >= Number(minPrice));
      if (maxPrice) filtered = filtered.filter(p => p.price <= Number(maxPrice));
      if (size) filtered = filtered.filter(p => Array.isArray(p.sizes) && p.sizes.includes(size));

      return sendJSON(res, 200, { success: true, count: filtered.length, products: filtered });
    }

    // GET /api/products/:id
    if (pathname.startsWith('/api/products/') && method === 'GET' && !pathname.includes('/api/products/')) {
      const id = pathname.replace('/api/products/', '');
      const products = readJSON('products.json', []);
      const product = products.find(p => p.id === id);
      if (!product) {
        return sendJSON(res, 404, { success: false, error: 'Виріб не знайдено' });
      }
      return sendJSON(res, 200, { success: true, product });
    }

    // POST /api/products (Admin Protected - Create Product)
    if (pathname === '/api/products' && method === 'POST') {
      if (!verifyAdminSession(req)) {
        return sendJSON(res, 401, { success: false, error: 'Потрібна авторизація адміністратора' });
      }

      try {
        const pData = await parseBody(req, 10 * 1024 * 1024); // 10MB limit for rich product with photos
        if (!pData.name || !pData.price) {
          return sendJSON(res, 400, { success: false, error: 'Назва та ціна виробу є обов\'язковими' });
        }

        const products = readJSON('products.json', []);
        const rawImages = Array.isArray(pData.images) && pData.images.length > 0
          ? pData.images.filter(Boolean)
          : (pData.img ? [pData.img] : ['/images/berehynia_dress_1789843600634.jpg']);

        const newProduct = {
          id: pData.id || 'prod_' + Date.now(),
          art: pData.art || 'BL-' + Math.floor(100 + Math.random() * 900),
          name: sanitizeText(pData.name),
          cat: pData.cat || 'women',
          category: pData.cat || 'women',
          category_name: pData.category_name || 'Одяг',
          price: Math.max(0, Math.round(Number(pData.price) || 0)),
          oldPrice: pData.oldPrice ? Math.max(0, Math.round(Number(pData.oldPrice))) : null,
          sale: pData.sale || null,
          inStock: pData.inStock !== false,
          isArchived: false,
          fabric: sanitizeText(pData.fabric || "100% пом'якшений льон"),
          description: sanitizeText(pData.description || ""),
          sizes: Array.isArray(pData.sizes) && pData.sizes.length > 0 ? pData.sizes : ['XS', 'S', 'M', 'L', 'XL'],
          colors: Array.isArray(pData.colors) && pData.colors.length > 0 ? pData.colors : ['Молочний'],
          variants: Array.isArray(pData.variants) ? pData.variants : [],
          img: rawImages[0] || '/images/berehynia_dress_1789843600634.jpg',
          images: rawImages,
          updatedAt: Date.now()
        };

        products.unshift(newProduct);
        writeJSON('products.json', products);

        return sendJSON(res, 201, {
          success: true,
          message: `Виріб «${newProduct.name}» збережено в базі даних!`,
          product: newProduct
        });
      } catch (err) {
        return sendJSON(res, err.statusCode || 400, { success: false, error: err.message });
      }
    }

    // PUT /api/products/:id (Admin Protected - Update Product)
    if (pathname.startsWith('/api/products/') && method === 'PUT') {
      if (!verifyAdminSession(req)) {
        return sendJSON(res, 401, { success: false, error: 'Потрібна авторизація адміністратора' });
      }

      const id = pathname.replace('/api/products/', '');
      try {
        const pData = await parseBody(req, 10 * 1024 * 1024);
        const products = readJSON('products.json', []);
        const index = products.findIndex(p => p.id === id);

        if (index === -1) {
          return sendJSON(res, 404, { success: false, error: 'Виріб не знайдено для оновлення' });
        }

        // Clean & normalize images array
        if (pData.images && Array.isArray(pData.images)) {
          const cleanImages = pData.images.filter(Boolean);
          pData.images = cleanImages.length > 0 ? cleanImages : [pData.img || products[index].img];
          pData.img = pData.images[0];
        } else if (pData.img) {
          pData.images = [pData.img];
        }

        if (pData.name) pData.name = sanitizeText(pData.name);
        if (pData.fabric) pData.fabric = sanitizeText(pData.fabric);
        if (pData.description) pData.description = sanitizeText(pData.description);
        if (pData.price !== undefined) pData.price = Math.max(0, Math.round(Number(pData.price)));
        if (pData.oldPrice !== undefined) pData.oldPrice = pData.oldPrice ? Math.max(0, Math.round(Number(pData.oldPrice))) : null;

        // Auto calculate discount badge
        if (pData.oldPrice && pData.oldPrice > pData.price) {
          pData.sale = `SALE −${Math.round((1 - pData.price / pData.oldPrice) * 100)}%`;
        } else if (pData.price && products[index].oldPrice && products[index].oldPrice > pData.price) {
          pData.sale = `SALE −${Math.round((1 - pData.price / products[index].oldPrice) * 100)}%`;
        }

        pData.updatedAt = Date.now();
        products[index] = { ...products[index], ...pData };
        writeJSON('products.json', products);

        return sendJSON(res, 200, {
          success: true,
          message: `Виріб «${products[index].name}» успішно оновлено!`,
          product: products[index]
        });
      } catch (err) {
        return sendJSON(res, err.statusCode || 400, { success: false, error: err.message });
      }
    }

    // DELETE /api/products/:id (Admin Protected - Delete or Archive)
    if (pathname.startsWith('/api/products/') && method === 'DELETE') {
      if (!verifyAdminSession(req)) {
        return sendJSON(res, 401, { success: false, error: 'Потрібна авторизація адміністратора' });
      }

      const id = pathname.replace('/api/products/', '');
      const products = readJSON('products.json', []);
      const index = products.findIndex(p => p.id === id);

      if (index === -1) {
        return sendJSON(res, 404, { success: false, error: 'Виріб не знайдено' });
      }

      const deleted = products.splice(index, 1)[0];
      writeJSON('products.json', products);

      return sendJSON(res, 200, {
        success: true,
        message: `Виріб «${deleted.name}» видалено з бази даних`
      });
    }

    // POST /api/upload (Admin Protected - Direct optimized image upload)
    if (pathname === '/api/upload' && method === 'POST') {
      if (!verifyAdminSession(req)) {
        return sendJSON(res, 401, { success: false, error: 'Потрібна авторизація адміністратора' });
      }

      try {
        const body = await parseBody(req, 15 * 1024 * 1024); // 15MB max upload
        const dataUrl = body.image || body.base64;

        if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
          return sendJSON(res, 400, { success: false, error: 'Некоректний формат зображення (очікується data:image/...)' });
        }

        const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          return sendJSON(res, 400, { success: false, error: 'Недійсне Base64-кодування' });
        }

        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = `prod_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
        const filePath = path.join(UPLOADS_DIR, filename);

        fs.writeFileSync(filePath, buffer);
        const webPath = `/images/uploads/${filename}`;

        return sendJSON(res, 201, {
          success: true,
          url: webPath,
          sizeBytes: buffer.length
        });
      } catch (err) {
        return sendJSON(res, err.statusCode || 400, { success: false, error: err.message });
      }
    }

    // ==============================================================
    // 4. ORDERS & ANTI-TAMPERING VERIFICATION (BURP SUITE DEFENSE)
    // ==============================================================
    if (pathname === '/api/orders' && method === 'POST') {
      // Rate limit: 10 orders per 10 minutes per IP
      const orderLimit = checkRateLimit(clientIP, 'orders', 10, 600);
      if (!orderLimit.allowed) {
        return sendJSON(res, 429, {
          success: false,
          error: `Забагато спроб оформлення замовлення. Зачекайте ${orderLimit.resetSeconds} с.`
        }, { 'Retry-After': String(orderLimit.resetSeconds) });
      }

      try {
        const orderData = await parseBody(req, 512 * 1024);

        // Required fields validation
        const customerName = sanitizeText(orderData.customerName);
        const customerPhone = sanitizeText(orderData.customerPhone || orderData.phone);

        if (!customerName || !customerPhone) {
          return sendJSON(res, 400, { success: false, error: "ПІБ та контактний телефон обов'язкові для зв'язку зі стилістом" });
        }

        // Phone format validation (Ukrainian / International format)
        const cleanPhoneDigits = customerPhone.replace(/[^0-9]/g, '');
        if (cleanPhoneDigits.length < 9 || cleanPhoneDigits.length > 13) {
          return sendJSON(res, 400, { success: false, error: "Введіть коректний номер телефону (від 9 до 12 цифр)" });
        }

        // Verify items against authoritative catalog
        const catalogProducts = readJSON('products.json', []);
        const rawItems = Array.isArray(orderData.items) ? orderData.items : [];

        if (rawItems.length === 0) {
          return sendJSON(res, 400, { success: false, error: 'Кошик порожній. Додайте хоча б один виріб.' });
        }

        let authoritativeItemsSum = 0;
        const verifiedItems = [];

        for (const item of rawItems) {
          const qty = Math.max(1, Math.min(20, Math.floor(Number(item.quantity || item.qty) || 1)));
          const catProd = catalogProducts.find(p => p.id === item.id || p.art === item.art || p.name === item.name);

          // Authoritative price check
          let authoritativeItemPrice = 0;
          let officialName = item.name || 'Виріб Belle';
          let officialArt = item.art || 'BL-000';

          if (catProd) {
            authoritativeItemPrice = Number(catProd.price) || 0;
            officialName = catProd.name;
            officialArt = catProd.art || officialArt;

            // Check variant price if provided
            if (item.variantId && Array.isArray(catProd.variants)) {
              const v = catProd.variants.find(va => va.id === item.variantId);
              if (v && v.price) authoritativeItemPrice = Number(v.price);
            }
          } else {
            // Fallback for custom or seasonal items
            authoritativeItemPrice = Math.max(100, Math.round(Number(item.price) || 0));
          }

          const rowTotal = authoritativeItemPrice * qty;
          authoritativeItemsSum += rowTotal;

          verifiedItems.push({
            id: item.id || 'custom',
            art: officialArt,
            name: sanitizeText(officialName),
            size: sanitizeText(item.size || 'M'),
            color: sanitizeText(item.color || 'Базовий'),
            quantity: qty,
            price: authoritativeItemPrice,
            total: rowTotal
          });
        }

        // Bespoke fee (+15% for custom measurements)
        const isBespoke = Boolean(orderData.isBespoke);
        const bespokeFee = isBespoke ? Math.round(authoritativeItemsSum * 0.15) : 0;
        const authoritativeTotal = authoritativeItemsSum + bespokeFee;

        // --- TAMPERING DETECTION (Burp Suite Check) ---
        // If client tampered with totalAmount or tried to pay 1 UAH
        if (orderData.totalAmount !== undefined && orderData.totalAmount !== null) {
          const clientTotal = Math.round(Number(orderData.totalAmount));
          if (Math.abs(clientTotal - authoritativeTotal) > 5) {
            console.warn(`[SECURITY ALERT - TAMPERING DETECTED] IP ${clientIP} tried to manipulate order sum! Client claimed ${clientTotal} ₴, but authoritative total is ${authoritativeTotal} ₴`);
            return sendJSON(res, 400, {
              success: false,
              error: 'Помилка валідації вартості: виявлено розбіжність цін у кошику. Дані було оновлено за офіційним тарифом.'
            });
          }
        }

        // Authoritative pay breakdown
        const paymentMethod = sanitizeText(orderData.paymentMethod || 'postpay');
        let authoritativePayNow = 300;
        if (paymentMethod.includes('online') || paymentMethod.includes('онлайн') || paymentMethod.includes('iban')) {
          authoritativePayNow = authoritativeTotal;
        } else if (paymentMethod.includes('split') || paymentMethod.includes('50/50')) {
          authoritativePayNow = Math.round(authoritativeTotal / 2);
        } else {
          authoritativePayNow = Math.min(300, authoritativeTotal);
        }
        const authoritativePayLater = Math.max(0, authoritativeTotal - authoritativePayNow);

        const orders = readJSON('orders.json', []);
        const orderId = orderData.orderId && /^BA-[0-9]{4,8}$/.test(orderData.orderId)
          ? orderData.orderId
          : 'BA-' + Math.floor(100000 + Math.random() * 900000);

        const newOrder = {
          id: orderId,
          createdAt: new Date().toISOString(),
          status: 'Прийнято в обробку (очікує дзвінка майстрині)',
          customer: {
            name: customerName,
            phone: customerPhone,
            instagram: sanitizeText(orderData.customerInstagram || ''),
            telegram: sanitizeText(orderData.customerTelegram || '')
          },
          measurements: {
            chest: sanitizeText(orderData.chest || ''),
            waist: sanitizeText(orderData.waist || ''),
            hips: sanitizeText(orderData.hips || ''),
            height: sanitizeText(orderData.height || ''),
            isBespoke
          },
          delivery: {
            method: sanitizeText(orderData.deliveryMethod || 'Нова Пошта'),
            city: sanitizeText(orderData.city || 'Київ'),
            branch: sanitizeText(orderData.branch || orderData.address || '')
          },
          payment: {
            method: paymentMethod,
            totalAmount: authoritativeTotal,
            payNow: authoritativePayNow,
            payLater: authoritativePayLater
          },
          comment: sanitizeText(orderData.comment || ''),
          items: verifiedItems,
          clientIP
        };

        orders.unshift(newOrder);
        writeJSON('orders.json', orders);

        // --- DISPATCH NOTIFICATION VIA SERVER TELEGRAM BOT ---
        const itemsList = verifiedItems.map((it, idx) =>
          `  <b>${idx + 1}. ${it.name}</b> (Арт. ${it.art})\n     • Розмір: <code>${it.size}</code> | Колір: ${it.color}\n     • Кількість: ${it.quantity} шт. × ${it.price.toLocaleString('uk-UA')} ₴ = <b>${it.total.toLocaleString('uk-UA')} ₴</b>`
        ).join('\n\n');

        const measurementsList = [
          newOrder.measurements.chest ? `ОГ: ${newOrder.measurements.chest} см` : null,
          newOrder.measurements.waist ? `ОТ: ${newOrder.measurements.waist} см` : null,
          newOrder.measurements.hips ? `ОБ: ${newOrder.measurements.hips} см` : null,
          newOrder.measurements.height ? `Зріст: ${newOrder.measurements.height} см` : null
        ].filter(Boolean).join(' | ');

        const tgOrderMsg = `🛍 <b>НОВЕ ЗАМОВЛЕННЯ #${newOrder.id}</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 <b>Клієнт:</b> ${newOrder.customer.name}\n` +
          `📞 <b>Телефон:</b> <code>${newOrder.customer.phone}</code>\n` +
          (newOrder.customer.instagram ? `✉️ <b>Instagram:</b> ${newOrder.customer.instagram}\n` : '') +
          (newOrder.customer.telegram ? `💬 <b>Telegram:</b> ${newOrder.customer.telegram}\n` : '') +
          (measurementsList ? `📏 <b>Мірки клієнта:</b> ${measurementsList}\n` : '') +
          `📍 <b>Доставка:</b> ${newOrder.delivery.method} (${newOrder.delivery.city}${newOrder.delivery.branch ? ', ' + newOrder.delivery.branch : ''})\n` +
          `💳 <b>Оплата:</b> ${newOrder.payment.method} (Передоплата: ${newOrder.payment.payNow} ₴)\n` +
          (newOrder.comment ? `📝 <b>Коментар:</b> ${newOrder.comment}\n` : '') +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📦 <b>Склад замовлення:</b>\n\n${itemsList}\n\n` +
          (isBespoke ? `🧵 <i>Індивідуальний пошив за мірками (+15%): +${bespokeFee.toLocaleString('uk-UA')} ₴</i>\n` : '') +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 <b>РАЗОМ ДО СПЛАТИ: ${authoritativeTotal.toLocaleString('uk-UA')} ₴</b>\n` +
          `🕒 <i>${new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}</i>`;

        // Send telegram message asynchronously without blocking the user
        sendTelegramMessage(tgOrderMsg).catch(e => console.error('Telegram notification error:', e));

        return sendJSON(res, 201, {
          success: true,
          orderId: newOrder.id,
          totalAmount: authoritativeTotal,
          payNow: authoritativePayNow,
          message: `Дякуємо, ${newOrder.customer.name}! Замовлення #${newOrder.id} успішно створено.`,
          order: newOrder
        });
      } catch (err) {
        return sendJSON(res, err.statusCode || 400, { success: false, error: err.message });
      }
    }

    // POST /api/fittings (Book Atelier Fitting)
    if (pathname === '/api/fittings' && method === 'POST') {
      const fitLimit = checkRateLimit(clientIP, 'fittings', 5, 600);
      if (!fitLimit.allowed) {
        return sendJSON(res, 429, { success: false, error: 'Забагато спроб запису на примірку. Спробуйте пізніше.' });
      }

      try {
        const body = await parseBody(req, 64 * 1024);
        const name = sanitizeText(body.name || body.customerName);
        const phone = sanitizeText(body.phone || body.customerPhone);
        const date = sanitizeText(body.date || '');

        if (!name || !phone) {
          return sendJSON(res, 400, { success: false, error: 'Ім\'я та телефон є обов\'язковими' });
        }

        const tgFitMsg = `👗 <b>ЗАПИС НА ПРИМІРКУ В КИЄВІ</b>\n\n` +
          `👤 <b>Клієнт:</b> ${name}\n` +
          `📞 <b>Телефон:</b> <code>${phone}</code>\n` +
          (date ? `📅 <b>Бажана дата/час:</b> ${date}\n` : '') +
          `🕒 <i>${new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}</i>`;

        sendTelegramMessage(tgFitMsg).catch(e => console.error(e));

        return sendJSON(res, 200, {
          success: true,
          message: 'Запис на індивідуальну примірку в київському ательє прийнято! Майстриня зв\'яжеться з вами для узгодження часу.'
        });
      } catch (err) {
        return sendJSON(res, 400, { success: false, error: err.message });
      }
    }

    // Unknown API endpoint
    return sendJSON(res, 404, { success: false, error: 'API endpoint не знайдено' });
  }

  // --- STATIC FILES ---
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`\n✨ Belle Atelier Haute Couture Platform Server is running!`);
  console.log(`📍 Local URL:    http://localhost:${PORT}`);
  console.log(`👗 Catalog:      http://localhost:${PORT}/catalog`);
  console.log(`✨ Product:      http://localhost:${PORT}/product/beregynya`);
  console.log(`🛍️ Cart:         http://localhost:${PORT}/cart`);
  console.log(`🔒 Admin:        http://localhost:${PORT}/admin.html\n`);
});
