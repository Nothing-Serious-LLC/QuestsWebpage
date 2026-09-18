(function () {
  'use strict';

  var body = document.body;
  var staticMode = /[?&]static=1/.test(window.location.search);

  /* Science card presentation, for review: ?facts=corner | tint | ink */
  var factsPick = /[?&]facts=(corner|tint|ink)/.exec(window.location.search);
  if (factsPick) document.documentElement.setAttribute('data-facts', factsPick[1]);

  var reducedMotion = staticMode || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---- Reload starts the page over. Browsers restore the old scroll offset on
     reload, which put the intro on top of whatever section you were reading.
     Deep links (#science) still land where they point. ---- */
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  var navEntry = (window.performance && performance.getEntriesByType) ? performance.getEntriesByType('navigation')[0] : null;
  var isReload = navEntry ? navEntry.type === 'reload' : (window.performance && performance.navigation && performance.navigation.type === 1);
  if (isReload && window.location.hash) {
    /* A reload is "start over": drop a stale #section from an earlier click. */
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  if (!window.location.hash) window.scrollTo(0, 0);

  /* ---- Intro: the five glyphs hop (560ms + 360ms stagger), hold a beat, fade
     out, and the hero copy follows on its own delays. ---- */
  function ready() {
    body.classList.add('is-ready');
    body.classList.remove('is-pending');
    /* body.is-pending locks scrolling, so a deep link has to be honored here,
       once the page can scroll. */
    var target = window.location.hash && document.getElementById(window.location.hash.slice(1));
    if (!target) {
      /* Guard against WebKit re-applying a stale offset once the page grows. */
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          if ((window.pageYOffset || 0) > 0) window.scrollTo(0, 0);
        });
      });
    }
    if (target) {
      /* Jump now, again two frames on (WebKit lifts the body's overflow lock
         on its next style flush), and once more on a timer for views whose
         frame clock is paused while hidden. */
      var jump = function () {
        var pad = parseFloat(window.getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
        var top = target.getBoundingClientRect().top + (window.pageYOffset || 0) - pad;
        window.scrollTo({ top: Math.max(0, top), left: 0, behavior: 'instant' });
      };
      jump();
      window.requestAnimationFrame(function () { window.requestAnimationFrame(jump); });
      window.setTimeout(jump, 300);
    }
  }
  if (reducedMotion) {
    ready();
  } else {
    /* Hold the intro until the hop has played AND the serif face and the first
       phone screen are in, so the hero never appears in a fallback font or
       with an empty device. Capped so a slow network cannot stall the page. */
    var firstScreen = document.querySelector('.phone__screen img');
    var fontsIn = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    var screenIn = new Promise(function (resolve) {
      if (!firstScreen || firstScreen.complete) return resolve();
      firstScreen.addEventListener('load', resolve, { once: true });
      firstScreen.addEventListener('error', resolve, { once: true });
    });
    var minHold = new Promise(function (resolve) { window.setTimeout(resolve, 1250); });
    var cap = new Promise(function (resolve) { window.setTimeout(resolve, 2600); });
    Promise.race([Promise.all([minHold, fontsIn, screenIn]), cap]).then(ready, ready);
  }

  /* ---- Download goes straight to the store for this device. ---- */
  var storeLinks = document.querySelectorAll('[data-store-link]');
  if (storeLinks.length && /android/i.test(navigator.userAgent)) {
    Array.prototype.forEach.call(storeLinks, function (a) {
      a.href = 'https://play.google.com/store/apps/details?id=info.nothingserious.quests';
    });
  }

  /* ---- Reviews marquee: clone the track once so the loop is seamless. ---- */
  var marquee = document.querySelector('[data-marquee]');
  if (marquee && !reducedMotion) {
    var track = marquee.firstElementChild;
    var clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.removeAttribute('aria-label');
    marquee.appendChild(clone);
  }

  /* ---- Hero phones: a little 3D. With a mouse the fan tilts toward the
     pointer; on touch it tilts a few degrees as you scroll past. The bob is
     pure CSS. Both write --tilt-x / --tilt-y on the .phones wrapper. ---- */
  var tilt = document.querySelector('[data-tilt]');
  if (tilt && !reducedMotion) {
    var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var tiltX = 0, tiltY = 0, tiltFrame = 0;
    function applyTilt() {
      tiltFrame = 0;
      tilt.style.setProperty('--tilt-x', tiltX.toFixed(2) + 'deg');
      tilt.style.setProperty('--tilt-y', tiltY.toFixed(2) + 'deg');
    }
    function queueTilt() { if (!tiltFrame) tiltFrame = window.requestAnimationFrame(applyTilt); }
    if (finePointer) {
      var hero = tilt.closest('.hero') || tilt;
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width - 0.5;   /* -0.5 .. 0.5 */
        var ny = (e.clientY - r.top) / r.height - 0.5;
        tiltX = nx * 10; tiltY = ny * -8;
        queueTilt();
      });
      hero.addEventListener('pointerleave', function () { tiltX = 0; tiltY = 0; queueTilt(); });
    } else {
      window.addEventListener('scroll', function () {
        var y = window.pageYOffset || 0;
        tiltY = Math.max(-6, Math.min(0, y * -0.02));
        queueTilt();
      }, { passive: true });
    }
  }

  /* ---- Item reveal: stagger by position in the list, then place on scroll. ---- */
  var reveals = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  reveals.forEach(function (el) {
    var siblings = el.parentNode ? Array.prototype.slice.call(el.parentNode.children) : [el];
    var index = siblings.indexOf(el);
    var step = el.parentNode && el.parentNode.getAttribute ? Number(el.parentNode.getAttribute('data-stagger')) || 60 : 60;
    el.style.setProperty('--delay', Math.min(index, 5) * step + 'ms');
  });

  if (reducedMotion) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* Reversible reveal. An item is "in" while any of it sits inside the middle
     band of the viewport (top 8% and bottom 10% excluded). Above that band it
     takes .is-above so it re-enters from the top when scrolling back. */
  function placeReveals(vh) {
    var enterLine = vh * 0.9;
    var leaveLine = vh * 0.08;
    reveals.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var inView = r.top < enterLine && r.bottom > leaveLine;
      var above = r.bottom <= leaveLine;
      if (inView) {
        el.classList.add('is-visible');
        el.classList.remove('is-above');
      } else {
        el.classList.remove('is-visible');
        el.classList.toggle('is-above', above);
      }
    });
  }

  /* ---- Section fade: each section fades in from the bottom edge and out at the top.
     --fade goes 0..1 over a band that is a fraction of the viewport, so the
     transition is clear on a phone and on a wide desktop alike. ---- */
  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-fade]'));
  var backdrop = document.querySelector('.backdrop');
  var ticking = false;

  function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }

  function paint() {
    ticking = false;
    var vh = window.innerHeight || 1;
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;

    if (backdrop) backdrop.style.setProperty('--sy', y + 'px');
    placeReveals(vh);

    var maxY = Math.max(0, (document.documentElement.scrollHeight || 0) - vh);

    /* On a phone each section is about one screen tall and only one may be
       on stage at a time: a section is fully out before its neighbour starts
       in. Leave runs while the bottom edge drops from 78% to 58% of the
       viewport; enter runs while the top edge climbs from 52% to 32%. Wide
       screens use the same shape with slightly longer bands (leave 72% to 50%,
       enter 46% to 24%), so nothing from the section above is left on screen
       once the next one starts to show. */
    var phone = (window.innerWidth || 0) <= 600;
    var enterFrom = phone ? 0.52 : 0.46, enterBand = phone ? vh * 0.20 : vh * 0.22;
    var leaveTo = phone ? 0.58 : 0.50, leaveBand = phone ? vh * 0.20 : vh * 0.22;

    sections.forEach(function (section, si) {
      var rect = section.getBoundingClientRect();
      var last = si === sections.length - 1;
      var mode = section.getAttribute('data-fade');
      /* Fade in as the top edge climbs. The last section can run out of page
         before it finishes, so its band is squeezed to the scroll that is left. */
      var startY = rect.top + y - vh * enterFrom;
      var span = Math.min(enterBand, Math.max(1, maxY - startY));
      var enter = mode === 'out' ? 1 : clamp01((y - startY) / span);
      /* Fade out as the bottom edge leaves. The final section may never get
         there, so its band shrinks to the scroll that remains and it stays lit
         at the bottom of the page. Earlier sections always leave in full. */
      var bottomAtEnd = rect.bottom - (maxY - y) - vh * leaveTo;
      var leaveSpan = last && bottomAtEnd > 0 ? Math.min(leaveBand, bottomAtEnd) : leaveBand;
      var leave = clamp01((rect.bottom - vh * leaveTo) / leaveSpan);
      var fade = Math.min(enter, leave);
      section.style.setProperty('--fade', fade.toFixed(3));
    });
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(paint);
    }
  }

  /* Some embedded browsers throttle scroll events; a frame loop that only
     repaints when scrollY moved keeps the fades in step with the page. */
  var lastY = -1;
  function watch() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (y !== lastY) {
      lastY = y;
      paint();
    }
    window.requestAnimationFrame(watch);
  }

  if (!reducedMotion) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    paint();
    window.requestAnimationFrame(watch);
  }

  /* ---- ?tour=1: a slow scripted scroll to the end, for screen recordings and
     smoothness checks. Starts after the intro; ~45s on a phone-height page. ---- */
  if (/[?&]tour=1/.test(window.location.search)) {
    window.setTimeout(function () {
      var start = null, from = 0;
      var to = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      var ms = Math.min(60000, Math.max(20000, to * 9));
      function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
      function step(ts) {
        if (start === null) start = ts;
        var t = Math.min(1, (ts - start) / ms);
        window.scrollTo({ top: from + (to - from) * ease(t), left: 0, behavior: 'instant' });
        if (t < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    }, 4200);
  }


  /* ---- Five ways: the Home card stack -------------------------------------
     A port of the app's stackGeometry.ts. The deck has one continuous position
     P; card i sits at r = (i + P) mod N. r in [0, N-1] is the resting stack
     (rank 0 in front, each rank behind peeks --peek px higher and narrows);
     r in (N-1, N) is "the lane", the arc a card travels from the back of the
     deck up, over, and down onto the front. Drag left to send the front card
     to the back, right to bring the back card forward. ---- */
  var deckRoot = document.querySelector('[data-deck]');
  if (deckRoot) (function () {
    var stage = deckRoot.querySelector('.deck__stage');
    var cards = Array.prototype.slice.call(deckRoot.querySelectorAll('[data-deck-card]'));
    var N = cards.length;
    var PEEK = 24, PEEK_DECAY = 6, MIN_STRIP = 24;
    var WIDTH_STEP = 38, WIDTH_STEP_DECAY = -11, MIN_WIDTH_STEP = 8;
    var MAX_ROT = 8, ARC_UP = 56, LANE_PEAK_FRACTION = 0.85, SEAT_ZONE = 0.25, SCALE_DIP = 0.04;
    var DIM_BASE = 0.10, DIM_PER_RANK = 0.10, MAX_DIM = 0.30;
    /* Arrow, tap and auto-advance travel: a slow, legible arc (the app's
       "silk" preset stretched for the larger desktop card). A drag release
       settles on its own shorter clock so the hand-off stays continuous. */
    var DRAG_SPAN = 0.6, COMMIT = 0.3, FLICK_VX = 500, TRAVEL_MS = 1100, SETTLE_MS = 640;
    var AUTO_MS = 4200, AUTO_REST_MS = 9000;

    var P = 0, target = 0, cardW = 346;
    var anim = null, lastUser = 0, autoTimer = null, inView = false;

    function gmod(a, n) { return ((a % n) + n) % n; }
    function lerp(a, b, m) { return a + (b - a) * m; }
    function tent(t) { return 1 - Math.abs(2 * t - 1); }
    function seat(t) { return Math.min(1, Math.max(0, (t - SEAT_ZONE) / (1 - 2 * SEAT_ZONE))); }
    function strip(rank) { return Math.max(MIN_STRIP, PEEK - Math.max(0, rank - 1) * PEEK_DECAY); }
    function rankY(rank) { var y = 0; for (var k = 1; k <= rank; k++) y -= strip(k); return y; }
    function rankReveal(rank) { return Math.max(0, 1 - rank); }
    function rankDim(rank) { return rank <= 0 ? 0 : Math.min(MAX_DIM, DIM_BASE + (rank - 1) * DIM_PER_RANK); }
    function laneOpacity(t) { var d = Math.abs(t - 0.5); return d >= 0.08 ? 1 : 0.1 + 0.9 * (d / 0.08); }
    function widthForRank(rank) {
      var inset = 0;
      for (var k = 1; k <= rank; k++) inset += Math.max(MIN_WIDTH_STEP, WIDTH_STEP - (k - 1) * WIDTH_STEP_DECAY);
      return cardW - inset;
    }
    function widthAt(r) {
      if (r > N - 1) return lerp(widthForRank(N - 1), widthForRank(0), r - (N - 1));
      var k = Math.floor(r + 1e-9), f = r - k, next = Math.min(N - 1, k + 1);
      return lerp(widthForRank(k), widthForRank(next), f);
    }
    function channels(r) {
      if (r > N - 1) {
        var t = r - (N - 1), k = tent(t), u = seat(t);
        return { x: -LANE_PEAK_FRACTION * cardW * k, y: rankY(N - 1) * (1 - t) - ARC_UP * k,
          scale: 1 - SCALE_DIP * tent(u), rot: -MAX_ROT * tent(u), opacity: laneOpacity(t),
          reveal: u, dim: rankDim(N - 1) * (1 - u), z: t < 0.5 ? 0 : N + 1 };
      }
      var kr = Math.min(N - 1, Math.floor(r + 1e-9)), f = Math.min(1, Math.max(0, r - kr)), nx = Math.min(N - 1, kr + 1), us = seat(f);
      return { x: 0, y: lerp(rankY(kr), rankY(nx), f), scale: 1, rot: 0, opacity: 1,
        reveal: lerp(rankReveal(kr), rankReveal(nx), us), dim: lerp(rankDim(kr), rankDim(nx), us), z: N - r };
    }

    /* Render writes only what changed. Cards keep the app's width model; the
       body is a fixed-width layer centered on the card (see .deck__body), so a
       moving deck re-lays-out nothing inside the cards. */
    var parts = cards.map(function (card) {
      return { card: card, body: card.querySelector('.deck__body'), peek: card.querySelector('.deck__peek'), dim: card.querySelector('.deck__dim'), last: {} };
    });
    function put(part, key, el, prop, value) {
      if (part.last[key] === value) return;
      part.last[key] = value;
      el.style[prop] = value;
    }
    function render() {
      parts.forEach(function (part, i) {
        var r = gmod(i + P, N);
        var c = channels(r);
        var w = Math.round(widthAt(r) * 2) / 2;
        put(part, 'w', part.card, 'width', w + 'px');
        put(part, 'l', part.card, 'left', ((cardW - w) / 2).toFixed(1) + 'px');
        put(part, 't', part.card, 'transform', 'translate3d(' + c.x.toFixed(1) + 'px,' + c.y.toFixed(1) + 'px,0) rotate(' + c.rot.toFixed(2) + 'deg) scale(' + c.scale.toFixed(4) + ')');
        put(part, 'o', part.card, 'opacity', c.opacity.toFixed(3));
        put(part, 'z', part.card, 'zIndex', String(Math.round(c.z * 10)));
        put(part, 'bo', part.body, 'opacity', c.reveal.toFixed(3));
        put(part, 'po', part.peek, 'opacity', (1 - c.reveal).toFixed(3));
        put(part, 'do', part.dim, 'opacity', c.dim.toFixed(3));
        var live = c.reveal > 0.05;
        if (live !== part.live) { part.live = live; part.card.classList.toggle('is-live', live); }
        var hidden = r < 0.5 || r > N - 0.5 ? 'false' : 'true';
        if (part.hidden !== hidden) { part.hidden = hidden; part.card.setAttribute('aria-hidden', hidden); }
      });
    }

    function measure() { cardW = stage.getBoundingClientRect().width || cardW; deckRoot.style.setProperty('--deck-w', cardW + 'px'); render(); }

    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
    /* Slow in, slow out: the card lifts off gently and seats gently. */
    function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function animateTo(to, ms, easing) {
      if (anim) window.cancelAnimationFrame(anim);
      target = to;
      if (reducedMotion) { P = to; render(); return; }
      var from = P, start = null, ease = easing || easeInOut;
      var dur = Math.min(TRAVEL_MS * Math.max(1, Math.abs(to - from)), 2200);
      if (ms) dur = ms;
      function step(now) {
        if (start === null) start = now;
        var t = Math.min(1, (now - start) / dur);
        P = lerp(from, to, ease(t));
        render();
        if (t < 1) anim = window.requestAnimationFrame(step); else { anim = null; P = to; render(); }
      }
      anim = window.requestAnimationFrame(step);
    }
    function settle(from, to, flick) {
      var remaining = Math.abs(to - from);
      var dur = Math.min(SETTLE_MS, Math.max(180, SETTLE_MS * remaining));
      animateTo(to, flick ? Math.max(150, dur * 0.7) : dur, easeOut);
    }
    /* Forward = the front card lifts off along the arc and lands at the back; P falls by one. */
    function advance(n) { lastUser = Date.now(); animateTo(Math.round(target) - n); }

    /* Drag. Horizontal travel of DRAG_SPAN * card width is one card. */
    var dragging = false, startX = 0, startY = 0, base = 0, lastX = 0, lastT = 0, vx = 0, decided = false;
    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      /* A running arrow animation keeps going until this turns into a real
         drag; a tap or a vertical scroll must never leave the deck parked
         between two positions. */
      dragging = true; decided = false; startX = lastX = e.clientX; startY = e.clientY; vx = 0; lastT = e.timeStamp;
      lastUser = Date.now();
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (!decided) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dy) > Math.abs(dx)) { dragging = false; return; }
        decided = true; stage.classList.add('is-dragging');
        if (anim) { window.cancelAnimationFrame(anim); anim = null; }
        base = P; startX = lastX = e.clientX;
        try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      }
      var dt = Math.max(1, e.timeStamp - lastT);
      vx = ((e.clientX - lastX) / dt) * 1000; lastX = e.clientX; lastT = e.timeStamp;
      P = base + dx / (DRAG_SPAN * cardW);
      render();
    });
    function release() {
      if (!dragging) return;
      dragging = false; stage.classList.remove('is-dragging');
      if (!decided) {
        /* Tap without a drag: if nothing is animating and the deck is off a
           whole position, glide it to its target. */
        if (!anim && Math.abs(P - Math.round(P)) > 1e-3) animateTo(Math.round(target), SETTLE_MS, easeOut);
        return;
      }
      var fraction = P - base, flick = Math.abs(vx) > FLICK_VX;
      var commit = Math.abs(fraction) > COMMIT || flick;
      var dir = Math.abs(fraction) >= 0.5 ? (fraction < 0 ? -1 : 1) : flick ? (vx < 0 ? -1 : 1) : (fraction < 0 ? -1 : 1);
      /* base can be fractional when the drag interrupted an animation; the deck always settles on a whole position. */
      var to = Math.round(commit ? base + dir : base);
      lastUser = Date.now();
      settle(P, to, flick && commit);
    }
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    /* Tap a peeking card to bring it to the front. */
    cards.forEach(function (card, i) {
      card.addEventListener('click', function (e) {
        if (decided) { decided = false; return; }
        if (anim) return; /* mid-animation taps are noise, not a choice of card */
        var r = gmod(i + P, N);
        if (r < 0.5) return;
        lastUser = Date.now();
        animateTo(Math.round(target) - Math.round(r));
      });
    });

    var prev = deckRoot.querySelector('[data-deck-prev]'), next = deckRoot.querySelector('[data-deck-next]');
    if (prev) prev.addEventListener('click', function () { advance(-1); });
    if (next) next.addEventListener('click', function () { advance(1); });
    deckRoot.setAttribute('tabindex', '0');
    deckRoot.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { advance(1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { advance(-1); e.preventDefault(); }
    });

    /* Auto-advance while the deck is on screen, resting after any touch. */
    function tick() {
      if (inView && !dragging && document.visibilityState === 'visible' && Date.now() - lastUser > AUTO_REST_MS) animateTo(Math.round(target) - 1);
    }
    if (!reducedMotion) {
      autoTimer = window.setInterval(tick, AUTO_MS);
      lastUser = Date.now() - AUTO_REST_MS + 2500;
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; }, { threshold: 0.5 }).observe(stage);
    } else { inView = true; }

    window.addEventListener('resize', measure);
    measure();
    /* Review hook: deck.__set(p) parks the deck at any position. */
    deckRoot.__set = function (p) { if (anim) { window.cancelAnimationFrame(anim); anim = null; } P = target = p; lastUser = Date.now(); render(); };
  }());

  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
}());
