/* ==========================================================================
   Quests V2 site behaviour
   Vanilla, dependency free, safe to load with <script src="/js/site.js" defer>
   (also safe if the DOM is already parsed).

   What it does
   1. Reveal on scroll: elements with .reveal get .revealed once, threshold 0.2
      Optional per element stagger: data-reveal-delay="100" (milliseconds)
   2. Nav scroll state: .site-nav gets .is-scrolled past 8px of scroll
   3. Current year: fills every [data-year] element
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- 1. Reveal on scroll ---------------------------------------------- */
  function initReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    // No IntersectionObserver, or the visitor asked for less motion:
    // show everything immediately.
    if (reduceMotion || !('IntersectionObserver' in window)) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('revealed');
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        // Threshold 0.2 per the brief. Blocks taller than the viewport can
        // never reach 20 percent visible, so those reveal as soon as they
        // touch the viewport.
        var tall = entry.boundingClientRect.height > window.innerHeight * 0.75;
        if (entry.intersectionRatio < 0.2 && !tall) return;

        var el = entry.target;
        var delay = el.getAttribute('data-reveal-delay');
        if (delay) el.style.setProperty('--reveal-delay', parseInt(delay, 10) + 'ms');
        el.classList.add('revealed');
        observer.unobserve(el); // once, never again
      });
    }, { threshold: [0, 0.2], rootMargin: '0px 0px -5% 0px' });

    for (var j = 0; j < items.length; j++) {
      // Anything already on screen at load reveals without waiting for a scroll.
      observer.observe(items[j]);
    }
  }

  /* ---- 2. Nav scroll state ---------------------------------------------- */
  function initNav() {
    var nav = document.querySelector('.site-nav');
    if (!nav) return;
    var ticking = false;

    function apply() {
      nav.classList.toggle('is-scrolled', window.pageYOffset > 8);
      ticking = false;
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    }

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---- 3. Current year --------------------------------------------------- */
  function initYear() {
    var year = String(new Date().getFullYear());
    var slots = document.querySelectorAll('[data-year]');
    for (var i = 0; i < slots.length; i++) slots[i].textContent = year;
  }

  function boot() {
    initReveal();
    initNav();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
