const WHATSAPP_NUMBER = "5492645439494";

const BURGER_PRICES = {
  simple: 9000,
  doble: 10200,
  triple: 11400,
};

const SPECIAL_PRICES = {
  Pachata: 13000,
  Lomo: 14000,
};

const PROMO_PRICES = {
  "2 burgers simples + papas": 16500,
  "2 burgers dobles + papas": 18900,
  "3 burgers simples + papas": 25500,
  "2 pachatas + papas": 26000,
  "2 lomos + papas": 27000,
};

const EXTRAS = [
  { name: "Panceta", price: 900 },
  { name: "Extra carne", price: 1000 },
  { name: "Extra cheddar", price: 500 },
  { name: "Papas fritas", price: 1600 },
];

const BREAD_OPTIONS = ["Gratinado", "Semillas", "Liso"];

const CART_STORAGE_KEY = "frank-burgers-cart";

const formatMoney = (amount) => `$${Number(amount || 0).toLocaleString("es-AR")}`;

const buildWhatsAppUrl = (message) => {
  const text = encodeURIComponent(message);
  return WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`
    : `https://wa.me/?text=${text}`;
};

const normalizeText = (value) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const readStoredCart = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

document.addEventListener("DOMContentLoaded", () => {
  let cart = readStoredCart();
  let pendingProduct = null;
  let closeTimer = null;

  const header = document.querySelector("[data-header]");
  const nav = document.querySelector("[data-nav]");
  const navToggle = document.querySelector("[data-nav-toggle]");

  const setHeaderState = () => {
    header?.classList.toggle("is-scrolled", window.scrollY > 18);
  };

  setHeaderState();
  window.addEventListener("scroll", setHeaderState, { passive: true });

  // FIX: 3 - Menú hamburguesa con toggle JS puro
  navToggle?.addEventListener("click", () => {
    const isOpen = nav?.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(Boolean(isOpen)));
    document.body.classList.toggle("nav-open", Boolean(isOpen));
  });

  nav?.querySelectorAll("a").forEach((item) => {
    item.addEventListener("click", () => {
      nav.classList.remove("is-open");
      navToggle?.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    });
  });

  window.addEventListener("load", () => {
    const target = window.location.hash ? document.querySelector(window.location.hash) : null;
    target?.scrollIntoView({ block: "start" });
  });

  // FIX: 1 - Forzar autoplay en iOS
  const heroVideo = document.querySelector(".hero-video");
  if (heroVideo) {
    heroVideo.muted = true;
    heroVideo.defaultMuted = true;
    heroVideo.playsInline = true;
    heroVideo.setAttribute("playsinline", "");
    heroVideo.setAttribute("webkit-playsinline", "");
    
    const playPromise = heroVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Si el autoplay está bloqueado (modo ahorro de batería, etc), 
        // lo forzamos con el primer tap en la pantalla
        document.body.addEventListener('touchstart', () => {
          heroVideo.play();
        }, { once: true });
      });
    }
  }

  const revealItems = [...document.querySelectorAll(".reveal")].filter((item) => !item.closest(".hero"));

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove("is-pending");
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );

    revealItems.forEach((item, index) => {
      item.classList.add("is-pending");
      item.style.transitionDelay = `${Math.min(index % 6, 5) * 70}ms`;
      observer.observe(item);
    });
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  buildCartShell();
  enhanceCatalog();
  bindCartEvents();
  wireLegacyWhatsAppLinks();
  updateCart();

  function buildCartShell() {
    const float = document.querySelector(".floating-whatsapp");
    if (float) {
      float.className = "floating-cart";
      float.removeAttribute("data-whatsapp");
      float.removeAttribute("data-order");
      float.removeAttribute("href");
      float.setAttribute("role", "button");
      float.setAttribute("tabindex", "0");
      float.setAttribute("aria-label", "Abrir carrito");
      float.dataset.cartOpen = "true";
      float.innerHTML = `<svg class="cart-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg><span>Pedido</span><strong data-cart-count>0</strong>`;
    }

    const extrasMarkup = EXTRAS.map(
      (extra) => `
        <label class="cart-option">
          <input type="checkbox" data-extra-name="${escapeHtml(extra.name)}" data-extra-price="${extra.price}" />
          <span>${escapeHtml(extra.name)}</span>
          <b>${formatMoney(extra.price)}</b>
        </label>`
    ).join("");

    const breadMarkup = BREAD_OPTIONS.map(
      (bread) => `
        <label class="cart-option cart-option-compact">
          <input type="radio" name="customize-bread" value="${escapeHtml(bread)}" ${bread === "Liso" ? "checked" : ""} />
          <span>${escapeHtml(bread)}</span>
        </label>`
    ).join("");

    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div class="cart-backdrop" data-cart-backdrop hidden></div>
      <aside class="cart-drawer" data-cart-drawer hidden aria-labelledby="cart-title" aria-modal="true" role="dialog">
        <div class="cart-panel-header">
          <div>
            <span>Tu pedido</span>
            <h2 id="cart-title">Carrito</h2>
          </div>
          <button class="cart-icon-button" type="button" data-cart-close aria-label="Cerrar carrito">x</button>
        </div>
        <div class="cart-items" data-cart-items></div>
        <div class="cart-panel-footer" data-cart-footer hidden>
          <div class="cart-total-row">
            <span>Total</span>
            <strong data-cart-total>$0</strong>
          </div>
          <button class="cart-primary-action" type="button" data-open-checkout>Confirmar pedido</button>
          <button class="cart-secondary-action" type="button" data-cart-clear>Vaciar carrito</button>
        </div>
      </aside>

      <div class="cart-backdrop" data-customize-backdrop hidden></div>
      <section class="cart-dialog customize-dialog" data-customize-modal hidden aria-labelledby="customize-title" aria-modal="true" role="dialog">
        <div class="cart-panel-header">
          <div>
            <span>Personalización</span>
            <h2 id="customize-title" data-customize-title>Producto</h2>
          </div>
          <button class="cart-icon-button" type="button" data-customize-close aria-label="Cerrar personalización">x</button>
        </div>
        <div class="cart-dialog-body">
          <div class="cart-fieldset" data-extras-fieldset>
            <div class="cart-fieldset-title">
              <h3>Extras</h3>
              <small data-extra-count>(0/4)</small>
            </div>
            <div class="cart-option-grid">${extrasMarkup}</div>
          </div>
          <div class="cart-fieldset" data-bread-fieldset>
            <div class="cart-fieldset-title">
              <h3>Tipo de pan</h3>
              <small data-bread-count>(1/1)</small>
            </div>
            <div class="cart-option-grid cart-option-grid-three">${breadMarkup}</div>
          </div>
          <label class="cart-textarea-field">
            <span>Notas adicionales</span>
            <textarea data-customize-notes rows="3" placeholder="Ej: sin cebolla, bien cocida"></textarea>
          </label>
        </div>
        <div class="cart-dialog-footer">
          <button class="cart-primary-action" type="button" data-customize-confirm>Confirmar y agregar</button>
        </div>
      </section>

      <div class="cart-backdrop" data-checkout-backdrop hidden></div>
      <section class="cart-dialog checkout-dialog" data-checkout-modal hidden aria-labelledby="checkout-title" aria-modal="true" role="dialog">
        <form data-checkout-form>
          <div class="cart-panel-header">
            <div>
              <span>Checkout</span>
              <h2 id="checkout-title">Datos del pedido</h2>
            </div>
            <button class="cart-icon-button" type="button" data-checkout-close aria-label="Cerrar checkout">x</button>
          </div>
          <div class="cart-dialog-body">
            <label class="cart-input-field">
              <span>Nombre del cliente</span>
              <input type="text" name="customerName" autocomplete="name" required />
            </label>
            <label class="cart-input-field">
              <span>Dirección de entrega</span>
              <input type="text" name="address" autocomplete="street-address" required />
            </label>
            <div class="cart-fieldset">
              <div class="cart-fieldset-title">
                <h3>Método de pago</h3>
              </div>
              <div class="payment-options">
                <label class="cart-option cart-option-compact">
                  <input type="radio" name="paymentMethod" value="transferencia" checked />
                  <span>Transferencia</span>
                </label>
                <label class="cart-option cart-option-compact">
                  <input type="radio" name="paymentMethod" value="efectivo" />
                  <span>Efectivo</span>
                </label>
              </div>
            </div>
            <label class="cart-input-field checkout-cash-group" data-cash-group hidden>
              <span>¿Con cuánto abonás?</span>
              <input type="number" name="cashAmount" min="0" step="100" inputmode="numeric" />
            </label>
            <p class="checkout-change" data-checkout-change>Total a abonar: $0</p>
          </div>
          <div class="cart-dialog-footer">
            <button class="cart-primary-action" type="submit">Confirmar y enviar por WhatsApp</button>
          </div>
        </form>
      </section>
      <div class="cart-toast" data-cart-toast hidden></div>
      `
    );
  }

  function enhanceCatalog() {
    document.querySelectorAll(".product-card").forEach((card) => {
      const name = card.querySelector("h3")?.textContent.trim();
      const button = card.querySelector(".order-link");
      if (!name || !button) return;

      card.dataset.cartType = "burger";
      card.dataset.cartName = name;
      button.dataset.addItem = "true";
      button.textContent = "Agregar";
      button.removeAttribute("data-whatsapp");
      button.removeAttribute("target");
      button.removeAttribute("rel");

      if (!card.querySelector("[data-cart-controls]")) {
        const controls = document.createElement("div");
        controls.className = "cart-product-controls";
        controls.dataset.cartControls = "true";
        controls.innerHTML = `
          <label class="cart-size-field">
            <span>Tamaño</span>
            <select data-size-select>
              <option value="simple">Simple - ${formatMoney(BURGER_PRICES.simple)}</option>
              <option value="doble">Doble - ${formatMoney(BURGER_PRICES.doble)}</option>
              <option value="triple">Triple - ${formatMoney(BURGER_PRICES.triple)}</option>
            </select>
          </label>
          ${quantityControlMarkup()}`;
        button.before(controls);
      }
    });

    document.querySelectorAll(".special-card").forEach((card) => {
      const name = card.querySelector("h3")?.textContent.trim();
      const normalizedName = normalizeText(name || "").includes("lomo") ? "Lomo" : "Pachata";
      const button = card.querySelector(".order-link");
      if (!button) return;

      card.dataset.cartType = "special";
      card.dataset.cartName = normalizedName;
      card.dataset.cartPrice = String(SPECIAL_PRICES[normalizedName]);
      button.dataset.addItem = "true";
      button.textContent = "Agregar";
      button.removeAttribute("data-whatsapp");
      button.removeAttribute("target");
      button.removeAttribute("rel");

      if (!card.querySelector("[data-cart-controls]")) {
        const actions = document.createElement("div");
        actions.className = "cart-inline-actions";
        actions.dataset.cartControls = "true";
        actions.innerHTML = quantityControlMarkup();
        button.before(actions);
        actions.append(button);
      }
    });

    document.querySelectorAll(".promo-card").forEach((card) => {
      const title = card.querySelector("h3")?.textContent.trim();
      const key = Object.keys(PROMO_PRICES).find((promo) => normalizeText(promo) === normalizeText(title || ""));
      const button = card.querySelector("a");
      if (!key || !button) return;

      card.dataset.cartType = "promo";
      card.dataset.cartName = title;
      card.dataset.cartPrice = String(PROMO_PRICES[key]);
      button.dataset.addItem = "true";
      button.textContent = "Agregar promo";
      button.removeAttribute("data-whatsapp");
      button.removeAttribute("target");
      button.removeAttribute("rel");

      if (!card.querySelector("[data-cart-controls]")) {
        const actions = document.createElement("div");
        actions.className = "cart-inline-actions promo-inline-actions";
        actions.dataset.cartControls = "true";
        actions.innerHTML = quantityControlMarkup();
        button.before(actions);
        actions.append(button);
      }
    });

    // Dips — agregar directo al carrito, sin modal
    document.querySelectorAll(".dip-card").forEach((card) => {
      const button = card.querySelector("[data-add-item]");
      if (!button) return;
      // data-cart-type, data-cart-name, data-cart-price already set in HTML
    });

    // Bebidas — agregar directo al carrito, sin modal
    document.querySelectorAll(".bebida-card").forEach((card) => {
      const button = card.querySelector("[data-add-item]");
      if (!button) return;
      // data-cart-type, data-cart-name, data-cart-price already set in HTML
    });
  }

  function bindCartEvents() {
    document.addEventListener("click", (event) => {
      const qtyButton = event.target.closest("[data-qty-action]");
      if (qtyButton) {
        updateQuantityControl(qtyButton);
        return;
      }

      const addButton = event.target.closest("[data-add-item]");
      if (addButton) {
        event.preventDefault();
        handleAddClick(addButton);
        return;
      }

      if (event.target.closest("[data-cart-open]")) {
        event.preventDefault();
        openCart();
        return;
      }

      if (event.target.closest("[data-cart-close]") || event.target.matches("[data-cart-backdrop]")) {
        closeCart();
        return;
      }

      if (event.target.closest("[data-customize-close]") || event.target.matches("[data-customize-backdrop]")) {
        closeCustomize();
        return;
      }

      if (event.target.closest("[data-checkout-close]") || event.target.matches("[data-checkout-backdrop]")) {
        closeCheckout();
        return;
      }

      const removeButton = event.target.closest("[data-remove-item]");
      if (removeButton) {
        cart.splice(Number(removeButton.dataset.removeItem), 1);
        updateCart();
        return;
      }

      if (event.target.closest("[data-cart-clear]")) {
        cart = [];
        updateCart();
        showToast("Carrito vacío");
        return;
      }

      if (event.target.closest("[data-open-checkout]")) {
        openCheckout();
      }
    });

    document.addEventListener("change", (event) => {
      if (event.target.matches("[data-extra-name]")) {
        updateExtraState();
      }

      if (event.target.matches('input[name="customize-bread"]')) {
        updateBreadCount();
      }

      if (event.target.matches('input[name="paymentMethod"]')) {
        updatePaymentState();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeCart();
        closeCustomize();
        closeCheckout();
        return;
      }

      const cartTrigger = event.target.closest?.("[data-cart-open]");
      if (cartTrigger && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openCart();
      }
    });

    document.querySelector("[data-customize-confirm]")?.addEventListener("click", confirmCustomizedProduct);
    document.querySelector("[data-checkout-form]")?.addEventListener("submit", submitCheckout);
    document.querySelector('input[name="cashAmount"]')?.addEventListener("input", updateChangePreview);
  }

  function wireLegacyWhatsAppLinks() {
    document.querySelectorAll("[data-whatsapp]").forEach((link) => {
      link.href = "#menu";
      link.removeAttribute("target");
      link.removeAttribute("rel");
      link.addEventListener("click", (event) => {
        event.preventDefault();
        if (cart.length) {
          openCart();
          return;
        }

        document.querySelector("#menu")?.scrollIntoView({ behavior: "smooth", block: "start" });
        showToast("Elegí tus productos y armamos el pedido");
      });
    });
  }

  function quantityControlMarkup() {
    return `
      <div class="cart-qty" aria-label="Cantidad">
        <button type="button" data-qty-action="minus" aria-label="Restar cantidad">-</button>
        <span data-qty-value>1</span>
        <button type="button" data-qty-action="plus" aria-label="Sumar cantidad">+</button>
      </div>`;
  }

  function updateQuantityControl(button) {
    const control = button.closest(".cart-qty");
    const valueEl = control?.querySelector("[data-qty-value]");
    const current = Number(valueEl?.textContent || 1);
    const next = button.dataset.qtyAction === "plus" ? current + 1 : Math.max(1, current - 1);
    if (valueEl) valueEl.textContent = String(next);
  }

  function handleAddClick(button) {
    const card = button.closest("[data-cart-type]");
    const product = readProductFromCard(card);
    if (!product) return;

    resetCardControls(card);

    // Dips y bebidas van directo al carrito, sin modal de personalización
    if (product.type === "dip" || product.type === "bebida") {
      addCartItem(product);
      flyToCart(button);
      showToast(`${product.qty}x ${product.name} agregado`);
      return;
    }

    if (product.type === "promo") {
      addCartItem(product);
      flyToCart(button);
      showToast(`${product.qty}x ${product.name} agregado`);
      return;
    }

    openCustomize(product);
  }

  function readProductFromCard(card) {
    if (!card) return null;
    const type = card.dataset.cartType;
    const name = card.dataset.cartName;
    const qty = Number(card.querySelector("[data-qty-value]")?.textContent || 1);

    if (type === "burger") {
      const size = card.querySelector("[data-size-select]")?.value || "simple";
      return {
        type,
        name,
        qty,
        size,
        sizeLabel: size.charAt(0).toUpperCase() + size.slice(1),
        unitPrice: BURGER_PRICES[size],
      };
    }

    return {
      type,
      name,
      qty,
      size: "",
      sizeLabel: "",
      unitPrice: Number(card.dataset.cartPrice || 0),
    };
  }

  function resetCardControls(card) {
    card?.querySelectorAll("[data-qty-value]").forEach((value) => {
      value.textContent = "1";
    });
    const sizeSelect = card?.querySelector("[data-size-select]");
    if (sizeSelect) sizeSelect.value = "simple";
  }

  function openCustomize(product) {
    pendingProduct = product;
    const modal = document.querySelector("[data-customize-modal]");
    const title = document.querySelector("[data-customize-title]");
    const notes = document.querySelector("[data-customize-notes]");
    const extrasFieldset = document.querySelector("[data-extras-fieldset]");
    const breadFieldset = document.querySelector("[data-bread-fieldset]");

    if (title) title.textContent = `${product.qty}x ${product.name}${product.sizeLabel ? ` (${product.sizeLabel})` : ""}`;
    document.querySelectorAll("[data-extra-name]").forEach((input) => {
      input.checked = false;
      input.disabled = false;
    });
    document.querySelector('input[name="customize-bread"][value="Liso"]').checked = true;
    if (notes) notes.value = "";
    
    const isSpecial = product.name === "Pachata" || product.name === "Lomo";
    if (extrasFieldset) extrasFieldset.hidden = isSpecial;
    if (breadFieldset) breadFieldset.hidden = isSpecial;

    updateExtraState();
    updateBreadCount();
    openLayer("[data-customize-backdrop]", modal);
  }

  function closeCustomize() {
    pendingProduct = null;
    closeLayer("[data-customize-backdrop]", "[data-customize-modal]");
  }

  function updateExtraState() {
    const checked = document.querySelectorAll("[data-extra-name]:checked").length;
    document.querySelector("[data-extra-count]").textContent = `(${checked}/4)`;
    document.querySelectorAll("[data-extra-name]:not(:checked)").forEach((input) => {
      input.disabled = checked >= 4;
    });
  }

  function updateBreadCount() {
    const checked = document.querySelector('input[name="customize-bread"]:checked');
    document.querySelector("[data-bread-count]").textContent = checked ? "(1/1)" : "(0/1)";
  }

  function confirmCustomizedProduct() {
    if (!pendingProduct) return;
    const extras = [...document.querySelectorAll("[data-extra-name]:checked")].map((input) => ({
      name: input.dataset.extraName,
      price: Number(input.dataset.extraPrice || 0),
    }));
    const extrasTotal = extras.reduce((total, extra) => total + extra.price, 0);
    const bread = document.querySelector('input[name="customize-bread"]:checked')?.value || "Liso";
    const notes = document.querySelector("[data-customize-notes]")?.value.trim() || "";

    const isSpecial = pendingProduct.name === "Pachata" || pendingProduct.name === "Lomo";

    addCartItem({
      ...pendingProduct,
      extras: isSpecial ? [] : extras,
      extrasTotal: isSpecial ? 0 : extrasTotal,
      bread: isSpecial ? "" : bread,
      notes,
    });
    showToast(`${pendingProduct.qty}x ${pendingProduct.name} agregado`);
    closeCustomize();
  }

  function addCartItem(item) {
    const extrasTotal = item.extrasTotal || 0;
    cart.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: item.type,
      name: item.name,
      qty: item.qty,
      size: item.size || "",
      sizeLabel: item.sizeLabel || "",
      unitPrice: item.unitPrice,
      extras: item.extras || [],
      extrasTotal,
      bread: item.bread || "",
      notes: item.notes || "",
      total: (item.unitPrice + extrasTotal) * item.qty,
    });
    updateCart();
    triggerCartBump();
  }

  function updateCart() {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Storage can be unavailable in private modes; the in-memory cart still works.
    }
    renderCartItems();
    updateFloatingCount();
    updateChangePreview();
  }

  function renderCartItems() {
    const itemsEl = document.querySelector("[data-cart-items]");
    const footer = document.querySelector("[data-cart-footer]");
    const totalEl = document.querySelector("[data-cart-total]");
    if (!itemsEl || !footer || !totalEl) return;

    if (!cart.length) {
      itemsEl.innerHTML = '<p class="cart-empty">Tu carrito está vacío</p>';
      footer.hidden = true;
      totalEl.textContent = "$0";
      return;
    }

    itemsEl.innerHTML = cart
      .map((item, index) => {
        const detail = buildItemDetails(item);
        return `
          <article class="cart-line">
            <div class="cart-line-main">
              <strong>${escapeHtml(item.qty)}x ${escapeHtml(item.name)}</strong>
              ${detail ? `<p>${detail}</p>` : ""}
            </div>
            <div class="cart-line-side">
              <b>${formatMoney(item.total)}</b>
              <button type="button" data-remove-item="${index}" aria-label="Quitar ${escapeHtml(item.name)}">x</button>
            </div>
          </article>`;
      })
      .join("");

    footer.hidden = false;
    totalEl.textContent = formatMoney(getCartTotal());
  }

  function buildItemDetails(item) {
    const parts = [];
    if (item.sizeLabel) parts.push(item.sizeLabel);
    if (item.extras?.length) {
      const extrasText = item.extras.map((extra) => `${extra.name} (+${formatMoney(extra.price)})`).join(", ");
      parts.push(`Extras: ${extrasText}`);
    }
    if (item.bread) parts.push(`Pan: ${item.bread}`);
    if (item.notes) parts.push(`Notas: ${item.notes}`);
    return parts.map(escapeHtml).join("<br />");
  }

  function updateFloatingCount() {
    const count = cart.reduce((total, item) => total + item.qty, 0);
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = String(count);
      el.classList.toggle("is-empty", count === 0);
      // Pop animation on each update
      el.classList.remove("count-pop");
      void el.offsetWidth; // reflow to restart animation
      el.classList.add("count-pop");
    });
  }

  function triggerCartBump() {
    const floatingCart = document.querySelector(".floating-cart");
    if (!floatingCart) return;
    floatingCart.classList.remove("cart-bump");
    void floatingCart.offsetWidth;
    floatingCart.classList.add("cart-bump");
    floatingCart.addEventListener("animationend", () => floatingCart.classList.remove("cart-bump"), { once: true });
  }

  function flyToCart(trigger) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const floatingCart = document.querySelector(".floating-cart");
    if (!floatingCart) return;

    const triggerRect = trigger.getBoundingClientRect();
    const cartRect = floatingCart.getBoundingClientRect();

    const startX = triggerRect.left + triggerRect.width / 2;
    const startY = triggerRect.top + triggerRect.height / 2;
    const endX = cartRect.left + cartRect.width / 2;
    const endY = cartRect.top + cartRect.height / 2;

    // Flash de confirmación en el botón
    trigger.classList.add("btn-confirm-flash");
    trigger.addEventListener("animationend", () => trigger.classList.remove("btn-confirm-flash"), { once: true });

    // Partículas de explosión
    const PARTICLE_COUNT = 8;
    const colors = ["#ff6a00", "#ffb000", "#ff4d00", "#fff4dc", "#ff8c00"];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const particle = document.createElement("div");
      const angle = (360 / PARTICLE_COUNT) * i;
      const distance = 30 + Math.random() * 28;
      const color = colors[i % colors.length];
      const size = 6 + Math.random() * 6;
      particle.className = "burst-particle";
      particle.style.cssText = [
        `left: ${startX}px`,
        `top: ${startY}px`,
        `width: ${size}px`,
        `height: ${size}px`,
        `background: ${color}`,
        `--angle: ${angle}deg`,
        `--dist: ${distance}px`,
        `animation-delay: ${i * 18}ms`,
      ].join(";");
      document.body.appendChild(particle);
      particle.addEventListener("animationend", () => particle.remove(), { once: true });
    }

    // Orbe principal que vuela al carrito
    const clone = document.createElement("div");
    clone.className = "fly-clone";
    clone.style.left = `${startX - 14}px`;
    clone.style.top = `${startY - 14}px`;
    clone.style.setProperty("--fly-dx", `${endX - startX}px`);
    clone.style.setProperty("--fly-dy", `${endY - startY}px`);
    document.body.appendChild(clone);
    clone.addEventListener("animationend", () => clone.remove(), { once: true });
  }

  function getCartTotal() {
    return cart.reduce((total, item) => total + item.total, 0);
  }

  function openCart() {
    openLayer("[data-cart-backdrop]", "[data-cart-drawer]");
  }

  function closeCart() {
    closeLayer("[data-cart-backdrop]", "[data-cart-drawer]");
  }

  function openCheckout() {
    if (!cart.length) {
      showToast("El carrito está vacío");
      return;
    }

    closeCart();
    const form = document.querySelector("[data-checkout-form]");
    form?.reset();
    const transfer = form?.querySelector('input[value="transferencia"]');
    if (transfer) transfer.checked = true;
    updatePaymentState();
    updateChangePreview();
    openLayer("[data-checkout-backdrop]", "[data-checkout-modal]");
  }

  function closeCheckout() {
    closeLayer("[data-checkout-backdrop]", "[data-checkout-modal]");
  }

  function updatePaymentState() {
    const payment = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    const cashGroup = document.querySelector("[data-cash-group]");
    const cashInput = document.querySelector('input[name="cashAmount"]');
    const isCash = payment === "efectivo";

    if (cashGroup) cashGroup.hidden = !isCash;
    if (cashInput) {
      cashInput.required = isCash;
      cashInput.min = String(isCash ? getCartTotal() : 0);
      if (!isCash) cashInput.value = "";
    }
    updateChangePreview();
  }

  function updateChangePreview() {
    const output = document.querySelector("[data-checkout-change]");
    if (!output) return;
    const total = getCartTotal();
    const payment = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    const cash = Number(document.querySelector('input[name="cashAmount"]')?.value || 0);

    if (payment !== "efectivo") {
      output.textContent = `Total a abonar: ${formatMoney(total)}`;
      return;
    }

    if (!cash) {
      output.textContent = `Total a abonar: ${formatMoney(total)}`;
      return;
    }

    output.textContent =
      cash >= total ? `Vuelto: ${formatMoney(cash - total)}` : `Falta: ${formatMoney(total - cash)}`;
  }

  function submitCheckout(event) {
    event.preventDefault();
    if (!cart.length) {
      showToast("El carrito está vacío");
      closeCheckout();
      return;
    }

    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const paymentMethod = formData.get("paymentMethod");
    const total = getCartTotal();
    const cashAmount = Number(formData.get("cashAmount") || 0);

    if (paymentMethod === "efectivo" && cashAmount < total) {
      showToast("El monto en efectivo no cubre el total");
      return;
    }

    const message = buildOrderMessage({
      customerName: String(formData.get("customerName") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      paymentMethod,
      cashAmount,
    });

    window.open(buildWhatsAppUrl(message), "_blank", "noopener");
    closeCheckout();
  }

  function buildOrderMessage(checkout) {
    const total = getCartTotal();
    let message = "Hola Frank Burgers, quiero confirmar este pedido:\n\n";
    message += "Items:\n";

    cart.forEach((item, index) => {
      message += `${index + 1}. ${item.qty}x ${item.name}`;
      if (item.sizeLabel) message += ` (${item.sizeLabel})`;
      message += ` - ${formatMoney(item.unitPrice + (item.extrasTotal || 0))} c/u\n`;
      if (item.extras?.length) {
        message += `   Extras: ${item.extras.map((extra) => `${extra.name} (+${formatMoney(extra.price)})`).join(", ")}\n`;
      }
      if (item.bread) message += `   Pan: ${item.bread}\n`;
      if (item.notes) message += `   Notas: ${item.notes}\n`;
      message += `   Subtotal: ${formatMoney(item.total)}\n`;
    });

    message += `\nTotal: ${formatMoney(total)}\n\n`;
    message += `Nombre: ${checkout.customerName}\n`;
    message += `Dirección: ${checkout.address}\n`;

    if (checkout.paymentMethod === "efectivo") {
      message += "Método de pago: Efectivo\n";
      message += `Abona con: ${formatMoney(checkout.cashAmount)} / Vuelto: ${formatMoney(checkout.cashAmount - total)}`;
    } else {
      message += "Método de pago: Transferencia\n";
      message += "Paga por transferencia (el local enviará el alias)";
    }

    return message;
  }

  function openLayer(backdropSelector, panel) {
    const backdrop = document.querySelector(backdropSelector);
    const target = typeof panel === "string" ? document.querySelector(panel) : panel;
    if (!backdrop || !target) return;

    window.clearTimeout(closeTimer);
    backdrop.hidden = false;
    target.hidden = false;
    document.body.classList.add("cart-lock");
    requestAnimationFrame(() => {
      backdrop.classList.add("is-open");
      target.classList.add("is-open");
    });
  }

  function closeLayer(backdropSelector, panelSelector) {
    const backdrop = document.querySelector(backdropSelector);
    const panel = document.querySelector(panelSelector);
    if (!backdrop || !panel) return;

    backdrop.classList.remove("is-open");
    panel.classList.remove("is-open");
    closeTimer = window.setTimeout(() => {
      backdrop.hidden = true;
      panel.hidden = true;
      if (!document.querySelector(".cart-backdrop.is-open")) {
        document.body.classList.remove("cart-lock");
      }
    }, 180);
  }

  function showToast(message) {
    const toast = document.querySelector("[data-cart-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("is-open"));
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.classList.remove("is-open");
      window.setTimeout(() => {
        toast.hidden = true;
      }, 180);
    }, 2200);
  }
});
