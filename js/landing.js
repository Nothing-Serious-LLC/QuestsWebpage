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

  /* ---- Reviews marquee. One clock, every card. Each card sits in the flex
     track at its natural x and is translated left by a shared offset; once a
     card has fully left on the left it is shifted one lap to the right, so the
     ring of cards is continuous and there is never a gap. The loop pauses
     while the marquee is off screen or the tab is hidden and resumes from the
     same offset. ---- */
  var marquee = document.querySelector('[data-marquee]');
  /* Who owns a touch that began on the reviews: null while undecided (under
     DECIDE px of travel), true when the marquee takes it sideways, false when
     it is a clear vertical pull for the pager. A finger dragging a horizontal
     list rarely starts dead level, so anything up to about 55 degrees from
     level is sideways; the pager uses the same rule so the two never both
     claim, or both drop, the same touch. */
  var DECIDE = 14, VERT_RATIO = 1.5;
  function marqueeClaims(dx, dy) {
    if (Math.abs(dx) < DECIDE && Math.abs(dy) < DECIDE) return null;
    return Math.abs(dy) < Math.abs(dx) * VERT_RATIO;
  }
  if (marquee && !reducedMotion) (function () {
    var track = marquee.querySelector('.marquee__track');
    var cards = Array.prototype.slice.call(track.children);
    if (cards.length < 2) return;
    var gap = 0, lap = 0, offset = 0, speed = 0, last = 0, frame = 0, visible = false, view = 0;
    var rights = [], lefts = [], widths = [];
    var PARK = 160;   /* px past either edge where off-screen cards wait */

    function measure() {
      var cs = window.getComputedStyle(track);
      gap = parseFloat(cs.columnGap || cs.gap) || 0;
      lefts = cards.map(function (c) { return c.offsetLeft; });
      widths = cards.map(function (c) { return c.offsetWidth; });
      rights = cards.map(function (c, i) { return lefts[i] + widths[i] + gap; });
      view = marquee.clientWidth;
      /* One full ring, including the seam gap. From the cards' layout
         positions, never scrollWidth: that includes the translated cards, so
         a re-measure mid-loop (Safari fires resize when its toolbar shrinks)
         read a ring twice as long and opened a hole in it. */
      lap = rights[rights.length - 1];
      /* A fixed px/s, the same on every screen size. A lap-based speed ran a
         quarter slower on a phone, where the cards (and so the lap) are
         narrower. */
      speed = parseFloat(window.getComputedStyle(marquee).getPropertyValue('--marquee-speed')) || 90;
      offset = norm(offset);
    }

    function place() {
      for (var i = 0; i < cards.length; i++) {
        /* Ring position: a card that has fully left on the left rides one lap
           to the right, after the last card. */
        var x = lefts[i] - offset;
        if (x + widths[i] + gap <= 0) x += lap;
        /* Cards well outside the viewport are parked just past the nearer
           edge instead of thousands of px away. Safari drops the backing
           store of a layer that far out and needs a few frames to paint it
           again when it jumps back, which showed as a hole in the strip on a
           fast backwards fling. Parked within PARK of the edge they stay
           painted, and any repositioning happens where it cannot be seen. */
        if (x > view + PARK) {
          var offRight = x - view, offLeft = lap - x - widths[i];
          x = offLeft < offRight ? Math.max(x - lap, -(widths[i] + PARK)) : view + PARK;
        } else if (x < -(widths[i] + PARK)) {
          x = -(widths[i] + PARK);
        }
        /* The card already sits at lefts[i] in the flex track; translate by the difference. */
        cards[i].style.transform = 'translate3d(' + (x - lefts[i]).toFixed(2) + 'px, var(--mq-y, 0px), 0)';
      }
    }

    var marqueeScreen = marquee.closest ? marquee.closest('.section') : null;
    /* Drag to browse. The finger (or mouse) moves the ring directly; on
       release its speed carries on as inertia that decays back into the
       drift (about 0.7s to settle), the ring never stops or gaps. A drag can
       go either way; the ring is continuous in both directions. */
    var dragging = false, decided = false, dragX = 0, dragY = 0, dragLastX = 0, dragLastT = 0, dragV = 0, inertia = 0;
    var INERTIA_TAU = 0.45;        /* seconds, exponential decay of the fling */
    function norm(x) { return ((x % lap) + lap) % lap; }
    function tick(now) {
      frame = 0;
      if (!visible || document.visibilityState !== 'visible') { last = 0; return; }
      /* Under the pager every screen is stacked in view; only run while this
         screen is the one showing. */
      if (marqueeScreen && document.documentElement.hasAttribute('data-snap') && !marqueeScreen.classList.contains('is-current')) {
        last = 0; frame = window.requestAnimationFrame(tick); return;
      }
      if (last && !dragging) {
        /* Real elapsed time up to 120ms: a dropped frame or two must not
           slow the ring (capping at one frame made it crawl on a busy phone). */
        var dt = Math.min(120, now - last) / 1000;
        offset = norm(offset + dt * (speed + inertia));
        inertia *= Math.exp(-dt / INERTIA_TAU);
        if (Math.abs(inertia) < 2) inertia = 0;
      }
      last = now;
      place();
      frame = window.requestAnimationFrame(tick);
    }
    function run() { if (!frame) frame = window.requestAnimationFrame(tick); }

    marquee.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      dragging = false; decided = false;
      dragX = dragLastX = e.clientX; dragY = e.clientY; dragLastT = e.timeStamp; dragV = 0;
      marquee.setAttribute('data-pressed', '');
    });
    window.addEventListener('pointermove', function (e) {
      if (!marquee.hasAttribute('data-pressed')) return;
      var dx = e.clientX - dragX, dy = e.clientY - dragY;
      if (!decided) {
        var claim = marqueeClaims(dx, dy);
        if (claim === null) return;
        decided = true;
        /* A clearly vertical move belongs to the pager; let go of it. */
        if (!claim) { marquee.removeAttribute('data-pressed'); return; }
        dragging = true; inertia = 0; marquee.classList.add('is-dragging');
        try { marquee.setPointerCapture(e.pointerId); } catch (err) {}
        dragLastX = e.clientX; dragLastT = e.timeStamp;
        return;
      }
      if (!dragging) return;
      var step = e.clientX - dragLastX, dt = Math.max(1, e.timeStamp - dragLastT);
      dragV = dragV * 0.3 + (-step / dt * 1000) * 0.7;    /* px per second, leftward positive */
      dragLastX = e.clientX; dragLastT = e.timeStamp;
      offset = norm(offset - step);
      place();
    });
    function dragEnd(e) {
      if (!marquee.hasAttribute('data-pressed')) return;
      marquee.removeAttribute('data-pressed');
      if (!dragging) return;
      dragging = false; marquee.classList.remove('is-dragging');
      try { marquee.releasePointerCapture(e.pointerId); } catch (err) {}
      /* The fling keeps the finger's direction and speed (capped), then eases
         back into the drift. A finger that let go slowly while moving with the
         drift (or barely moving at all) hands straight back to the drift; it
         must not leave the ring crawling for a second while inertia recovers. */
      var v = Math.max(-2400, Math.min(2400, dragV));
      inertia = (v >= 0 && v < speed) ? 0 : v - speed;
      last = 0;
    }
    window.addEventListener('pointerup', dragEnd);
    window.addEventListener('pointercancel', dragEnd);
    /* A drag must not read as a click on whatever card it ended on. */
    marquee.addEventListener('click', function (e) { if (decided && Math.abs(e.clientX - dragX) > 8) { e.preventDefault(); e.stopPropagation(); } }, true);

    measure(); place();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) run();
      }, { rootMargin: '120px 0px' }).observe(marquee);
    } else { visible = true; run(); }
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && visible) run(); });
    window.addEventListener('resize', function () { measure(); place(); });
  }());

  /* ---- Hero phones: a little 3D. With a mouse the fan tilts toward the
     pointer; on touch it tilts a few degrees as you scroll past. Both write
     --tilt-x / --tilt-y on the .phones wrapper. ---- */
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
    if (document.documentElement.hasAttribute('data-snap')) return;   /* the pager stages reveals by screen */
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
  var pagerOff = reducedMotion || /[?&]snap=0/.test(window.location.search);
  if (pagerOff) document.documentElement.removeAttribute('data-snap');

  if (pagerOff && /[?&]tour=1/.test(window.location.search)) {
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

  /* ---- Pager: one section per gesture ------------------------------------------
     html[data-snap] (see landing.css) stacks every section in one
     viewport-sized frame and stops the document scrolling. The wheel, a swipe
     and the keys move an index; the CSS stages each screen's content by class
     (is-before / is-current / is-after), so a page turn is only opacity and a
     short transform on content that already sits inside the viewport. The
     item reveals inside the arriving screen are re-run so they stagger in.
     Screens that are not current are inert. If any screen's content is taller
     than the viewport (a short desktop window), or with ?snap=0 or reduced
     motion, the page falls back to native scrolling. ---- */
  var pagerEl = document.querySelector('.pager');
  if (!pagerOff && pagerEl && document.documentElement.hasAttribute('data-snap')) (function () {
    var html = document.documentElement;
    var screens = Array.prototype.slice.call(document.querySelectorAll('main > .hero, main > .section'));
    var footer = document.querySelector('.footer');
    var phone = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    /* On a phone the footer is its own screen (one more swipe past Start
       together) instead of sharing the last screen; on desktop it stays
       pinned under the CTA. */
    if (footer && (window.innerWidth || 0) <= 600) {
      footer.classList.add('is-screen');
      html.classList.add('footer-screen');
      screens.push(footer);
      footer = null;
    }
    var MS = phone ? 820 : 900, OUT_MS = 260, COOLDOWN = 60, WHEEL_MIN = 6, SWIPE_MIN = 24;   /* OUT_MS: the leaving screen is fully gone before the next one starts */
    var index = 0, active = true, moving = false, quietUntil = 0, wheelAcc = 0, wheelLast = 0, settle = 0;
    html.style.setProperty('--page-ms', MS + 'ms');
    html.style.setProperty('--out-ms', OUT_MS + 'ms');

    function fitFooter() {
      if (footer) html.style.setProperty('--footer-h', footer.getBoundingClientRect().height + 'px');
    }
    fitFooter();
    if (window.ResizeObserver && footer) new ResizeObserver(fitFooter).observe(footer);

    function vh() { return window.innerHeight || 1; }
    /* Every screen's content must fit its frame, or paging would hide some. */
    function fits() {
      return screens.every(function (s) {
        /* Sum the flow children (not scrollHeight: a card mid-arc or a
           reveal in flight would count as overflow). */
        var cs = window.getComputedStyle(s), h = 0;
        Array.prototype.forEach.call(s.children, function (c) {
          var m = window.getComputedStyle(c);
          if (m.position === 'absolute' || m.position === 'fixed') return;
          h += c.offsetHeight + (parseFloat(m.marginTop) || 0) + (parseFloat(m.marginBottom) || 0);
        });
        return h + (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) <= s.clientHeight + 2;
      });
    }

    function setInert(el, on) {
      if (on === el.hasAttribute('inert')) return;
      if (on) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
      else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
    }

    /* Re-run the staggered item reveals inside the arriving screen. Items come
       from below when paging down and from above when paging up. */
    function stage(section, on, dir) {
      var items = Array.prototype.slice.call(section.querySelectorAll('[data-reveal]'));
      if (!on) { items.forEach(function (el) { el.classList.remove('is-visible'); el.classList.remove('is-above'); }); return; }
      items.forEach(function (el) { el.classList.remove('is-visible'); el.classList.toggle('is-above', dir < 0); });
      /* Items start rising only once the leaving screen has fully faded, so
         two screens are never on stage at the same time. */
      window.setTimeout(function () {
        items.forEach(function (el) { el.classList.add('is-visible'); el.classList.remove('is-above'); });
      }, OUT_MS + 40);
    }

    function show(i, dir, instant) {
      i = Math.max(0, Math.min(screens.length - 1, i));
      var changed = i !== index;
      index = i;
      var last = i === screens.length - 1;
      screens.forEach(function (s, k) {
        s.classList.toggle('is-current', k === i);
        s.classList.toggle('is-before', k < i);
        s.classList.toggle('is-after', k > i);
      });
      if (footer) {
        footer.classList.toggle('is-current', last);
        footer.classList.toggle('is-after', !last);
      }
      /* The arriving screen wakes now; the others go inert once the turn has
         settled (below), so the style work for a whole subtree never lands
         on the first frame of the fade. */
      setInert(screens[i], false);
      if (footer && last) setInert(footer, false);
      if (backdrop) backdrop.style.setProperty('--sy', (i * vh()) + 'px');
      if (instant) {
        screens.forEach(function (s, k) { stage(s, k === i, 1); setInert(s, k !== i); });
        if (footer) setInert(footer, !last);
        return;
      }
      if (!changed) return;
      stage(screens[i], true, dir);
      moving = true;
      window.clearTimeout(settle);
      settle = window.setTimeout(function () {
        moving = false; quietUntil = performance.now() + COOLDOWN;
        /* Reset the items of the screens that left only now, once their
           content layer is fully faded; touching them mid-fade made the
           departing content cut out in Safari. */
        screens.forEach(function (s, k) { if (k !== index) { stage(s, false, dir); setInert(s, true); } });
        if (footer) setInert(footer, index !== screens.length - 1);
        clearCarry();
      }, MS);
    }
    /* One swipe, one screen. A swipe during a turn is dropped for the first
       LOCK of it and taken after that (the fade simply retargets), so quick
       successive swipes still register without stacking up. */
    var turnAt = 0, LOCK = MS * 0.6;
    function canGo(dir) {
      if (!active) return false;
      if ((moving && performance.now() - turnAt < LOCK) || performance.now() < quietUntil) return false;
      var i = index + dir;
      return i >= 0 && i < screens.length;
    }
    function go(dir) {
      if (!canGo(dir)) return false;
      turnAt = performance.now();
      show(index + dir, dir, false);
      return true;
    }

    /* Native scrolling takes over when a screen cannot fit. */
    function setActive(on) {
      if (on === active) return;
      active = on;
      if (on) {
        html.setAttribute('data-snap', '');
        unscroll();
        show(index, 1, true);
      } else {
        screens.concat(footer ? [footer] : []).forEach(function (s) {
          s.classList.remove('is-current'); s.classList.remove('is-before'); s.classList.remove('is-after');
          setInert(s, false);
        });
        html.removeAttribute('data-snap');
        window.scrollTo({ top: screens[index].offsetTop, behavior: 'instant' });
      }
    }

    /* Wheel and trackpad. One gesture is a burst of events; the first one
       that clears the threshold turns the page and the rest of the burst is
       swallowed. A new burst is anything after a 160ms pause. */
    window.addEventListener('wheel', function (e) {
      if (!active || e.ctrlKey) return;    /* pinch zoom */
      e.preventDefault();
      var now = performance.now();
      if (now - wheelLast > 160) wheelAcc = 0;
      wheelLast = now;
      if (moving || now < quietUntil) return;
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) >= WHEEL_MIN) { var dir = wheelAcc > 0 ? 1 : -1; wheelAcc = 0; go(dir); }
    }, { passive: false });

    /* Touch: the finger never scrolls the page. While it is down, the current
       screen's content follows it a little (damped, so it reads as a peek
       rather than a scroll, the way Swiper's followFinger and fullPage's
       drag-and-move do it). Once the finger has travelled COMMIT the page
       turns at once, mid-gesture, and the drag hands off into the normal
       turn. A short flick that lets go before that still turns on release
       (SWIPE_MIN). Anything shorter springs back. Horizontal drags (the card
       deck) pass. */
    var tx = 0, ty = 0, tracking = false, vertical = null, onMarquee = false, peeking = false, lastY = 0, lastT = 0, vy = 0, peekOff = 0, trail = [];
    var CARRY = 90, CARRY_MS = 720, CARRY_EASE = 'cubic-bezier(0.25, 0.25, 0.2, 1)';   /* hand-off travel; the ease starts at slope 1 and only decelerates */
    var PEEK_MAX = 150, PEEK_K = 110, PEEK_DIM = 0.55, SPRING_MS = 360, FLICK_VY = 0.3;   /* px per ms */
    /* vh() is Safari's inner height with its bars showing (about 680px on a
       6.1in phone), so 16% is roughly 110px of finger travel. */
    function COMMIT() { return Math.max(110, Math.min(170, vh() * 0.16)); }
    function peekLayers() {
      var s = screens[index];
      var out = [];
      var shell = s.querySelector(':scope > .shell');
      if (shell) out.push({ el: shell, move: true });
      var fade = s.querySelector(':scope > .fade');
      if (fade) out.push({ el: fade, move: false, vary: true });   /* marquee: its cards carry the offset (--mq-y), its box never moves */
      if (footer && index === screens.length - 1) out.push({ el: footer, move: true });
      return out;
    }
    function peek(dy) {
      /* dy < 0 is a pull upward (toward the next screen). Damped hyperbolic
         offset with a hard ceiling; smaller at the ends of the deck so the
         edge reads as a stop. */
      var edge = (dy < 0 && index === screens.length - 1) || (dy > 0 && index === 0);
      var max = edge ? PEEK_MAX * 0.45 : PEEK_MAX;
      var d = Math.abs(dy), off = max * d / (d + PEEK_K);
      var t = off / PEEK_MAX;
      peekLayers().forEach(function (l) {
        l.el.style.transition = 'none';
        var y = (dy < 0 ? -off : off);
        if (l.move) l.el.style.transform = 'translateY(' + y.toFixed(2) + 'px)';
        if (l.vary) l.el.style.setProperty('--mq-y', y.toFixed(2) + 'px');
        l.el.style.opacity = (1 - PEEK_DIM * t).toFixed(3);
      });
      peekOff = dy < 0 ? -off : off;
      peeking = true;
    }
    /* Ease a --mq-y offset back to zero (the cards read it every frame). */
    function springVar(el) {
      var from = parseFloat(el.style.getPropertyValue('--mq-y')) || 0, t0 = performance.now();
      if (!from) { el.style.removeProperty('--mq-y'); return; }
      (function step(now) {
        var k = Math.min(1, (now - t0) / SPRING_MS), e = 1 - Math.pow(1 - k, 3);
        if (k >= 1 || peeking) { if (!peeking) el.style.removeProperty('--mq-y'); return; }
        el.style.setProperty('--mq-y', (from * (1 - e)).toFixed(2) + 'px');
        window.requestAnimationFrame(step);
      })(t0);
    }
    function unpeek(spring) {
      if (!peeking) return;
      peeking = false;
      peekLayers().forEach(function (l) {
        if (spring) {
          l.el.style.transition = 'transform ' + SPRING_MS + 'ms cubic-bezier(0.2, 0.7, 0.2, 1), opacity ' + SPRING_MS + 'ms ease-out';
          l.el.style.transform = ''; l.el.style.opacity = '';
          if (l.vary) springVar(l.el);
          window.setTimeout(function () { if (!peeking) l.el.style.transition = ''; }, SPRING_MS + 20);
        } else {
          /* Hand off: the outgoing content keeps going the way the finger
             sent it and fades on the way. The class-driven turn would have
             pulled it back toward its 40px rest offset, which read as the
             scroll being reset. CARRY_EASE starts at about finger speed
             (initial slope 1) and only slows, so there is no kick at the
             moment of commit. These inline styles win over the class until
             the turn settles and clearCarry() drops them. */
          var to = peekOff + (peekOff < 0 ? -CARRY : CARRY);
          l.el.style.transition = 'transform ' + CARRY_MS + 'ms ' + CARRY_EASE + ', opacity ' + OUT_MS + 'ms cubic-bezier(0.4, 0, 0.8, 1)';
          if (l.move) l.el.style.transform = 'translateY(' + to.toFixed(2) + 'px)';
          if (l.vary) glideVar(l.el, to);
          l.el.style.opacity = '0';
          carried.push(l.el);
        }
      });
      if (!spring) primeIncoming(peekOff < 0 ? 1 : -1);
    }
    /* The screen about to arrive starts a little further out, in the same
       direction of travel, and comes in once the leaving screen has fully
       faded (OUT_MS), so the two never overlap and the motion still reads as
       one continuous direction of travel. */
    function primeIncoming(dir) {
      var next = screens[index + dir];
      if (!next) return;
      var els = [];
      var shell = next.querySelector(':scope > .shell'); if (shell) els.push(shell);
      var fade = next.querySelector(':scope > .fade'); if (fade) els.push(fade);
      if (footer && index + dir === screens.length - 1) els.push(footer);
      els.forEach(function (el) {
        el.style.transition = 'none';
        if (el !== fade) el.style.transform = 'translateY(' + (dir > 0 ? CARRY : -CARRY) + 'px)';
        void el.offsetWidth;   /* flush so the transition below starts from here */
        el.style.transition = 'transform 640ms cubic-bezier(0.2, 0.7, 0.2, 1) ' + OUT_MS + 'ms, opacity 440ms cubic-bezier(0.2, 0.7, 0.2, 1) ' + OUT_MS + 'ms';
        el.style.transform = '';
        carried.push(el);
      });
    }
    /* Ease --mq-y from its current value to a target (the cards read it every frame). */
    function glideVar(el, to) {
      var from = parseFloat(el.style.getPropertyValue('--mq-y')) || 0, t0 = performance.now();
      (function step(now) {
        if (peeking) return;
        var k = Math.min(1, (now - t0) / CARRY_MS), e = 1 - Math.pow(1 - k, 3);
        el.style.setProperty('--mq-y', (from + (to - from) * e).toFixed(2) + 'px');
        if (k < 1) window.requestAnimationFrame(step);
      })(t0);
    }
    var carried = [];
    function clearCarry() {
      carried.forEach(function (el) { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; el.style.removeProperty('--mq-y'); });
      carried = [];
    }
    window.addEventListener('touchstart', function (e) {
      if (!active || e.touches.length !== 1) { tracking = false; return; }
      tracking = true; vertical = null; tx = e.touches[0].clientX; ty = lastY = e.touches[0].clientY; lastT = e.timeStamp; vy = 0;
      onMarquee = !!(marquee && e.target && marquee.contains(e.target));
      trail.length = 0; trail.push([e.timeStamp, ty]);
    }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (!tracking) return;
      var dx = e.touches[0].clientX - tx, dy = e.touches[0].clientY - ty;
      if (vertical === null) {
        if (onMarquee) {
          /* Same rule the marquee uses, so a drag it takes is one we leave. */
          var claim = marqueeClaims(dx, dy);
          if (claim !== null) vertical = !claim;
        } else if (Math.abs(dx) > 8 || Math.abs(dy) > 8) vertical = Math.abs(dy) >= Math.abs(dx);
      }
      /* Sideways on the reviews is the marquee's; keep Safari's own gesture
         handling (selection, callouts) out of it. */
      if (vertical === false) { if (onMarquee) e.preventDefault(); return; }
      e.preventDefault();
      if (vertical !== true) return;
      lastY = e.touches[0].clientY; lastT = e.timeStamp;
      trail.push([lastT, lastY]); if (trail.length > 12) trail.shift();
      var dir = dy < 0 ? 1 : -1;
      var canTurn = dir > 0 ? index < screens.length - 1 : index > 0;
      if (canTurn && Math.abs(dy) >= COMMIT()) {
        tracking = false;
        /* Hand off only if the turn will happen; otherwise spring back, so
           the content is never faded out with nothing arriving behind it. */
        if (canGo(dir)) { unpeek(false); go(dir); } else unpeek(true);
        return;
      }
      if (!moving) peek(dy);
    }, { passive: false });
    function release(e) {
      if (!tracking) return;
      tracking = false;
      if (vertical !== true) { unpeek(true); return; }
      var dy = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY - ty : 0;
      var dir = dy < 0 ? 1 : -1;
      var canTurn = dir > 0 ? index < screens.length - 1 : index > 0;
      /* A flick (fast, same direction, past the small minimum) turns on
         release; a slow pull that stopped short of COMMIT springs back. */
      /* Flick speed is the finger's travel over its last ~100ms, so one fast
         final sample cannot fake it, and only counts if the finger was still
         moving when it lifted. A pull that paused is judged on distance. */
      var k = trail.length - 1, endT = trail[k][0];
      while (k > 0 && endT - trail[k - 1][0] < 100) k--;
      var span = Math.max(1, endT - trail[k][0]);
      vy = trail.length > 1 ? (trail[trail.length - 1][1] - trail[k][1]) / span : 0;
      var flick = Math.abs(vy) >= FLICK_VY && (vy < 0) === (dy < 0) && (e.timeStamp - lastT) < 120;
      var far = Math.abs(dy) >= COMMIT() * 0.6;
      if (canTurn && ((Math.abs(dy) >= SWIPE_MIN && flick) || far) && canGo(dir)) { unpeek(false); go(dir); }
      else unpeek(true);
    }
    window.addEventListener('touchend', release);
    window.addEventListener('touchcancel', release);

    window.addEventListener('keydown', function (e) {
      if (!active || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName) && e.key === ' ') return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); go(-1); }
      else if (e.key === 'Home') { e.preventDefault(); show(0, -1, false); }
      else if (e.key === 'End') { e.preventDefault(); show(screens.length - 1, 1, false); }
    });

    /* In-page links (nav Download, footer) and a #hash on arrival. */
    function screenOf(hash) {
      var el = hash && hash.length > 1 ? document.getElementById(hash.slice(1)) : null;
      if (!el) return -1;
      for (var k = 0; k < screens.length; k++) if (screens[k] === el || screens[k].contains(el)) return k;
      return -1;
    }
    function jumpTo(hash, instant) {
      var k = screenOf(hash);
      if (k < 0) return false;
      show(k, k >= index ? 1 : -1, instant);
      return true;
    }
    document.addEventListener('click', function (e) {
      if (!active) return;
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      var href = a.getAttribute('href');
      if (screenOf(href) < 0) return;
      e.preventDefault();
      window.history.pushState(null, '', href);
      jumpTo(href, false);
    });
    /* A #hash makes the browser scroll the (overflow: hidden) root and body
       to the anchor; undo that, the pager does the moving. */
    function unscroll() {
      if (!active) return;
      var opt = { top: 0, left: 0, behavior: 'instant' };
      window.scrollTo(opt); html.scrollTo(opt); document.body.scrollTo(opt);
    }
    window.addEventListener('hashchange', function () { if (!active) return; unscroll(); jumpTo(window.location.hash, false); });
    window.addEventListener('scroll', unscroll, { passive: true });
    document.body.addEventListener('scroll', unscroll, { passive: true });
    window.addEventListener('load', unscroll);

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      fitFooter();
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        if (!active) { html.setAttribute('data-snap', ''); var ok = fits(); html.removeAttribute('data-snap'); if (ok) setActive(true); return; }
        if (!fits()) setActive(false);
        else if (backdrop) backdrop.style.setProperty('--sy', (index * vh()) + 'px');
      }, 120);
    });

    unscroll();
    var start = screenOf(window.location.hash);
    show(start < 0 ? 0 : start, 1, true);
    if (!fits()) setActive(false);

    /* Every screen's images are decoded up front, so the first arrival on a
       screen never pays for a decode mid-transition. */
    window.setTimeout(function () {
      Array.prototype.forEach.call(document.images, function (img) {
        if (img.decode) img.decode().catch(function () {});
      });
    }, 1800);

    /* ?tour=1 steps through the screens for a recording. */
    if (/[?&]tour=1/.test(window.location.search)) {
      window.setTimeout(function () {
        var iv = window.setInterval(function () { if (index >= screens.length - 1) { window.clearInterval(iv); return; } go(1); }, 4200);
      }, 4200);
    }
  }());

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
    /* The peek band and arc height come from the stylesheet (they shrink on
       a phone) so the label box and the band it sits in always agree. */
    function cssPx(name, fallback) { var v = parseFloat(window.getComputedStyle(deckRoot).getPropertyValue(name)); return isFinite(v) ? v : fallback; }
    var PEEK = cssPx('--peek', 24), PEEK_DECAY = 6, MIN_STRIP = PEEK;
    /* Corner radius before any inline write, so scaled cards can be given a
       larger radius and keep the same rounded corner on screen. */
    var RADIUS = parseFloat(window.getComputedStyle(cards[0]).borderRadius) || 24;
    var WIDTH_STEP = 38, WIDTH_STEP_DECAY = -11, MIN_WIDTH_STEP = 8;
    var MAX_ROT = 8, ARC_UP = cssPx('--arc', 56), LANE_PEAK_FRACTION = 0.85, SEAT_ZONE = 0.25, SCALE_DIP = 0.04;
    var DIM_BASE = 0.10, DIM_PER_RANK = 0.10, MAX_DIM = 0.30;
    /* Arrow, tap and auto-advance travel: a slow, legible arc (the app's
       "silk" preset stretched for the larger desktop card). A drag release
       settles on its own shorter clock so the hand-off stays continuous. */
    var DRAG_SPAN = 0.6, COMMIT = 0.3, FLICK_VX = 500, TRAVEL_MS = 1100, SETTLE_MS = 640;
    var AUTO_MS = 4200, AUTO_REST_MS = 9000;

    var P = 0, target = 0, cardW = 346;
    var anim = null, lastUser = 0, autoTimer = null, inView = false;
    var deckScreen = deckRoot.closest ? deckRoot.closest('.section') : null;

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

    /* Render writes only what changed, and only compositor properties: the
       app's width model becomes a uniform scale about the card's top edge
       (so the peeks stack exactly where the width model put them), and the
       peek label is counter-scaled so it keeps its size. Nothing lays out
       or repaints while the deck moves. */
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
        var s = widthAt(r) / cardW;
        put(part, 't', part.card, 'transform', 'translate3d(' + c.x.toFixed(1) + 'px,' + c.y.toFixed(1) + 'px,0) rotate(' + c.rot.toFixed(2) + 'deg) scale(' + (c.scale * s).toFixed(4) + ')');
        put(part, 'pt', part.peek, 'transform', 'scale(' + (1 / s).toFixed(4) + ')');
        /* Whole pixels only: a radius write repaints the card face, so it
           happens a dozen times across a travel, never every frame. */
        put(part, 'r', part.card, 'borderRadius', Math.round(RADIUS / s) + 'px');
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

    function measure() {
      cardW = stage.getBoundingClientRect().width || cardW;
      PEEK = cssPx('--peek', PEEK); MIN_STRIP = PEEK; ARC_UP = cssPx('--arc', ARC_UP);
      deckRoot.style.setProperty('--deck-w', cardW + 'px');
      render();
    }

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
        /* Off stage (the pager turned the page mid-travel) the deck seats at
           once: its card widths lay out every frame, work that would fight
           the page turn for the frame budget. */
        var t = onStage() ? Math.min(1, (now - start) / dur) : 1;
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
    function onStage() {
      /* Under the pager every screen is stacked in view; only this one counts. */
      if (deckScreen && document.documentElement.hasAttribute('data-snap')) return deckScreen.classList.contains('is-current');
      return inView;
    }
    function tick() {
      if (onStage() && !dragging && document.visibilityState === 'visible' && Date.now() - lastUser > AUTO_REST_MS) animateTo(Math.round(target) - 1);
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

  /* ---- Closing constellation ------------------------------------------------
     Each friend has a home position (percent of the field's half size) and a
     size, and holds its pattern around the line and the button. A slow,
     small drift keeps the group alive (larger on phones, where nothing else
     stirs them). On desktop the pointer is a field the faces avoid: every
     face inside REACH is pushed straight away from it, the nearer the
     further, and a face is never allowed under the cursor, so the group
     parts around it and closes again behind it. Faces are not clickable on
     desktop. On a phone, where there is no cursor, a tap pops a face off in
     a random direction and it springs back home.
     Everything is one translate3d + scale per face, on the compositor. */
  (function constellation() {
    var root = document.querySelector('[data-galaxy]');
    if (!root) return;
    var field = root.querySelector('.cta__field');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var screen = root.closest ? root.closest('.section') : null;
    var nodes = Array.prototype.slice.call(root.querySelectorAll('.cta__friend'));
    var friends = nodes.map(function (el, i) {
      el.style.setProperty('--s', el.getAttribute('data-s') + 'px');
      var ring = el.getAttribute('data-ring');
      if (ring) el.style.setProperty('--ring', 'url("' + ring + '")');
      return {
        el: el, hx: Number(el.getAttribute('data-x')) / 100, hy: Number(el.getAttribute('data-y')) / 100,
        mx: Number(el.getAttribute('data-mx') || el.getAttribute('data-x')) / 100, my: Number(el.getAttribute('data-my') || el.getAttribute('data-y')) / 100,
        s: Number(el.getAttribute('data-s')) || 72, z: Number(el.getAttribute('data-z')) || 0.8,
        ax: 5 + (i % 3) * 1.5, ay: 6 + ((i + 1) % 3) * 1.5,
        wx: 0.00038 + i * 0.00005, wy: 0.00046 + i * 0.00004, px: i * 1.7, py: i * 2.3,
        ro: 3 + (i % 3), wo: (i % 2 ? -1 : 1) * (0.00029 + i * 0.00003), po: i * 0.9,
        x: 0, y: 0, vx: 0, vy: 0, k: 1
      };
    });
    var W = 0, H = 0, L = 0, T = 0, k = 1, mx = null, my = null, frame = 0;
    var KICK = 13, REACH = 460, PUSH = 150, CLEAR = 28;
    var box = null, h2 = root.querySelector('h2'), btn = root.querySelector('.cta__button');
    function measure() {
      k = parseFloat(window.getComputedStyle(field).getPropertyValue('--k')) || 1;
      var r = field.getBoundingClientRect();
      W = r.width; H = r.height; L = r.left; T = r.top;
      /* The content box the faces must stay clear of, centred on the field. */
      if (h2 && btn) {
        var a = h2.getBoundingClientRect(), b = btn.getBoundingClientRect();
        box = { w: Math.max(a.width, b.width) + 16, h: (b.bottom - a.top) + 16 };
      }
    }
    /* Home position, kept inside the field with room for the drift, so a
       face never sits half off a narrow screen. */
    function home(f, axis) {
      var half = (axis ? H : W) / 2, r = f.s * k / 2 + 6 + (k < 1 ? 14 : 0);
      var v = (k < 1 ? (axis ? f.my : f.mx) : (axis ? f.hy : f.hx)) * half;
      return Math.max(-(half - r), Math.min(half - r, v));
    }
    function place(f, x, y, s) {
      f.el.style.transform = 'translate3d(' + (home(f, 0) + x).toFixed(2) + 'px,' + (home(f, 1) + y).toFixed(2) + 'px,0) scale(' + s.toFixed(3) + ')';
    }
    function seat() { friends.forEach(function (f) { place(f, 0, 0, 1); }); }
    function step(now) {
      frame = 0;
      var on = document.visibilityState === 'visible' &&
        !(screen && document.documentElement.hasAttribute('data-snap') && !screen.classList.contains('is-current'));
      if (!on) { frame = window.requestAnimationFrame(step); return; }
      var cx = L + W / 2, cy = T + H / 2, drift = k < 1 ? 1.5 : 1;
      for (var i = 0; i < friends.length; i++) {
        var f = friends[i];
        /* Idle: two slow sines plus a small circle, so each face wanders a
           little loop around home instead of ticking back and forth. */
        var ix = (Math.sin(now * f.wx + f.px) * f.ax + Math.cos(now * f.wo + f.po) * f.ro) * drift;
        var iy = (Math.sin(now * f.wy + f.py) * f.ay + Math.sin(now * f.wo + f.po) * f.ro) * drift;
        var tx = ix, ty = iy;
        if (mx !== null) {
          var fx = cx + home(f, 0) + f.x, fy = cy + home(f, 1) + f.y, rr = f.s * k / 2 + 8;
          var dx = fx - mx, dy = fy - my, d = Math.sqrt(dx * dx + dy * dy) || 1;
          if (d < REACH) {
            /* Radial push, strongest at the pointer, gone at REACH, and never
               less than what keeps the face clear of the cursor. */
            var g = 1 - d / REACH, p = PUSH * g * g * (0.7 + 0.3 * f.z);
            p = Math.max(p, rr + CLEAR - d);
            tx += dx / d * p; ty += dy / d * p;
          }
        }
        /* A fleeing face stays off the line and the button: if its target
           lands inside the content box, slide it out along its own direction. */
        if (box) {
          var px = home(f, 0) + tx, py = home(f, 1) + ty, r2 = f.s * k / 2;
          if (Math.abs(px) < box.w / 2 + r2 && Math.abs(py) < box.h / 2 + r2) {
            var sx = (box.w / 2 + r2) / Math.max(Math.abs(px), 1), sy = (box.h / 2 + r2) / Math.max(Math.abs(py), 1);
            var m = Math.min(sx, sy);
            tx = px * m - home(f, 0); ty = py * m - home(f, 1);
          }
        }
        /* Spring toward the target, with the kick velocity damped out. */
        f.vx = (f.vx + (tx - f.x) * 0.08) * 0.78; f.vy = (f.vy + (ty - f.y) * 0.08) * 0.78;
        f.x += f.vx; f.y += f.vy; f.k += (1 - f.k) * 0.14;
        place(f, f.x, f.y, f.k);
      }
      frame = window.requestAnimationFrame(step);
    }
    function pointer(e) { mx = e.clientX; my = e.clientY; }
    function leave() { mx = null; my = null; }
    function kick(e) {
      var el = e.target.closest ? e.target.closest('.cta__friend') : null;
      if (!el) return;
      var f = friends.filter(function (f) { return f.el === el; })[0];
      if (!f) return;
      /* Pop and dart off in a random direction, then spring home. */
      var a = Math.random() * Math.PI * 2;
      f.vx += Math.cos(a) * KICK; f.vy += Math.sin(a) * KICK; f.k = 1.38;
    }
    measure(); seat();
    if (reduce) { window.addEventListener('resize', function () { measure(); seat(); }); return; }
    window.addEventListener('pointermove', pointer, { passive: true });
    if (window.matchMedia('(hover: none)').matches) root.addEventListener('pointerdown', kick, { passive: true });
    window.addEventListener('pointerup', function () { if (window.matchMedia('(hover: none)').matches) leave(); }, { passive: true });
    window.addEventListener('pointercancel', leave, { passive: true });
    document.addEventListener('pointerleave', leave);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', function () { window.setTimeout(measure, 300); });
    /* The field's box changes as the section fades in under the pager; re-measure whenever it becomes current. */
    if (screen) new MutationObserver(function () { window.setTimeout(measure, 50); }).observe(screen, { attributes: true, attributeFilter: ['class'] });
    frame = window.requestAnimationFrame(step);
  }());

  /* ---- Press feedback -------------------------------------------------------
     Pointer down sinks the control in, release lets it out. Class-driven so
     a finger on iOS gets the same feel as a mouse, and mousedown's default
     is stopped so a press or a fast double click never selects text. */
  (function press() {
    var targets = document.querySelectorAll('.nav__cta, .cta__button, .store-row a, .deck__arrow');
    Array.prototype.forEach.call(targets, function (el) {
      function down() { el.classList.add('is-down'); }
      function up() { el.classList.remove('is-down'); }
      el.addEventListener('mousedown', function (e) { e.preventDefault(); });
      el.addEventListener('pointerdown', down, { passive: true });
      el.addEventListener('pointerup', up, { passive: true });
      el.addEventListener('pointercancel', up, { passive: true });
      el.addEventListener('pointerleave', up, { passive: true });
      el.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') down(); });
      el.addEventListener('keyup', up);
    });
    /* A press on a face should not start a selection either. */
    var galaxy = document.querySelector('[data-galaxy]');
    if (galaxy) galaxy.addEventListener('mousedown', function (e) { if (e.target.closest && e.target.closest('.cta__friend')) e.preventDefault(); });
  }());

  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
}());
