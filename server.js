const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

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

function readJSON(file) {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8');
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res, pathname) {
  // Normalize pathname
  let filePath = pathname === '/' ? 'index.html' : pathname;
  if (filePath.startsWith('/')) filePath = filePath.slice(1);
  
  // Clean up clean routes: /catalog -> /catalog.html, /cart -> /cart.html, /product -> /product.html
  if (!path.extname(filePath)) {
    if (fs.existsSync(path.join(PUBLIC_DIR, filePath + '.html'))) {
      filePath += '.html';
    } else if (filePath.startsWith('product/')) {
      filePath = 'product.html';
    }
  }

  const fullPath = path.join(PUBLIC_DIR, filePath);

  // Security check: ensure path is within PUBLIC_DIR
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Return 404 with styled error or fallback to index.html
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>404 — Сторінку не знайдено</h1><p><a href="/">Повернутися на головну</a></p>');
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(fullPath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // --- API ROUTES ---
  if (pathname.startsWith('/api/')) {
    // 1. GET /api/products
    if (pathname === '/api/products' && method === 'GET') {
      const products = readJSON('products.json');
      const { category, search, minPrice, maxPrice, size } = parsedUrl.query;
      
      let filtered = products;
      if (category && category !== 'all') {
        filtered = filtered.filter(p => p.category === category);
      }
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(p => 
          p.name.toLowerCase().includes(q) || 
          p.art.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
        );
      }
      if (minPrice) filtered = filtered.filter(p => p.price >= Number(minPrice));
      if (maxPrice) filtered = filtered.filter(p => p.price <= Number(maxPrice));
      if (size) filtered = filtered.filter(p => p.sizes.includes(size));

      return sendJSON(res, 200, { success: true, count: filtered.length, products: filtered });
    }

    // 2. GET /api/products/:id
    if (pathname.startsWith('/api/products/') && method === 'GET') {
      const id = pathname.replace('/api/products/', '');
      const products = readJSON('products.json');
      const product = products.find(p => p.id === id);
      if (!product) {
        return sendJSON(res, 404, { success: false, error: 'Виріб не знайдено' });
      }
      return sendJSON(res, 200, { success: true, product });
    }

    // 3. POST /api/orders
    if (pathname === '/api/orders' && method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const orderData = JSON.parse(body);
          if (!orderData.customerName || !orderData.customerPhone) {
            return sendJSON(res, 400, { success: false, error: "ПІБ та телефон обов'язкові для зв'язку зі стилістом" });
          }

          const orders = readJSON('orders.json');
          const newOrder = {
            id: 'BA-' + Date.now().toString().slice(-6),
            createdAt: new Date().toISOString(),
            status: 'Прийнято в обробку (очікує дзвінка майстрині)',
            customer: {
              name: orderData.customerName,
              phone: orderData.customerPhone,
              instagram: orderData.customerInstagram || '',
              telegram: orderData.customerTelegram || ''
            },
            measurements: {
              chest: orderData.chest || null,
              waist: orderData.waist || null,
              hips: orderData.hips || null,
              height: orderData.height || null,
              isBespoke: Boolean(orderData.isBespoke)
            },
            delivery: {
              method: orderData.deliveryMethod || 'np-ua',
              city: orderData.city || 'Київ',
              branch: orderData.branch || ''
            },
            payment: {
              method: orderData.paymentMethod || 'postpay',
              totalAmount: orderData.totalAmount || 0,
              payNow: orderData.payNow || 300,
              payLater: orderData.payLater || 0
            },
            items: orderData.items || []
          };

          orders.unshift(newOrder);
          writeJSON('orders.json', orders);

          return sendJSON(res, 201, {
            success: true,
            orderId: newOrder.id,
            message: `Дякуємо, ${newOrder.customer.name}! Замовлення #${newOrder.id} успішно створено.`,
            order: newOrder
          });
        } catch (e) {
          return sendJSON(res, 400, { success: false, error: 'Некоректний формат JSON' });
        }
      });
      return;
    }

    // 4. POST /api/fittings
    if (pathname === '/api/fittings' && method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const fittingData = JSON.parse(body);
          return sendJSON(res, 200, {
            success: true,
            message: 'Запис на індивідуальну примірку в київському ательє прийнято! Стиліст зв\'яжеться з вами для підтвердження часу.'
          });
        } catch (e) {
          return sendJSON(res, 400, { success: false, error: 'Помилка даних' });
        }
      });
      return;
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
  console.log(`🛍️ Cart:         http://localhost:${PORT}/cart\n`);
});
