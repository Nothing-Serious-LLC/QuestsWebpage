/* ==========================================================================
   Quests V4 site behaviour: "The Journey"
   Vanilla, dependency free. The homepage loads it synchronously in <head> so
   the theme pin and the card's category land before first paint; every other
   page may keep using defer.

   0. QA hooks: ?static=1 pins light mode, the mindfulness card and a fully
      drawn path. ?world=<category> themes the CARD ONLY.
   1. Card rotation: one example quest per day, stable for the whole day. It
      touches the quest card and nothing else on the page.
   2. The journey path: one SVG path built from the measured milestone
      centres, drawn with stroke-dashoffset against scroll progress.
   3. Reveal on scroll: .reveal gets .revealed once. data-reveal-delay="100"
      staggers in milliseconds. Milestones pop as their section arrives.
   4. Marquee: pauses while hovered or focused, and while off screen.
   5. Current year: fills every [data-year].
   ========================================================================== */
(function () {
  'use strict';

  var doc = document.documentElement;
  var search = window.location.search;
  var staticMode = /[?&]static=1/.test(search);
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- 0. QA hooks -------------------------------------------------------
     ?static=1 renders everything instantly and pins light mode, so a headless
     capture is deterministic whatever the machine's OS preference is.
     ?theme=dark|light pins the other mode and composes with it, which is how
     dark-mode screenshots get taken without --force-dark-mode. [data-theme]
     is the same override hook a visible toggle will drive later. */
  if (staticMode) {
    doc.classList.add('u-static');
    doc.setAttribute('data-theme', 'light');
    reduceMotion = true;
  }
  var pinTheme = (search.match(/[?&]theme=(dark|light)/) || [])[1];
  if (pinTheme) doc.setAttribute('data-theme', pinTheme);

  /* ---- 1. Card rotation --------------------------------------------------
     The five worlds now theme exactly one object: the hero quest card, its
     medallion glyph and its quest name. The page base never changes. */
  var WORLDS = ['mindfulness', 'recharge', 'creativity', 'growth', 'social'];

  var QUESTS = {
    mindfulness: { name: 'Morning Meditation', duration: 'Day 12 of 30' },
    recharge:    { name: 'Cold Plunge',        duration: 'Day 6 of 14' },
    creativity:  { name: 'Daily Sketch',       duration: 'Day 9 of 30' },
    growth:      { name: 'Read 20 Pages',      duration: 'Day 21 of 30' },
    social:      { name: 'Sunday Run Club',    duration: 'Week 4 of 8' }
  };

  function dayOfYear(date) {
    var start = new Date(date.getFullYear(), 0, 0);
    return Math.floor((date - start) / 86400000);
  }

  var rotates = doc.hasAttribute('data-world-rotate');
  var world = doc.getAttribute('data-world') || 'mindfulness';

  if (rotates) {
    var index = staticMode ? 0 : ((dayOfYear(new Date()) % 5) + 5) % 5;
    var forced = (search.match(/[?&]world=([a-z]+)/) || [])[1];
    if (forced && WORLDS.indexOf(forced) !== -1) index = WORLDS.indexOf(forced);
    world = WORLDS[index];
    /* Kept on <html> for QA introspection only. Nothing in site.css reads it:
       the category class on the card is what does the theming now. */
    doc.setAttribute('data-world', world);
  }

  /* ---- 1b. Art pinning ---------------------------------------------------
     The gallery tiles swap through <picture media="(prefers-color-scheme:
     dark)">, which costs one fetch instead of two but answers to the OS
     rather than to [data-theme]. When the page has been pinned explicitly
     (today only ?static=1), retune those media queries so the art agrees
     with the UI. Everything else swaps in CSS and needs nothing here. */
  function initArt() {
    var pinned = doc.getAttribute('data-theme');
    if (!pinned) return;
    var sources = document.querySelectorAll('picture source[media]');
    for (var i = 0; i < sources.length; i++) {
      if (sources[i].media.indexOf('prefers-color-scheme: dark') === -1) continue;
      sources[i].media = pinned === 'dark' ? 'all' : 'not all';
    }
  }

  function initCard() {
    if (!rotates) return;
    var card = document.querySelector('[data-quest-card]');
    if (!card) return;

    var quest = QUESTS[world];
    if (!quest) return;

    for (var i = 0; i < WORLDS.length; i++) card.classList.remove('cat-' + WORLDS[i]);
    card.classList.add('cat-' + world);

    var name = card.querySelector('[data-quest-name]');
    var duration = card.querySelector('[data-quest-duration]');
    if (name) name.textContent = quest.name;
    if (duration) duration.textContent = quest.duration;

    var live = card.querySelector('[data-quest-a11y]');
    if (live) live.textContent = 'Hold to check in to ' + quest.name;

    /* Mindfulness keeps the lotus line icon, which is the app's own medallion
       for that category. Every other world uses its authentic gradient blob. */
    var glyph = card.querySelector('[data-quest-glyph]');
    if (glyph && world !== 'mindfulness') {
      var img = document.createElement('img');
      img.src = '/assets/img/icon-' + world + '.svg';
      img.alt = '';
      img.width = 32;
      img.height = 32;
      img.setAttribute('decoding', 'async');
      glyph.textContent = '';
      glyph.appendChild(img);
    }
  }

  /* ---- 2. The journey path ----------------------------------------------
     ONE <path> for the whole page. See the block comment in site.css for why
     a single measured path beats a segment per section: with one element
     there is no seam to get wrong at any width, and with a viewBox written in
     real pixels there is no scale factor to distort the 22px stroke.

     Anchors are the live centres of [data-journey-point] elements: the marker
     under the hero quest card, the five category milestones, and the gold
     complete milestone. CSS decides where those sit (a left/right weave on
     desktop, a single left rail on mobile); this only reads the result, so
     the geometry can never disagree with the layout. */
  function initJourney() {
    var wrap = document.querySelector('[data-journey]');
    if (!wrap) return;
    var svg = wrap.querySelector('[data-journey-svg]');
    var line = wrap.querySelector('[data-journey-line]');
    if (!svg || !line) return;

    var narrow = window.matchMedia ? window.matchMedia('(max-width: 900px)') : null;
    var length = 0;
    var endY = 0;       /* the gold milestone's y, where the road is finished */
    var ticking = false;
    var built = false;

    function round(n) { return Math.round(n * 10) / 10; }

    function points() {
      var box = wrap.getBoundingClientRect();
      var nodes = wrap.querySelectorAll('[data-journey-point]');
      var out = [];
      for (var i = 0; i < nodes.length; i++) {
        var r = nodes[i].getBoundingClientRect();
        out.push({
          x: r.left - box.left + r.width / 2,
          y: r.top - box.top + r.height / 2
        });
      }
      return out;
    }

    /* On the mobile rail every anchor shares one x, which would draw a ruler.
       A midpoint between each pair, nudged alternately left and right, turns
       it into the app's serpentine without moving a single milestone. */
    function inflate(p) {
      if (!narrow || !narrow.matches || p.length < 2) return p;
      var out = [p[0]];
      for (var i = 0; i < p.length - 1; i++) {
        var a = p[i], b = p[i + 1];
        var amp = Math.min(20, Math.abs(b.y - a.y) * 0.06) * (i % 2 ? -1 : 1);
        out.push({ x: (a.x + b.x) / 2 + amp, y: (a.y + b.y) / 2 });
        out.push(b);
      }
      return out;
    }

    /* Catmull-Rom through every anchor, emitted as cubic Beziers. The curve
       passes exactly through each milestone and is smooth across all of them,
       which is what makes the medallions read as stops on one road. */
    function spline(p) {
      if (p.length < 2) return '';
      var d = 'M' + round(p[0].x) + ' ' + round(p[0].y);
      for (var i = 0; i < p.length - 1; i++) {
        var p0 = p[i - 1] || p[i];
        var p1 = p[i];
        var p2 = p[i + 1];
        var p3 = p[i + 2] || p2;
        var t = 1 / 6;
        d += ' C' + round(p1.x + (p2.x - p0.x) * t) + ' ' + round(p1.y + (p2.y - p0.y) * t) +
             ' ' + round(p2.x - (p3.x - p1.x) * t) + ' ' + round(p2.y - (p3.y - p1.y) * t) +
             ' ' + round(p2.x) + ' ' + round(p2.y);
      }
      return d;
    }

    /* Measured against the LAST anchor rather than the wrapper's full height,
       so the road finishes exactly as the gold milestone arrives instead of
       still drawing while the reader is already past it. */
    function progress() {
      var r = wrap.getBoundingClientRect();
      var vh = window.innerHeight || doc.clientHeight;
      var p = (vh * 0.62 - r.top) / (endY || r.height || 1);
      return p < 0 ? 0 : (p > 1 ? 1 : p);
    }

    function paint() {
      ticking = false;
      if (!built) return;
      line.style.strokeDashoffset = round(length * (1 - progress()));
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(paint);
    }

    function build() {
      var w = wrap.offsetWidth;
      var h = wrap.offsetHeight;
      if (!w || !h) return;

      var pts = points();
      if (pts.length < 2) return;
      endY = pts[pts.length - 1].y;

      var d = spline(inflate(pts));
      if (!d) return;

      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      line.setAttribute('d', d);
      length = line.getTotalLength();
      line.style.strokeDasharray = round(length) + ' ' + round(length);
      built = true;

      /* Reduced motion and ?static=1 get the finished road, no scroll link. */
      if (reduceMotion) line.style.strokeDashoffset = '0';
      else paint();
    }

    build();

    /* The serif swaps in after first paint and every section gets taller, so
       one rebuild once the fonts have landed keeps the road on its stops. */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
    window.addEventListener('load', build);

    var resizeTimer = null;
    function onResize() {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(build, 140);
    }
    if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(document.body);
    window.addEventListener('resize', onResize, { passive: true });

    if (!reduceMotion) {
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  /* ---- 3. Reveal on scroll ---------------------------------------------- */
  function initReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('revealed');
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        // Blocks taller than the viewport can never reach 20 percent visible,
        // so those reveal as soon as they touch the viewport.
        var tall = entry.boundingClientRect.height > window.innerHeight * 0.75;
        if (entry.intersectionRatio < 0.2 && !tall) return;

        var el = entry.target;
        var delay = el.getAttribute('data-reveal-delay');
        if (delay) el.style.setProperty('--reveal-delay', parseInt(delay, 10) + 'ms');
        el.classList.add('revealed');
        observer.unobserve(el);
      });
    }, { threshold: [0, 0.2], rootMargin: '0px 0px -5% 0px' });

    for (var j = 0; j < items.length; j++) observer.observe(items[j]);
  }

  /* ---- 4. Marquee -------------------------------------------------------- */
  function initMarquee() {
    var rails = document.querySelectorAll('.marquee');
    if (!rails.length || reduceMotion) return;

    for (var i = 0; i < rails.length; i++) {
      (function (rail) {
        // Pause while the rail is off screen so it costs nothing to scroll past.
        if ('IntersectionObserver' in window) {
          var io = new IntersectionObserver(function (entries) {
            rail.classList.toggle('is-paused', !entries[0].isIntersecting);
          }, { threshold: 0 });
          io.observe(rail);
        }
        rail.addEventListener('pointerenter', function () { rail.classList.add('is-paused'); });
        rail.addEventListener('pointerleave', function () { rail.classList.remove('is-paused'); });
      }(rails[i]));
    }
  }

  /* ---- 5. Current year --------------------------------------------------- */
  function initYear() {
    var year = String(new Date().getFullYear());
    var slots = document.querySelectorAll('[data-year]');
    for (var i = 0; i < slots.length; i++) slots[i].textContent = year;
  }

  function boot() {
    initArt();
    initCard();
    initReveal();
    initJourney();
    initMarquee();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
