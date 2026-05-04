const WHATSAPP_NUMBER = "";

const buildWhatsAppUrl = (message) => {
  const text = encodeURIComponent(message);
  return WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`
    : `https://wa.me/?text=${text}`;
};

document.querySelectorAll("[data-whatsapp]").forEach((link) => {
  const order = link.dataset.order || "Hola Frank Burgers, quiero hacer un pedido.";
  link.href = buildWhatsAppUrl(order);
  link.target = "_blank";
  link.rel = "noopener";
});

const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");

const setHeaderState = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 18);
};

setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

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
