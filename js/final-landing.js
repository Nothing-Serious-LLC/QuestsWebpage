(function () {
  'use strict';

  var body = document.body;
  var doc = document.documentElement;
  var staticMode = /[?&]static=1/.test(window.location.search);
  var reducedMotion = staticMode || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  var skipIntro = reducedMotion;

  function finishIntro() {
    body.classList.add('final-ready');
    body.classList.remove('final-pending');
    var heroReveal = document.querySelector('.final-hero [data-final-reveal]');
    if (heroReveal) heroReveal.classList.add('is-visible');
  }

  if (skipIntro) {
    finishIntro();
  } else {
    window.setTimeout(finishIntro, 1100);
  }

  var reveals = document.querySelectorAll('[data-final-reveal]');
  var sections = document.querySelectorAll('[data-final-section]');

  if ('IntersectionObserver' in window && !reducedMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle('is-visible', entry.isIntersecting);
      });
    }, { rootMargin: '-8% 0px -8% 0px', threshold: .08 });

    reveals.forEach(function (item) {
      revealObserver.observe(item);
    });

    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle('is-visible', entry.isIntersecting);
      });
    }, { rootMargin: '-20% 0px -32% 0px', threshold: .05 });

    sections.forEach(function (section) {
      sectionObserver.observe(section);
    });
  } else {
    reveals.forEach(function (item) { item.classList.add('is-visible'); });
    sections.forEach(function (section) { section.classList.add('is-visible'); });
  }

  var hero = document.querySelector('.final-hero');
  var floats = document.querySelectorAll('[data-final-float]');
  var pointerX = 0;
  var pointerY = 0;
  var ticking = false;

  function numberValue(item, property, fallback) {
    var value = parseFloat(item.style.getPropertyValue(property));
    return isNaN(value) ? fallback : value;
  }

  function paint() {
    ticking = false;
    var scrollY = window.scrollY || window.pageYOffset || 0;
    var heroHeight = hero ? hero.offsetHeight : window.innerHeight;
    var progress = Math.max(0, Math.min(1, scrollY / Math.max(heroHeight * .78, 1)));

    body.classList.toggle('is-nav-compact', progress > .22);

    floats.forEach(function (item) {
      var depth = numberValue(item, '--depth', 1);
      var startX = numberValue(item, '--x', 50);
      var direction = startX < 50 ? -1 : 1;
      var x = pointerX * 18 * depth + direction * progress * 155 * depth;
      var y = pointerY * 14 * depth - progress * 88 * depth;
      item.style.setProperty('--float-x', x.toFixed(1) + 'px');
      item.style.setProperty('--float-y', y.toFixed(1) + 'px');
      item.style.opacity = String(Math.max(0, 1 - progress * 1.4));
    });

    var viewportMiddle = scrollY + window.innerHeight * .46;
    var closest = null;
    var closestDistance = Infinity;
    sections.forEach(function (section) {
      var middle = section.offsetTop + section.offsetHeight * .5;
      var distance = Math.abs(middle - viewportMiddle);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = section;
      }
    });

    document.querySelectorAll('.final-nav__links a').forEach(function (link) {
      link.classList.toggle('is-active', closest && link.getAttribute('href') === '#' + closest.id);
    });
  }

  function requestPaint() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(paint);
  }

  if (finePointer && hero) {
    hero.addEventListener('pointermove', function (event) {
      var rect = hero.getBoundingClientRect();
      pointerX = (event.clientX - rect.left) / rect.width - .5;
      pointerY = (event.clientY - rect.top) / rect.height - .5;
      requestPaint();
    }, { passive: true });

    hero.addEventListener('pointerleave', function () {
      pointerX = 0;
      pointerY = 0;
      requestPaint();
    }, { passive: true });
  }

  window.addEventListener('scroll', requestPaint, { passive: true });
  window.addEventListener('resize', requestPaint, { passive: true });
  requestPaint();

  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
  doc.classList.add('final-enhanced');
}());
