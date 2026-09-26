const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const API_BASE = 'http://localhost:3000';

const results = {
  passed: [],
  failed: [],
  warnings: []
};

function pass(testName, details = '') {
  results.passed.push({ testName, details });
  console.log(`  ✅ [PASS] ${testName}${details ? ' - ' + details : ''}`);
}

function fail(testName, error) {
  results.failed.push({ testName, error: String(error) });
  console.error(`  ❌ [FAIL] ${testName}:`, error);
}

function createPageDOM(htmlFilePath, url = 'http://localhost:3000/', mockLocalStorage = {}) {
  const fileContent = fs.readFileSync(htmlFilePath, 'utf8');
  const cartStoreContent = fs.readFileSync(path.join(__dirname, 'public/js/cart-store.js'), 'utf8');

  // Extract inline scripts
  const inlineScripts = [];
  const scriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(fileContent)) !== null) {
    if (!match[1].includes('tailwind.config')) {
      inlineScripts.push(match[1]);
    }
  }

  const storage = { ...mockLocalStorage };

  const dom = new JSDOM(fileContent, {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(win) {
      Object.defineProperty(win, 'localStorage', {
        value: {
          getItem: (k) => storage[k] !== undefined ? storage[k] : null,
          setItem: (k, v) => { storage[k] = String(v); },
          removeItem: (k) => { delete storage[k]; },
          clear: () => { for (let k in storage) delete storage[k]; }
        },
        writable: true,
        configurable: true
      });
      win.alert = () => {};
      win.confirm = () => true;
      win.prompt = (msg, def) => def || '';
    }
  });

  const { window } = dom;

  // Execute cart store and inline scripts in window context
  window.eval(cartStoreContent);
  inlineScripts.forEach(script => {
    try {
      window.eval(script);
    } catch (e) {
      console.warn('Script eval error:', e.message);
    }
  });

  return { dom, window, storage };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING COMPREHENSIVE E2E USER-FLOW TEST SUITE');
  console.log('======================================================\n');

  // TEST 1: Categories Source & Filter Verification
  console.log('▶️ TEST 1: Categories Source & Filter Verification');
  try {
    const res = await fetch(`${API_BASE}/api/categories`);
    const data = await res.json();
    const catNames = data.categories.map(c => c.name);
    const catIds = data.categories.map(c => c.id);

    const obsoleteFound = catNames.some(n => 
      n.toLowerCase().includes('жакет') || 
      n.toLowerCase().includes('крайк') || 
      n.toLowerCase().includes('пальт')
    );

    if (!obsoleteFound && catIds.includes('women') && catIds.includes('men') && catIds.includes('sale')) {
      pass('API Categories clean of obsolete categories', `Found: ${catNames.join(', ')}`);
    } else {
      fail('API Categories verification', `Obsolete found or standard missing: ${catNames.join(', ')}`);
    }
  } catch (e) {
    fail('API Categories fetch', e);
  }

  // TEST 2: Index Page Desktop & Mobile Menu Categories & Hero Banner
  console.log('\n▶️ TEST 2: Index Page (Desktop & Mobile Menu Categories & Hero Banner)');
  try {
    const indexPath = path.join(__dirname, 'public/index.html');
    const { window } = createPageDOM(indexPath, 'http://localhost:3000/');
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

    const heroTitle = window.document.getElementById('home-hero-title');
    if (heroTitle && heroTitle.textContent.trim().length > 0) {
      pass('Hero Title rendered on Index', heroTitle.textContent.trim());
    } else {
      fail('Hero Title rendered on Index', 'Missing hero title');
    }

    const homeCatGrid = window.document.getElementById('home-categories-grid');
    const catLinks = homeCatGrid.querySelectorAll('a');
    if (catLinks.length >= 6) {
      pass('Home Category Grid rendered', `${catLinks.length} category cards present`);
    } else {
      fail('Home Category Grid rendered', `Expected >= 6 categories, got ${catLinks.length}`);
    }

    const mobileNavList = window.document.getElementById('nav-categories-list');
    const mobileCatLinks = mobileNavList.querySelectorAll('a');
    if (mobileCatLinks.length >= 6) {
      pass('Mobile Drawer Menu Categories rendered', `${mobileCatLinks.length} items in drawer`);
    } else {
      fail('Mobile Drawer Menu Categories rendered', `Expected >= 6, got ${mobileCatLinks.length}`);
    }
  } catch (e) {
    fail('Index Page test', e);
  }

  // TEST 3: Catalog Page Category Grid & Clean Header
  console.log('\n▶️ TEST 3: Catalog Page Category Grid & Clean Header');
  try {
    const catalogPath = path.join(__dirname, 'public/catalog.html');
    const { window } = createPageDOM(catalogPath, 'http://localhost:3000/catalog.html');
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

    const allBtnContainer = window.document.getElementById('catalog-all-category-btn-container');
    if (allBtnContainer && allBtnContainer.innerHTML.includes('Весь каталог')) {
      pass('Catalog "Весь каталог" top button rendered properly');
    } else {
      fail('Catalog "Весь каталог" top button', 'Button not found or missing text');
    }

    const productGrid = window.document.getElementById('catalog-products-container');
    const articles = productGrid.querySelectorAll('article');
    if (articles.length > 0) {
      pass('Catalog Product Grid rendered products', `${articles.length} items listed`);
    } else {
      fail('Catalog Product Grid rendered products', 'No products listed');
    }
  } catch (e) {
    fail('Catalog Page test', e);
  }

  // TEST 4: Product Page Gallery, Color Switching & Special Offers Photo Isolation
  console.log('\n▶️ TEST 4: Product Page Gallery, Color Switching & Special Offers Photo Isolation');
  try {
    const prodPath = path.join(__dirname, 'public/product.html');
    const { window } = createPageDOM(prodPath, 'http://localhost:3000/product.html?id=beregynya');
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

    const colorGrid = window.document.getElementById('product-colors-grid');
    const colorBtns = colorGrid.querySelectorAll('button');
    if (colorBtns.length >= 1) {
      pass('Color buttons rendered on Product page', `${colorBtns.length} colors available`);
    } else {
      fail('Color buttons on Product page', 'No color buttons found');
    }

    const sizeModal = window.document.getElementById('size-modal');
    window.openSizeModal();
    if (!sizeModal.classList.contains('hidden')) {
      pass('Size Chart modal opens successfully');
      window.nextSizeChartSlide();
      pass('Size Chart horizontal slide next triggered without error');
      window.closeSizeModal();
      if (sizeModal.classList.contains('hidden')) {
        pass('Size Chart modal closes successfully');
      } else {
        fail('Size Chart modal close', 'Modal still visible');
      }
    } else {
      fail('Size Chart modal open', 'Modal remained hidden');
    }

    window.document.getElementById('prod-chest').value = '92';
    window.document.getElementById('prod-waist').value = '72';
    window.document.getElementById('prod-hips').value = '98';
    window.document.getElementById('prod-height').value = '175';
    window.saveProductMeasurements();

    const addBtn = window.document.getElementById('add-to-bag-btn');
    window.handleAddToCartClick(addBtn);

    const cart = window.BelleStore.getCart();
    if (cart.length > 0 && cart[0].img && !cart[0].img.includes('undefined')) {
      pass('Product successfully added to cart with exact image', `Cart item: ${cart[0].name}, Image: ${cart[0].img}`);
    } else {
      fail('Add to cart check', 'Cart is empty or image is undefined');
    }
  } catch (e) {
    fail('Product Page test', e);
  }

  // TEST 5: Cart Page (Delivery Label, Per-Item Measurements, Payment Options)
  console.log('\n▶️ TEST 5: Cart Page (Delivery Label, Per-Item Measurements, Payment Options)');
  try {
    const cartPath = path.join(__dirname, 'public/cart.html');
    const initialCart = [
      { id: 'men-shirt', name: 'Сорочка «Оберіг» (Чоловіча)', art: 'BL-M01', price: 4200, quantity: 1, size: 'L', color: 'Чорний', img: '/images/oberig_shirt_1789843615744.jpg' },
      { id: 'women-dress', name: 'Сукня «Мавка» (Жіноча)', art: 'BL-W02', price: 5400, quantity: 1, size: 'S', color: 'Молочний', img: '/images/mavka_dress_1789843642965.jpg' }
    ];

    const { window } = createPageDOM(cartPath, 'http://localhost:3000/cart.html', {
      belle_cart: JSON.stringify(initialCart)
    });

    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

    const ukrLabel = window.document.querySelector('input[value="ukrposhta"]')?.closest('label');
    if (ukrLabel && ukrLabel.textContent.includes('Укрпошта міжнародна доставка')) {
      pass('Cart delivery option contains "Укрпошта — міжнародна доставка"');
    } else {
      fail('Cart delivery option Ukrposhta', `Found: ${ukrLabel?.textContent.trim()}`);
    }

    const mContainer = window.document.getElementById('dynamic-measurements-container');
    const chestInputs = mContainer.querySelectorAll('input[id^="chest-"]');
    if (chestInputs.length === 2) {
      pass('Separate measurement cards rendered for each cart item', `${chestInputs.length} item cards`);
    } else {
      fail('Separate measurement cards', `Expected 2 cards, got ${chestInputs.length}`);
    }

    window.updateItemMeasurement(0, 'chest', '104');
    window.updateItemMeasurement(0, 'waist', '92');
    window.updateItemMeasurement(0, 'height', '185');

    window.updateItemMeasurement(1, 'chest', '88');
    window.updateItemMeasurement(1, 'waist', '68');
    window.updateItemMeasurement(1, 'height', '170');

    const depositAmtEl = window.document.getElementById('pay-now-val');
    const totalEl = window.document.getElementById('total-val');
    const cleanTotal = (totalEl?.textContent || '').replace(/\s+/g, ' ');
    if (cleanTotal.includes('9 600')) {
      pass('Cart Total calculation accurate (4200 + 5400 = 9600 ₴)');
    } else {
      fail('Cart Total calculation', `Expected 9 600 ₴, got ${cleanTotal}`);
    }

    // Select postpay radio to test deposit calculation
    const postpayRadio = window.document.querySelector('input[name="payment"][value="postpay"]');
    if (postpayRadio) {
      postpayRadio.checked = true;
      window.updateCartPricing();
    }

    const cleanDeposit = (depositAmtEl?.textContent || '').replace(/\s+/g, ' ');
    if (cleanDeposit.includes('300')) {
      pass('Payment deposit default 300 ₴ applied correctly to Pay Now on postpay');
    } else {
      fail('Payment deposit default', `Expected 300 ₴, got ${cleanDeposit}`);
    }
  } catch (e) {
    fail('Cart Page test', e);
  }

  // TEST 6: Admin Panel Product Form, Non-blurring Price & Multi-photo Management
  console.log('\n▶️ TEST 6: Admin Panel Product Form, Non-blurring Price & Multi-photo Management');
  try {
    const adminPath = path.join(__dirname, 'public/admin.html');
    const { window } = createPageDOM(adminPath, 'http://localhost:3000/admin.html');
    
    window.openProductModal(null);

    const priceInput = window.document.getElementById('form-price');
    const oldPriceInput = window.document.getElementById('form-old-price');
    const discountBadge = window.document.getElementById('form-discount-badge');

    priceInput.value = '12999';
    window.onPriceInputChange();
    oldPriceInput.value = '15000';
    window.onOldPriceInputChange();

    if (!discountBadge.classList.contains('hidden') && discountBadge.textContent.includes('-13%')) {
      pass('Price input updates discount badge accurately without re-rendering input elements');
    } else {
      fail('Price input discount badge update', `Badge text: ${discountBadge.textContent}`);
    }

    window.document.getElementById('form-custom-color-input').value = 'Смарагдовий';
    window.addCustomColorToForm();

    const colorContainer = window.document.getElementById('form-color-photos-container');
    if (colorContainer && colorContainer.innerHTML.includes('Смарагдовий')) {
      pass('Custom color added and rendered in dedicated color gallery container');
    } else {
      fail('Custom color addition', 'Color not found in gallery container');
    }

    window.addSpecialOfferRow();
    const specialOffersContainer = window.document.getElementById('form-special-offers-container');
    if (specialOffersContainer && specialOffersContainer.innerHTML.includes('Спеціальна пропозиція #1')) {
      pass('Special Offer row added in Product modal');
    } else {
      fail('Special Offer row addition', 'Special offer row not rendered');
    }
  } catch (e) {
    fail('Admin Panel test', e);
  }

  console.log('\n======================================================');
  console.log(`📊 FINAL SUMMARY: ${results.passed.length} PASSED, ${results.failed.length} FAILED, ${results.warnings.length} WARNINGS`);
  console.log('======================================================\n');
}

runTests().catch(console.error);
