// Cloudflare Pages Advanced Mode Worker for Belle Atelier
// Real-time synchronization across Mobile, Desktop, and all visitors via Cloudflare KV

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8'
};

const DEFAULT_CATEGORIES = [
  { id: 'women', name: 'Жіночий одяг', icon: 'checkroom', order: 1 },
  { id: 'men', name: 'Чоловічий одяг', icon: 'styler', order: 2 },
  { id: 'sets', name: 'Парні комплекти', icon: 'favorite', order: 3 },
  { id: 'accessories', name: 'Аксесуари', icon: 'straighten', order: 4 },
  { id: 'souvenirs', name: 'Сувеніри', icon: 'card_giftcard', order: 5 },
  { id: 'sale', name: 'SALE', icon: 'local_offer', order: 6, isSale: true }
];

const TELEGRAM_CONFIG = {
  botToken: '8682075215:AAEfRKiuZo443UCaZop9I3CPrGGSKGM2IEs',
  chatId: '-5522138796',
  isActive: true
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendTelegramNotification(text) {
  try {
    const payload = JSON.stringify({
      chat_id: TELEGRAM_CONFIG.chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_CONFIG.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: payload
    });
    return res.ok;
  } catch (err) {
    console.error('Telegram dispatch error:', err);
    return false;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // 2. Handle API routes
    if (url.pathname.startsWith('/api/')) {
      const kv = env.BELLE_KV;

      // GET /api/categories
      if (url.pathname === '/api/categories' && request.method === 'GET') {
        let cats = null;
        if (kv) {
          try {
            const stored = await kv.get('belle_categories', 'json');
            if (Array.isArray(stored) && stored.length > 0) {
              cats = stored;
            }
          } catch(e) {}
        }
        if (!cats) {
          try {
            const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/categories.json', request.url)));
            if (assetRes.ok) {
              cats = await assetRes.json();
            }
          } catch(e) {}
        }
        return jsonResponse({ success: true, categories: cats || DEFAULT_CATEGORIES });
      }

      // POST /api/categories
      if (url.pathname === '/api/categories' && request.method === 'POST') {
        const body = await request.json().catch(() => null);
        if (Array.isArray(body)) {
          if (kv) await kv.put('belle_categories', JSON.stringify(body));
          return jsonResponse({ success: true, categories: body });
        }
        return jsonResponse({ success: false, error: 'Invalid categories array' }, 400);
      }

      // GET /api/settings
      if (url.pathname === '/api/settings' && request.method === 'GET') {
        let settings = null;
        if (kv) {
          try {
            const stored = await kv.get('belle_site_texts', 'json');
            if (stored && typeof stored === 'object' && Object.keys(stored).length > 0) {
              settings = stored;
            }
          } catch(e) {}
        }
        if (!settings) {
          try {
            const assetRes = await env.ASSETS.fetch(new Request(new URL('/data/settings.json', request.url)));
            if (assetRes.ok) {
              settings = await assetRes.json();
            }
          } catch(e) {}
        }
        return jsonResponse({ success: true, settings: settings || {} });
      }

      // POST /api/settings
      if (url.pathname === '/api/settings' && request.method === 'POST') {
        const body = await request.json().catch(() => null);
        if (body && typeof body === 'object') {
          if (kv) await kv.put('belle_site_texts', JSON.stringify(body));
          return jsonResponse({ success: true, settings: body });
        }
        return jsonResponse({ success: false, error: 'Invalid settings' }, 400);
      }

      // GET /api/size-chart
      if (url.pathname === '/api/size-chart' && request.method === 'GET') {
        let images = ['/images/size_chart_1.jpg', '/images/size_chart_2.jpg'];
        if (kv) {
          try {
            const stored = await kv.get('belle_size_chart_images', 'json');
            if (Array.isArray(stored) && stored.length > 0) images = stored;
          } catch(e) {}
        }
        return jsonResponse({ success: true, images });
      }

      // POST /api/size-chart
      if (url.pathname === '/api/size-chart' && request.method === 'POST') {
        const body = await request.json().catch(() => null);
        if (Array.isArray(body)) {
          if (kv) await kv.put('belle_size_chart_images', JSON.stringify(body));
          return jsonResponse({ success: true, images: body });
        }
        return jsonResponse({ success: false, error: 'Invalid images array' }, 400);
      }

      // GET /api/products
      if (url.pathname === '/api/products' && request.method === 'GET') {
        let products = null;
        if (kv) {
          try {
            products = await kv.get('belle_products', 'json');
          } catch(e) {}
        }

        if (!Array.isArray(products) || products.length === 0) {
          try {
            const staticAssetRes = await env.ASSETS.fetch(new Request(new URL('/data/products.json', request.url)));
            if (staticAssetRes.ok) {
              products = await staticAssetRes.json();
              if (kv && Array.isArray(products) && products.length > 0) {
                await kv.put('belle_products', JSON.stringify(products));
              }
            }
          } catch(e) {}
        }

        return jsonResponse({ success: true, products: Array.isArray(products) ? products : [] });
      }

      // POST /api/products (Create Product)
      if (url.pathname === '/api/products' && request.method === 'POST') {
        const newProduct = await request.json().catch(() => null);
        if (!newProduct || !newProduct.name) {
          return jsonResponse({ success: false, error: 'Product name is required' }, 400);
        }

        let products = [];
        if (kv) {
          try {
            const stored = await kv.get('belle_products', 'json');
            if (Array.isArray(stored)) products = stored;
          } catch(e) {}
        }

        if (products.length === 0) {
          try {
            const staticAssetRes = await env.ASSETS.fetch(new Request(new URL('/data/products.json', request.url)));
            if (staticAssetRes.ok) products = await staticAssetRes.json();
          } catch(e) {}
        }

        newProduct.id = newProduct.id || 'prod_' + Date.now();
        newProduct.updatedAt = Date.now();
        products.unshift(newProduct);

        if (kv) await kv.put('belle_products', JSON.stringify(products));
        return jsonResponse({ success: true, product: newProduct });
      }

      // GET /api/products/:id
      if (url.pathname.startsWith('/api/products/') && request.method === 'GET') {
        const id = url.pathname.replace('/api/products/', '');
        let products = [];
        if (kv) {
          try {
            const stored = await kv.get('belle_products', 'json');
            if (Array.isArray(stored)) products = stored;
          } catch(e) {}
        }
        const p = products.find(x => x.id === id);
        if (p) return jsonResponse({ success: true, product: p });
        return jsonResponse({ success: false, error: 'Product not found' }, 404);
      }

      // PUT /api/products/:id
      if (url.pathname.startsWith('/api/products/') && request.method === 'PUT') {
        const id = url.pathname.replace('/api/products/', '');
        const updateData = await request.json().catch(() => null);
        if (!updateData) return jsonResponse({ success: false, error: 'No update data' }, 400);

        let products = [];
        if (kv) {
          try {
            const stored = await kv.get('belle_products', 'json');
            if (Array.isArray(stored)) products = stored;
          } catch(e) {}
        }

        const idx = products.findIndex(x => x.id === id);
        if (idx > -1) {
          products[idx] = {
            ...products[idx],
            ...updateData,
            id,
            updatedAt: Date.now()
          };
        } else {
          updateData.id = id;
          updateData.updatedAt = Date.now();
          products.unshift(updateData);
        }

        if (kv) await kv.put('belle_products', JSON.stringify(products));
        return jsonResponse({ success: true, product: products[idx > -1 ? idx : 0] });
      }

      // DELETE /api/products/:id
      if (url.pathname.startsWith('/api/products/') && request.method === 'DELETE') {
        const id = url.pathname.replace('/api/products/', '');
        let products = [];
        if (kv) {
          try {
            const stored = await kv.get('belle_products', 'json');
            if (Array.isArray(stored)) products = stored;
          } catch(e) {}
        }

        products = products.filter(x => x.id !== id);
        if (kv) await kv.put('belle_products', JSON.stringify(products));
        return jsonResponse({ success: true, id });
      }

      // GET /api/orders
      if (url.pathname === '/api/orders' && request.method === 'GET') {
        let orders = [];
        if (kv) {
          try {
            const stored = await kv.get('belle_orders', 'json');
            if (Array.isArray(stored)) orders = stored;
          } catch(e) {}
        }
        return jsonResponse({ success: true, orders });
      }

      // POST /api/orders
      if (url.pathname === '/api/orders' && request.method === 'POST') {
        const orderData = await request.json().catch(() => null);
        if (!orderData) return jsonResponse({ success: false, error: 'Invalid order' }, 400);

        let orders = [];
        if (kv) {
          try {
            const stored = await kv.get('belle_orders', 'json');
            if (Array.isArray(stored)) orders = stored;
          } catch(e) {}
        }

        const orderId = orderData.id || 'BA-' + Math.floor(100000 + Math.random() * 900000);
        orderData.id = orderId;
        orderData.createdAt = new Date().toISOString();
        orderData.status = orderData.status || 'Прийнято в обробку (очікує дзвінка майстрині)';

        orders.unshift(orderData);
        if (kv) await kv.put('belle_orders', JSON.stringify(orders));

        // Format and send Telegram alert
        const items = Array.isArray(orderData.items) ? orderData.items : [];
        const itemsList = items.map((it, idx) => {
          let mStr = '';
          if (it.measurements) {
            const parts = [
              it.measurements.chest ? `ОГ: ${it.measurements.chest} см` : null,
              it.measurements.waist ? `ОТ: ${it.measurements.waist} см` : null,
              it.measurements.hips ? `ОБ: ${it.measurements.hips} см` : null,
              it.measurements.height ? `Зріст: ${it.measurements.height} см` : null,
              it.measurements.note ? `Побажання: ${it.measurements.note}` : null
            ].filter(Boolean);
            if (parts.length > 0) {
              mStr = `\n     📏 <i>Мірки для цієї моделі:</i> ${parts.join(', ')}`;
            }
          }
          return `  <b>${idx + 1}. ${escapeHTML(it.name)}</b> (Арт. ${escapeHTML(it.art || 'BL-000')})\n     • Розмір: <code>${escapeHTML(it.size || 'M')}</code> | Колір: ${escapeHTML(it.color || 'Базовий')}\n     • Кількість: ${it.quantity} шт. × ${(Number(it.price) || 0).toLocaleString('uk-UA')} ₴ = <b>${((Number(it.price) || 0) * (Number(it.quantity) || 1)).toLocaleString('uk-UA')} ₴</b>${mStr}`;
        }).join('\n\n');

        const cust = orderData.customer || {};
        const deliv = orderData.delivery || {};
        const pay = orderData.payment || {};

        const tgMessage = 
          `🌸 <b>НОВЕ ЗАМОВЛЕННЯ З САЙТУ #${orderId}</b> 🌸\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `👤 <b>Клієнт:</b> ${escapeHTML(cust.name || 'Не вказано')}\n` +
          `📞 <b>Телефон:</b> <code>${escapeHTML(cust.phone || '')}</code>\n` +
          (cust.instagram ? `✉️ <b>Instagram:</b> ${escapeHTML(cust.instagram)}\n` : '') +
          (cust.telegram ? `💬 <b>Telegram:</b> ${escapeHTML(cust.telegram)}\n` : '') +
          `📍 <b>Доставка:</b> ${escapeHTML(deliv.method || 'Самовивіз')} (${escapeHTML(deliv.city || '')}${deliv.branch ? ', ' + escapeHTML(deliv.branch) : ''})\n` +
          `💳 <b>Оплата:</b> ${escapeHTML(pay.method || 'Післяплата')} (Передоплата: ${pay.payNow || 0} ₴, До сплати: ${pay.payLater || 0} ₴)\n` +
          (orderData.comment ? `📝 <b>Коментар:</b> ${escapeHTML(orderData.comment)}\n` : '') +
          `━━━━━━━━━━━━━━━━━━\n` +
          `🛍 <b>ЗАМОВЛЕНІ ПОЗИЦІЇ:</b>\n\n${itemsList}\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `💰 <b>ЗАГАЛЬНА СУМА:</b> <b>${(Number(pay.totalAmount) || 0).toLocaleString('uk-UA')} ₴</b>\n` +
          `📅 <i>${new Date().toLocaleString('uk-UA')}</i>`;

        ctx.waitUntil(sendTelegramNotification(tgMessage));

        return jsonResponse({ success: true, orderId: orderData.id });
      }

      // Default 404 for unknown api
      return jsonResponse({ success: false, error: 'Endpoint not found' }, 404);
    }

    // 3. Static Assets fetch
    return env.ASSETS.fetch(request);
  }
};
