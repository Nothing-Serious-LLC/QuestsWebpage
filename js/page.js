/* ==========================================================================
   Quests subpages: the homepage chrome behaviors, nothing else.
   Backdrop glyphs drift with scroll, Download goes to the right store, items
   marked .reveal fade in as they arrive, the footer year stays current.
   Page-specific behavior (contact form, Quest Card QR, 404 deep links) lives
   inline on its page.
   ========================================================================== */
(function () {
  'use strict';
  document.documentElement.classList.remove('no-js');

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Download goes straight to the store for this device. ---- */
  var storeLinks = document.querySelectorAll('[data-store-link]');
  if (storeLinks.length && /android/i.test(navigator.userAgent)) {
    Array.prototype.forEach.call(storeLinks, function (a) {
      a.href = 'https://play.google.com/store/apps/details?id=info.nothingserious.quests';
    });
  }

  /* ---- Backdrop glyphs ride the scroll at a fraction of its speed. ---- */
  var backdrop = document.querySelector('.backdrop');
  if (backdrop && !reducedMotion) {
    var frame = 0;
    function paint() { frame = 0; backdrop.style.setProperty('--sy', (window.scrollY || 0) + 'px'); }
    window.addEventListener('scroll', function () { if (!frame) frame = window.requestAnimationFrame(paint); }, { passive: true });
    paint();
  }

  /* ---- Reveal: cards and blocks fade up once as they enter. ---- */
  var items = document.querySelectorAll('.reveal');
  if (items.length) {
    if (!('IntersectionObserver' in window) || reducedMotion) {
      Array.prototype.forEach.call(items, function (el) { el.classList.add('is-visible'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          el.style.setProperty('--delay', (parseInt(el.getAttribute('data-reveal-delay'), 10) || 0) + 'ms');
          el.classList.add('is-visible');
          io.unobserve(el);
        });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });
      Array.prototype.forEach.call(items, function (el) { io.observe(el); });
    }
  }

  /* ---- Footer year ---- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) {
    el.textContent = String(new Date().getFullYear());
  });
}());
