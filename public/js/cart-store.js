// Belle Atelier - Core Client Store & Admin Management
const DEFAULT_PRODUCTS = [
  {
    id: 'beregynya',
    art: 'BL-402',
    name: 'Сукня «Берегиня»',
    cat: 'women',
    price: 4800,
    oldPrice: null,
    sale: null,
    inStock: true,
    isArchived: false,
    fabric: "100% пом'якшений льон",
    description: "Монохромна борщівська техніка, оздоблена витонченим мереживом ручного плетіння. Вільний автентичний силует з пишними рукавами-бохо.",
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'Індивідуальні мірки'],
    colors: ['Молочний / Сирий льон', 'Глибокий бордо', 'Графіт'],
    img: '/images/berehynia_dress_1789843600634.jpg'
  },
  {
    id: 'oberig',
    art: 'BL-108',
    name: 'Сорочка «Оберіг»',
    cat: 'men',
    price: 3950,
    oldPrice: 4800,
    sale: 'SALE −22%',
    inStock: true,
    isArchived: false,
    fabric: "Органічний преміум-льон",
    description: "Класична аристократична сорочка з вишуканою геометричною вишивкою коміра-стійки та манжетів.",
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colors: ['Графітово-чорний', 'Молочний льон'],
    img: '/images/oberig_shirt_1789843615744.jpg'
  },
  {
    id: 'hetmansky',
    art: 'BL-512',
    name: 'Жакет «Гетьманський»',
    cat: 'women',
    price: 5400,
    oldPrice: null,
    sale: null,
    inStock: true,
    isArchived: false,
    fabric: "Шляхетна шерсть та оксамит",
    description: "Шляхетний жакет з оксамитовими манжетами та золотавим сутажем за лекалами козацької старшини.",
    sizes: ['XS', 'S', 'M'],
    colors: ['Глибокий чорний', 'Королівський синій'],
    img: '/images/hetman_jacket_1789843629464.jpg'
  },
  {
    id: 'mavka',
    art: 'BL-304',
    name: 'Сукня «Мавка»',
    cat: 'women',
    price: 4500,
    oldPrice: 5800,
    sale: 'SALE −22%',
    inStock: true,
    isArchived: false,
    fabric: "Шовк та льон",
    description: "Летюча смарагдова сукня з шовковими вставками та золотавою вишивкою лісових мотивів живої природи.",
    sizes: ['S', 'M', 'L'],
    colors: ['Смарагд', 'Шавлія'],
    img: '/images/mavka_dress_1789843642965.jpg'
  },
  {
    id: 'podillya',
    art: 'BL-210',
    name: 'Корсет «Поділля»',
    cat: 'accessories',
    price: 3900,
    oldPrice: null,
    sale: null,
    inStock: true,
    isArchived: false,
    fabric: "Оксамит & Металеві кісточки",
    description: "Ідеальна підтримка стану, регульована шовкова шнурівка та рельєфна гладь подільських квітів.",
    sizes: ['XS', 'S', 'M', 'L'],
    colors: ['Чорний оксамит', 'Бордо'],
    img: '/images/podillya_corset_1789843684134.jpg'
  },
  {
    id: 'dzherelo',
    art: 'BL-770',
    name: 'Сет «Джерело Життя»',
    cat: 'sets',
    price: 8900,
    oldPrice: null,
    sale: null,
    inStock: true,
    isArchived: false,
    fabric: "100% пом'якшений льон",
    description: "Гармонійний дует чоловічої сорочки та вишуканої сукні для весілля, вінчання або родинних свят.",
    sizes: ['S / M', 'M / L', 'Індивідуальні мірки'],
    colors: ['Молочний льон'],
    img: '/images/dzherelo_set_1789843655280.jpg'
  },
  {
    id: 'zorya',
    art: 'BL-215',
    name: 'Туніка «Зоря»',
    cat: 'women',
    price: 3600,
    oldPrice: null,
    sale: null,
    inStock: true,
    isArchived: false,
    fabric: "Пом'якшений варений льон",
    description: "Полегшена літня туніка з контрастною синьо-теракотовою вишивкою та розрізами з боків.",
    sizes: ['One Size (XS-L)'],
    colors: ['Пісочний', 'Волошковий'],
    img: '/images/zorya_tunic_1789843670230.jpg'
  },
  {
    id: 'polissya',
    art: 'BL-408',
    name: 'Сукня «Полісся»',
    cat: 'women',
    price: 5200,
    oldPrice: null,
    sale: null,
    inStock: true,
    isArchived: false,
    fabric: "100% пом'якшений льон",
    description: "Вишукана сукня глибокого відтінку з поліськими геометричними мотивами.",
    sizes: ['XS', 'S', 'M', 'L'],
    colors: ['Молочний льон', 'Графіт'],
    img: '/images/berehynia_back_1789843731157.jpg'
  }
];

const BelleStore = {
  // --- PRODUCTS CRUD ---
  getProducts() {
    try {
      const stored = localStorage.getItem('belle_products');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error reading products:', e);
    }
    // Initialize if first time
    this.saveProducts(DEFAULT_PRODUCTS);
    return DEFAULT_PRODUCTS;
  },

  getActiveProducts() {
    return this.getProducts().filter(p => !p.isArchived);
  },

  saveProducts(products) {
    try {
      localStorage.setItem('belle_products', JSON.stringify(products));
      window.dispatchEvent(new Event('belle-products-updated'));
    } catch (e) {
      console.error('Error saving products:', e);
    }
  },

  addProduct(productData) {
    const products = this.getProducts();
    const newProduct = {
      id: productData.id || 'prod_' + Date.now(),
      art: productData.art || 'BL-' + Math.floor(100 + Math.random() * 900),
      name: productData.name,
      cat: productData.cat || 'dresses',
      price: Number(productData.price) || 0,
      oldPrice: productData.oldPrice ? Number(productData.oldPrice) : null,
      sale: productData.sale || (productData.oldPrice ? `SALE −${Math.round((1 - productData.price/productData.oldPrice)*100)}%` : null),
      inStock: productData.inStock !== false,
      isArchived: false,
      fabric: productData.fabric || "100% пом'якшений льон",
      description: productData.description || "",
      sizes: Array.isArray(productData.sizes) ? productData.sizes : ['XS', 'S', 'M', 'L', 'XL'],
      colors: Array.isArray(productData.colors) && productData.colors.length > 0 ? productData.colors : ['Молочний'],
      variants: Array.isArray(productData.variants) ? productData.variants : [],
      img: productData.img || '/images/berehynia_dress_1789843600634.jpg'
    };
    products.unshift(newProduct);
    this.saveProducts(products);
    this.showToast(`Виріб «${newProduct.name}» успішно додано! ✨`);
    return newProduct;
  },

  updateProduct(id, updatedFields) {
    const products = this.getProducts();
    const index = products.findIndex(p => p.id === id);
    if (index > -1) {
      products[index] = { ...products[index], ...updatedFields };
      if (updatedFields.price !== undefined || updatedFields.oldPrice !== undefined) {
        if (products[index].oldPrice && products[index].oldPrice > products[index].price) {
          products[index].sale = `SALE −${Math.round((1 - products[index].price/products[index].oldPrice)*100)}%`;
        } else {
          products[index].sale = null;
        }
      }
      this.saveProducts(products);
      this.showToast(`Виріб «${products[index].name}» оновлено!`);
      return products[index];
    }
    return null;
  },

  toggleArchiveProduct(id) {
    const products = this.getProducts();
    const item = products.find(p => p.id === id);
    if (item) {
      item.isArchived = !item.isArchived;
      this.saveProducts(products);
      this.showToast(item.isArchived ? `«${item.name}» переміщено в архів` : `«${item.name}» повернено з архіву`);
      return item;
    }
    return null;
  },

  deleteProduct(id) {
    let products = this.getProducts();
    const item = products.find(p => p.id === id);
    products = products.filter(p => p.id !== id);
    this.saveProducts(products);
    this.showToast(`Виріб видалено`);
    return item;
  },

  resetDefaultProducts() {
    this.saveProducts(DEFAULT_PRODUCTS);
    this.showToast('Каталог скинуто до початкового стану');
  },

  // --- CATEGORIES CRUD ---
  getCategories() {
    const DEFAULT_CATEGORIES = [
      { id: 'women', name: 'Жіночий одяг', icon: 'checkroom', order: 1 },
      { id: 'men', name: 'Чоловічий одяг', icon: 'styler', order: 2 },
      { id: 'sets', name: 'Парні комплекти', icon: 'favorite', order: 3 },
      { id: 'accessories', name: 'Аксесуари', icon: 'straighten', order: 4 },
      { id: 'souvenirs', name: 'Сувеніри', icon: 'card_giftcard', order: 5 },
      { id: 'sale', name: 'SALE', icon: 'local_offer', order: 6, isSale: true }
    ];
    try {
      const stored = localStorage.getItem('belle_categories');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error reading categories:', e);
    }
    this.saveCategories(DEFAULT_CATEGORIES);
    return DEFAULT_CATEGORIES;
  },

  saveCategories(categories) {
    try {
      localStorage.setItem('belle_categories', JSON.stringify(categories));
      window.dispatchEvent(new Event('belle-categories-updated'));
    } catch (e) {
      console.error('Error saving categories:', e);
    }
  },

  addCategory(data) {
    const categories = this.getCategories();
    // Generate id slug from name or custom id
    let id = (data.id || data.name.toLowerCase().replace(/[^a-z0-9а-яіїєґ]/gi, '-')).toLowerCase().trim();
    if (!id || categories.some(c => c.id === id)) {
      id = 'cat_' + Date.now();
    }
    const newCat = {
      id: id,
      name: data.name.trim(),
      icon: data.icon || 'folder',
      order: categories.length + 1
    };
    categories.push(newCat);
    this.saveCategories(categories);
    this.showToast(`Категорію «${newCat.name}» додано! ✨`);
    return newCat;
  },

  updateCategory(id, updatedFields) {
    const categories = this.getCategories();
    const index = categories.findIndex(c => c.id === id);
    if (index > -1) {
      categories[index] = { ...categories[index], ...updatedFields };
      this.saveCategories(categories);
      this.showToast(`Категорію «${categories[index].name}» оновлено!`);
      return categories[index];
    }
    return null;
  },

  deleteCategory(id) {
    let categories = this.getCategories();
    const item = categories.find(c => c.id === id);
    categories = categories.filter(c => c.id !== id);
    this.saveCategories(categories);
    this.showToast(`Категорію «${item ? item.name : id}» видалено`);
    return item;
  },

  resetDefaultCategories() {
    localStorage.removeItem('belle_categories');
    const cats = this.getCategories();
    this.showToast('Категорії скинуто до стандартних');
    return cats;
  },

  // --- SIZE GUIDE / CHART IMAGES ---
  getSizeChartImages() {
    try {
      const stored = localStorage.getItem('belle_size_chart_images');
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr) && arr.length > 0) return arr;
      }
    } catch (e) {
      console.error('Error reading size chart images:', e);
    }
    return [
      '/images/size_chart_1.jpg',
      '/images/size_chart_2.jpg'
    ];
  },

  saveSizeChartImages(images) {
    try {
      localStorage.setItem('belle_size_chart_images', JSON.stringify(images));
      window.dispatchEvent(new Event('belle-sizechart-updated'));
    } catch (e) {
      console.error('Error saving size chart images:', e);
    }
  },

  // --- CUSTOMER REVIEWS (PHOTO GALLERY) ---
  getCustomerReviews() {
    try {
      const stored = localStorage.getItem('belle_customer_reviews');
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr) && arr.length > 0) return arr;
      }
    } catch (e) {
      console.error('Error reading customer reviews:', e);
    }
    return [
      { id: 'rev_1', img: '/images/berehynia_dress_1789843600634.jpg', caption: 'Сукня «Берегиня» на весіллі' },
      { id: 'rev_2', img: '/images/mavka_dress_1789843642965.jpg', caption: 'Індивідуальний пошив сукні «Мавка»' },
      { id: 'rev_3', img: '/images/oberig_shirt_1789843615744.jpg', caption: 'Сорочка «Оберіг» — ідеальна посадка' }
    ];
  },

  saveCustomerReviews(reviews) {
    try {
      localStorage.setItem('belle_customer_reviews', JSON.stringify(reviews));
      window.dispatchEvent(new Event('belle-reviews-updated'));
    } catch (e) {
      console.error('Error saving customer reviews:', e);
    }
  },

  // --- EDITABLE SITE TEXTS (POLICIES, OFFER, PRIVACY, ABOUT & CONTACTS) ---
  getDefaultSiteTexts() {
    return {
      contacts_title: 'Ательє та шоурум',
      contacts_badge: 'Київ • Belle Atelier',
      contacts_address: 'м. Київ, просп. Європейського Союзу, 45Б',
      contacts_phone: '0 (93) 971 60 65',
      contacts_instagram: 'https://www.instagram.com/belle.atelier.boutique?stkn=bzZ2ZWs5aTE0a3Fw',
      contacts_instagram_handle: '@belle.atelier.boutique',
      contacts_telegram_channel: '',
      contacts_salon_city: 'м. Київ, просп. Європейського Союзу, 45Б',
      about_text: `Belle Atelier & Boutique — простір українського кутюру, де поєднуються автентичні традиції вишивки та сучасний преміальний крій. Ми створюємо вироби з натурального льону, шовку та оксамиту, вкладаючи душу в кожен стібок. Кожна сукня, сорочка чи жакет — це витвір мистецтва, створений підкреслити вашу неповторність. Завітайте до нашого київського салону або замовляйте індивідуальний пошив за вашими особистими мірками.`,
      offer_text: `ПУБЛІЧНИЙ ДОГОВІР ОФЕРТИ
1. Загальні положення: Цей Договір є публічною офертою інтернет-магазину та ательє «Belle Atelier» щодо продажу товарів та надання послуг індивідуального пошиття.
2. Оформлення замовлення: Покупець оформлює замовлення самостійно на сайті або через менеджера.
3. Оплата та доставка: Оплата здійснюється онлайн через платіжні сервіси, за реквізитами IBAN або післяплатою відповідно до обраного способу. Доставка здійснюється перевізником «Нова Пошта» або самовивозом.
4. Права та обов'язки: Продавець зобов'язується передати якісний товар Покупцеві у встановлені строки.
(Текст договору може бути доповнений або змінений адміністратором в панелі керування).`,
      privacy_text: `ПОЛІТИКА КОНФІДЕНЦІЙНОСТІ
1. Збір даних: Ми збираємо персональні дані (ім'я, номер телефону, параметри фігури, адресу доставки) виключно для якісного виконання замовлення та індивідуального пошиття.
2. Захист інформації: Всі персональні дані клієнтів є суворо конфіденційними та не передаються третім особам, окрім служб доставки.
3. Зберігання: Інформація зберігається відповідно до вимог чинного законодавства України.
(Текст політики конфіденційності може бути доповнений або змінений в панелі керування).`,
      rules_text: `1. Оформлення замовлення: Оберіть виріб, вкажіть потрібний розмір, колір та заповніть контактні дані у кошику. Наш стиліст зв’яжеться з вами у Telegram або по телефону для підтвердження.
2. Індивідуальний пошив: Якщо потрібна корекція за вашими мірками або пошиття унікального виробу, менеджер уточнить параметри (ОГ, ОТ, ОБ, зріст).
3. Оплата: Передоплата 50% або повна оплата на рахунок ФОП / банківською картою. Для готових виробів можлива післяплата з мінімальним авансом за доставку.
4. Доставка: Доставка по Україні службою «Нова Пошта» (1-3 дні) або самовивіз із нашого салону в Києві (просп. Європейського Союзу, 45Б).`,
      exchange_text: `1. Термін: Ви можете обміняти або повернути товар належної якості протягом 14 днів з моменту отримання згідно із Законом України «Про захист прав споживачів».
2. Умови повернення: Виріб не повинен мати слідів носіння, прання чи пошкоджень, зі збереженням усіх оригінальних бірок, пломб та фірмового пакування.
3. Індивідуальні замовлення: Вироби, пошиті за індивідуальними нестандартними параметрами клієнта, підлягають гарантійній безкоштовній підгонці в нашому ательє.
4. Процедура: Для оформлення обміну або повернення зверніться до нашого менеджера у Telegram або завітайте до салону в Києві.`
    };
  },

  getSiteTexts() {
    try {
      const stored = localStorage.getItem('belle_site_texts');
      if (stored) {
        return { ...this.getDefaultSiteTexts(), ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Error reading site texts:', e);
    }
    return this.getDefaultSiteTexts();
  },

  saveSiteTexts(texts) {
    try {
      localStorage.setItem('belle_site_texts', JSON.stringify(texts));
      window.dispatchEvent(new Event('belle-site-texts-updated'));
      this.showToast('Тексти сайту успішно оновлено! ✨');
    } catch (e) {
      console.error('Error saving site texts:', e);
    }
  },

  // --- CART MANAGEMENT ---
  getCart() {
    try {
      return JSON.parse(localStorage.getItem('belle_cart')) || [
        {
          id: 'beregynya',
          name: 'Сукня «Берегиня»',
          art: 'BL-402',
          price: 4800,
          quantity: 1,
          size: 'M (EU 38)',
          color: 'Молочний / Сирий льон',
          fabric: '100% органічний льон',
          image: '/images/berehynia_dress_1789843600634.jpg'
        }
      ];
    } catch(e) {
      return [];
    }
  },

  saveCart(cart) {
    localStorage.setItem('belle_cart', JSON.stringify(cart));
    this.updateCartBadge();
  },

  addToCart(item) {
    const cart = this.getCart();
    const existing = cart.find(i => i.id === item.id && i.size === item.size);
    if (existing) {
      existing.quantity += (item.quantity || 1);
    } else {
      cart.push({
        id: item.id,
        name: item.name,
        art: item.art || 'BL-000',
        price: item.price,
        quantity: item.quantity || 1,
        size: item.size || 'M',
        color: item.color || 'Молочний',
        fabric: item.fabric || '100% льон',
        image: item.image || ''
      });
    }
    this.saveCart(cart);
    this.showToast(`«${item.name}» додано до вашого кошика ✨`);
  },

  removeFromCart(index) {
    const cart = this.getCart();
    cart.splice(index, 1);
    this.saveCart(cart);
  },

  clearCart() {
    localStorage.setItem('belle_cart', JSON.stringify([]));
    this.updateCartBadge();
  },

  updateCartBadge() {
    const cart = this.getCart();
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badges = document.querySelectorAll('.cart-badge-count');
    badges.forEach(b => {
      b.textContent = totalCount;
      b.style.display = totalCount > 0 ? 'flex' : 'none';
    });
  },

  // --- TELEGRAM BOT CONFIG & NOTIFICATIONS ---
  getTelegramConfig() {
    const DEFAULT_CONFIG = {
      botToken: '8682075215:AAEfRKiuZo443UCaZop9I3CPrGGSKGM2IEs',
      chatId: '-5522138796',
      isActive: true
    };
    try {
      const stored = localStorage.getItem('belle_telegram_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.botToken && parsed.chatId) return parsed;
      }
      return DEFAULT_CONFIG;
    } catch(e) {
      return DEFAULT_CONFIG;
    }
  },

  saveTelegramConfig(config) {
    localStorage.setItem('belle_telegram_config', JSON.stringify({
      botToken: (config.botToken || '').trim(),
      chatId: (config.chatId || '').trim(),
      isActive: Boolean(config.botToken && config.chatId)
    }));
    this.showToast('Налаштування Telegram-бота збережено! 🤖');
  },

  async sendTelegramMessage(text) {
    const config = this.getTelegramConfig();
    if (!config.botToken || !config.chatId) {
      console.warn('Telegram Bot Token or Chat ID not configured.');
      return { success: false, error: 'Telegram не налаштовано' };
    }

    try {
      const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: text,
          parse_mode: 'HTML'
        })
      });
      const data = await response.json();
      return { success: data.ok, data: data };
    } catch (err) {
      console.error('Failed to send Telegram message:', err);
      return { success: false, error: err.message };
    }
  },

  async sendOrderNotification(orderData) {
    const items = orderData.items || [];
    const itemsSum = items.reduce((sum, it) => sum + ((Number(it.price) || 0) * (Number(it.quantity) || 1)), 0);
    const bespokeFee = orderData.isBespoke ? Math.round(itemsSum * 0.15) : 0;
    const finalTotal = orderData.totalAmount ? Number(orderData.totalAmount) : (itemsSum + bespokeFee);

    const itemsList = items.map((it, idx) => {
      const p = Number(it.price) || 0;
      const q = Number(it.quantity) || 1;
      const rowTotal = p * q;
      return `  <b>${idx + 1}. ${it.name}</b> (Арт. ${it.art || '—'})\n     • Розмір: <code>${it.size}</code> | Колір: ${it.color || 'Базовий'}\n     • Кількість: ${q} шт. × ${p.toLocaleString('uk-UA')} ₴ = <b>${rowTotal.toLocaleString('uk-UA')} ₴</b>`;
    }).join('\n\n');

    let deliveryText = orderData.deliveryMethod || 'Нова Пошта';
    const locParts = [orderData.city, orderData.address].filter(Boolean);
    if (locParts.length > 0) {
      deliveryText += ` (${locParts.join(', ')})`;
    }

    const measurementsText = [
      orderData.chest ? `ОГ: ${orderData.chest} см` : null,
      orderData.waist ? `ОТ: ${orderData.waist} см` : null,
      orderData.hips ? `ОБ: ${orderData.hips} см` : null,
      orderData.height ? `Зріст: ${orderData.height} см` : null
    ].filter(Boolean).join(' | ');

    const message = `🛍 <b>НОВЕ ЗАМОВЛЕННЯ #${orderData.orderId || ('BA-' + Math.floor(1000 + Math.random() * 9000))}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Клієнт:</b> ${orderData.customerName || 'Гість'}\n` +
      `📞 <b>Телефон:</b> <code>${orderData.phone || 'Не вказано'}</code>\n` +
      `✉️ <b>Instagram:</b> ${orderData.customerInstagram || 'Не вказано'}\n` +
      `💬 <b>Telegram:</b> ${orderData.customerTelegram || 'Не вказано'}\n` +
      (measurementsText ? `📏 <b>Мірки клієнта:</b> ${measurementsText}\n` : '') +
      `📍 <b>Доставка:</b> ${deliveryText}\n` +
      `💳 <b>Оплата:</b> ${orderData.paymentMethod || 'Повна онлайн-оплата'}\n` +
      `📝 <b>Коментар:</b> ${orderData.comment || 'Немає'}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 <b>Склад замовлення:</b>\n\n${itemsList || '  (Порожній кошик)'}\n\n` +
      (orderData.isBespoke ? `🧵 <i>Індивідуальний пошив за мірками (+15%): +${bespokeFee.toLocaleString('uk-UA')} ₴</i>\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 <b>РАЗОМ ДО СПЛАТИ: ${finalTotal.toLocaleString('uk-UA')} ₴</b>\n` +
      `🕒 <i>${new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}</i>`;

    return await this.sendTelegramMessage(message);
  },

  async sendAbandonedOrderNotification(orderData, reason = 'Оплата не завершена / відхилена') {
    const items = orderData.items || [];
    const itemsSum = items.reduce((sum, it) => sum + ((Number(it.price) || 0) * (Number(it.quantity) || 1)), 0);
    const finalTotal = orderData.totalAmount ? Number(orderData.totalAmount) : itemsSum;

    const itemsList = items.map((it, idx) => {
      const p = Number(it.price) || 0;
      const q = Number(it.quantity) || 1;
      return `  <b>${idx + 1}. ${it.name}</b> (${it.size}, ${it.color || 'Базовий'}) — ${q} шт.`;
    }).join('\n');

    let deliveryText = orderData.deliveryMethod || 'Нова Пошта';
    const locParts = [orderData.city, orderData.address].filter(Boolean);
    if (locParts.length > 0) {
      deliveryText += ` (${locParts.join(', ')})`;
    }

    const measurementsText = [
      orderData.chest ? `ОГ: ${orderData.chest} см` : null,
      orderData.waist ? `ОТ: ${orderData.waist} см` : null,
      orderData.hips ? `ОБ: ${orderData.hips} см` : null,
      orderData.height ? `Зріст: ${orderData.height} см` : null
    ].filter(Boolean).join(' | ');

    const message = `⚠️ <b>НЕЗАВЕРШЕНЕ ЗАМОВЛЕННЯ (Потрібен дзвінок / зв'язок)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `❗ <b>Статус:</b> ${reason}\n` +
      `👤 <b>Клієнт:</b> ${orderData.customerName || 'Гість'}\n` +
      `📞 <b>Телефон:</b> <code>${orderData.phone || 'Не вказано'}</code>\n` +
      `✉️ <b>Instagram:</b> ${orderData.customerInstagram || 'Не вказано'}\n` +
      `💬 <b>Telegram:</b> ${orderData.customerTelegram || 'Не вказано'}\n` +
      (measurementsText ? `📏 <b>Мірки:</b> ${measurementsText}\n` : '') +
      `📍 <b>Доставка:</b> ${deliveryText}\n` +
      `💳 <b>Спроба оплати:</b> ${orderData.paymentMethod || 'Онлайн'}\n` +
      `📝 <b>Коментар:</b> ${orderData.comment || 'Немає'}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 <b>Товари в кошику:</b>\n${itemsList || '  (Порожній)'}\n\n` +
      `💰 <b>Сума: ${finalTotal.toLocaleString('uk-UA')} ₴</b>\n` +
      `🕒 <i>${new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}</i>\n` +
      `👉 <i>Зв'яжіться з клієнтом для допомоги в оформленні або надання реквізитів!</i>`;

    return await this.sendTelegramMessage(message);
  },

  // --- 2FA & AUTHENTICATION ---
  generate2FACode() {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins
    const sessionData = { code, expiresAt };
    sessionStorage.setItem('belle_2fa_pending', JSON.stringify(sessionData));
    return code;
  },

  async initiateAdminLogin() {
    const code = this.generate2FACode();
    const config = this.getTelegramConfig();

    const timeStr = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
    const message = `🔐 <b>Belle Atelier • Вхід в Адмін-панель</b>\n\n` +
      `Одноразовий код підтвердження (2FA):\n` +
      `👉 <code>${code}</code> 👈\n\n` +
      `⏱ Код дійсний 5 хвилин.\n` +
      `🕒 Час запиту: <i>${timeStr}</i>\n` +
      `⚠️ Якщо це були не ви, проігноруйте повідомлення.`;

    if (config.isActive) {
      await this.sendTelegramMessage(message);
    } else {
      console.info(`[Demo Mode 2FA Code]: ${code} (Telegram bot not yet configured in admin)`);
    }

    return { code, hasTelegram: config.isActive };
  },

  verify2FACode(inputCode) {
    try {
      const raw = sessionStorage.getItem('belle_2fa_pending');
      if (!raw) return { success: false, error: 'Код не знайдено або термін дії вичерпано. Запитайте новий.' };
      const { code, expiresAt } = JSON.parse(raw);
      if (Date.now() > expiresAt) {
        sessionStorage.removeItem('belle_2fa_pending');
        return { success: false, error: 'Термін дії коду (5 хв) закінчився. Запитайте новий.' };
      }
      if (inputCode.trim() === code) {
        sessionStorage.removeItem('belle_2fa_pending');
        // Set authenticated session
        const authSession = {
          authenticated: true,
          timestamp: Date.now(),
          token: 'auth_' + Math.random().toString(36).substring(2)
        };
        sessionStorage.setItem('belle_admin_session', JSON.stringify(authSession));
        return { success: true };
      } else {
        return { success: false, error: 'Невірний код підтвердження.' };
      }
    } catch(e) {
      return { success: false, error: 'Помилка перевірки.' };
    }
  },

  isAdminAuthenticated() {
    try {
      const raw = sessionStorage.getItem('belle_admin_session');
      if (!raw) return false;
      const session = JSON.parse(raw);
      return Boolean(session && session.authenticated);
    } catch(e) {
      return false;
    }
  },

  logoutAdmin() {
    sessionStorage.removeItem('belle_admin_session');
    window.location.href = '/';
  },

  // --- 5-CLICK EASTER EGG LISTENER ---
  setupEasterEgg() {
    let clickCount = 0;
    let clickTimer = null;
    let navTimer = null;

    const handleLogoClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      clickCount++;
      clearTimeout(clickTimer);
      clearTimeout(navTimer);

      const target = e.currentTarget;
      // Visual feedback pulse
      if (target) {
        target.style.transform = `scale(${1 + clickCount * 0.05})`;
        target.style.transition = 'transform 0.15s ease';
        setTimeout(() => {
          if (target) target.style.transform = 'scale(1)';
        }, 150);
      }

      if (clickCount >= 5) {
        clickCount = 0;
        this.openAdminAuthModal();
        return;
      }

      // Reset count after 2.5 seconds of inactivity
      clickTimer = setTimeout(() => {
        clickCount = 0;
      }, 2500);

      // If only 1 click and no further clicks within 400ms, navigate to home (normal behavior)
      navTimer = setTimeout(() => {
        if (clickCount === 1) {
          clickCount = 0;
          if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
            window.location.href = '/';
          }
        }
      }, 400);
    };

    // Attach to all logo avatars and header logo links
    const logoImgs = document.querySelectorAll('header img[alt*="Logo"], header .group img, .belle-logo-avatar');
    logoImgs.forEach(img => {
      img.style.cursor = 'pointer';
      img.addEventListener('click', handleLogoClick, { passive: false });
      img.addEventListener('touchstart', (e) => {
        // Handle mobile fast-tap
        handleLogoClick(e);
      }, { passive: false });
    });
  },

  openAdminAuthModal() {
    if (this.isAdminAuthenticated()) {
      window.location.href = '/admin.html';
      return;
    }

    let modal = document.getElementById('belle-admin-auth-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'belle-admin-auth-modal';
      modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-300';
      modal.innerHTML = `
        <div class="bg-[#FBF9F4] text-[#1B1C19] w-full max-w-md border border-[#E4E2DD] shadow-2xl p-6 sm:p-8 relative rounded-xs transform transition-transform">
          <button onclick="document.getElementById('belle-admin-auth-modal').remove()" class="absolute top-4 right-4 text-[#887273] hover:text-[#5E1020] p-1">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
          
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-[#5E1020] text-white flex items-center justify-center font-bold">
              <span class="material-symbols-outlined text-[20px]">lock</span>
            </div>
            <div>
              <h3 class="font-headline text-xl text-[#5E1020] font-semibold">Belle Atelier • Панель</h3>
              <p class="text-[11px] text-[#725B38] tracking-widest uppercase font-medium">Двофакторна авторизація 2FA</p>
            </div>
          </div>

          <div id="auth-step-request" class="space-y-4">
            <p class="text-xs text-[#554243] leading-relaxed">
              Вхід у панель адміністратора захищено одноразовим кодом, який надсилається у ваш робочий <b>Telegram-чат</b>.
            </p>
            <div id="auth-status-msg" class="text-xs p-2.5 bg-[#F0EEE9] rounded border border-[#E4E2DD] hidden"></div>
            <button id="btn-request-2fa" onclick="BelleStore.handleSend2FACode()" class="w-full bg-[#5E1020] hover:bg-[#2F2F2E] text-white py-3 font-semibold text-xs tracking-widest uppercase transition-colors flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[18px]">send</span>
              <span>Надіслати код у Telegram</span>
            </button>
          </div>

          <div id="auth-step-verify" class="space-y-4 hidden">
            <p class="text-xs text-[#554243]">
              Введіть 6-значний код, отриманий у Telegram:
            </p>
            <div>
              <input type="text" id="admin-2fa-input" maxlength="6" placeholder="000000" class="w-full text-center tracking-[0.4em] font-headline text-2xl font-bold py-2.5 bg-white border border-[#887273] focus:border-[#5E1020] focus:outline-none" />
            </div>
            <div id="auth-verify-error" class="text-xs text-red-600 font-medium hidden"></div>
            <button onclick="BelleStore.handleVerify2FACode()" class="w-full bg-[#5E1020] hover:bg-[#2F2F2E] text-white py-3 font-semibold text-xs tracking-widest uppercase transition-colors flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[18px]">login</span>
              <span>Підтвердити та увійти</span>
            </button>
            <div class="text-center">
              <button onclick="BelleStore.handleSend2FACode()" class="text-[11px] text-[#725B38] hover:text-[#5E1020] underline">
                Надіслати код повторно
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
  },

  async handleSend2FACode() {
    const btn = document.getElementById('btn-request-2fa');
    const statusMsg = document.getElementById('auth-status-msg');
    if (btn) btn.disabled = true;
    if (statusMsg) {
      statusMsg.classList.remove('hidden');
      statusMsg.innerHTML = 'Генеруємо код та відправляємо в Telegram...';
    }

    const res = await this.initiateAdminLogin();
    
    document.getElementById('auth-step-request').classList.add('hidden');
    document.getElementById('auth-step-verify').classList.remove('hidden');
    
    const input = document.getElementById('admin-2fa-input');
    if (input) {
      input.value = '';
      input.focus();
    }

    if (!res.hasTelegram) {
      const errBox = document.getElementById('auth-verify-error');
      if (errBox) {
        errBox.classList.remove('hidden');
        errBox.className = 'text-xs text-[#725B38] bg-[#F5F3EE] p-2.5 border border-[#E4E2DD] rounded';
        errBox.innerHTML = `ℹ️ Telegram-бот ще не підключено в налаштуваннях. Ваш код для першого входу: <strong class="text-[#5E1020] text-sm">${res.code}</strong>`;
      }
    }
  },

  handleVerify2FACode() {
    const input = document.getElementById('admin-2fa-input');
    const errBox = document.getElementById('auth-verify-error');
    if (!input) return;

    const val = input.value.trim();
    const result = this.verify2FACode(val);

    if (result.success) {
      this.showToast('Авторизація успішна! Ласкаво просимо ✨');
      setTimeout(() => {
        window.location.href = '/admin.html';
      }, 500);
    } else {
      if (errBox) {
        errBox.classList.remove('hidden');
        errBox.className = 'text-xs text-red-600 font-medium';
        errBox.textContent = result.error;
      }
    }
  },

  showToast(msg) {
    let toast = document.getElementById('belle-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'belle-toast';
      toast.className = 'fixed bottom-6 right-6 z-[200] bg-[#5E1020] text-white px-6 py-3 rounded shadow-2xl font-medium tracking-wide flex items-center gap-3 transition-all duration-300 transform translate-y-20 opacity-0';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span class="material-symbols-outlined text-[20px]">check_circle</span><span>${msg}</span>`;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
      toast.classList.add('translate-y-20', 'opacity-0');
    }, 3500);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  BelleStore.updateCartBadge();
  BelleStore.setupEasterEgg();
});
