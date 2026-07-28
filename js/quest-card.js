/* ==========================================================================
   Quests V2: hold to check in card (the signature element)
   Vanilla, dependency free, safe to load with
   <script src="/js/quest-card.js" defer>. Styles live in css/site.css.

   HOW IT FEELS
   - Press and hold anywhere on the card. A category coloured fill rises from
     the bottom over 1.2s.
   - Hold all the way: quick spring, the medallion coin flips, the hint pill
     becomes "Checked in today" with a check in the category colour, and a
     small confetti burst fires once.
   - Let go early: the fill drains back.
   - 2.5s after a successful check in the card resets itself so the next
     visitor gets to try.
   - prefers-reduced-motion: a single tap toggles the checked state instantly,
     no fill animation, no confetti.
   - Keyboard: the press target is a real button. Hold Space or Enter.

   MARKUP CONTRACT (copy this, swap the category class, icon, name and meta)
   ---------------------------------------------------------------------------
   <article class="quest-card cat-mindfulness" data-quest-card>
     <span class="quest-card__fill" aria-hidden="true"></span>

     <div class="quest-card__inner">
       <div class="quest-card__head">
         <span class="medallion quest-card__medallion" data-quest-medallion>
           <img src="/assets/img/icon-mindfulness.svg" alt="" width="28" height="28">
         </span>
         <div>
           <h3 class="quest-card__name">Morning Run</h3>
           <p class="quest-card__meta">
             <span class="quest-card__streak">
               <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="..."/></svg>
               Day 12
             </span>
             <span class="avatar-stack" aria-hidden="true">
               <span></span><span></span><span></span>
               <span class="avatar-stack__more">+3</span>
             </span>
           </p>
         </div>
       </div>

       <p class="quest-card__hint" aria-hidden="true">
         <span class="quest-card__hint-idle">Hold to check in</span>
         <span class="quest-card__hint-done">
           Checked in today
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
             <path d="M4 12.5 9.5 18 20 6.5"/>
           </svg>
         </span>
       </p>
     </div>

     <button class="quest-card__press" type="button" aria-pressed="false" data-quest-press>
       <span class="u-sr-only" data-quest-a11y>Hold to check in to Morning Run</span>
     </button>

     <span class="quest-card__confetti" aria-hidden="true" data-quest-confetti></span>
   </article>
   ---------------------------------------------------------------------------
   Required hooks: [data-quest-card] root, .quest-card__fill, [data-quest-press].
   Optional hooks: [data-quest-confetti], [data-quest-a11y], [data-quest-medallion].
   The category class (.cat-mindfulness, .cat-recharge, .cat-creativity,
   .cat-growth, .cat-social) drives the fill, pill and check colours.
   State lives in data-state on the root: idle | holding | draining | checked.
   Reduced motion note: the confetti layer sits inside the card, which clips at
   its 40px radius, so dots travel a short distance and stay on the surface.
   ========================================================================== */
(function () {
  'use strict';

  var HOLD_MS = 1200;   // fill duration, matches the CSS transition
  var DRAIN_MS = 320;   // early release drain, matches the CSS transition
  var POP_MS = 460;     // spring
  var RESET_MS = 2500;  // polite reset after a successful check in
  var CONFETTI = ['#FFD400', '#FF3333', '#48FF48', '#3BCCFF'];

  var motionQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  function prefersReduced() { return !!motionQuery.matches; }

  function QuestCard(root) {
    var press = root.querySelector('[data-quest-press]');
    var confettiLayer = root.querySelector('[data-quest-confetti]');
    var a11yLabel = root.querySelector('[data-quest-a11y]');
    if (!press) return;

    var idleText = a11yLabel ? a11yLabel.textContent : '';
    var holdTimer = null;
    var drainTimer = null;
    var popTimer = null;
    var resetTimer = null;
    var holding = false;

    function clearTimer(t) { if (t) window.clearTimeout(t); return null; }

    function setState(state) {
      root.setAttribute('data-state', state);
      var checked = state === 'checked';
      press.setAttribute('aria-pressed', checked ? 'true' : 'false');
      if (a11yLabel) {
        a11yLabel.textContent = checked ? 'Checked in today' : idleText;
      }
    }

    function toIdle() {
      holding = false;
      holdTimer = clearTimer(holdTimer);
      drainTimer = clearTimer(drainTimer);
      resetTimer = clearTimer(resetTimer);
      setState('idle');
    }

    function start(event) {
      var checked = root.getAttribute('data-state') === 'checked';

      if (prefersReduced()) {
        // Tap toggles, instantly, both ways.
        if (checked) toIdle();
        else complete();
        return;
      }

      if (checked) return;

      if (holding) return;
      holding = true;
      drainTimer = clearTimer(drainTimer);
      setState('holding');
      if (event && event.pointerId !== undefined && press.setPointerCapture) {
        try { press.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
      }
      holdTimer = clearTimer(holdTimer);
      holdTimer = window.setTimeout(complete, HOLD_MS);
    }

    function release() {
      if (!holding) return;
      holding = false;
      holdTimer = clearTimer(holdTimer);
      if (root.getAttribute('data-state') !== 'holding') return;
      setState('draining');
      drainTimer = clearTimer(drainTimer);
      drainTimer = window.setTimeout(function () { setState('idle'); }, DRAIN_MS);
    }

    function complete() {
      holding = false;
      holdTimer = clearTimer(holdTimer);
      drainTimer = clearTimer(drainTimer);
      setState('checked');

      if (!prefersReduced()) {
        root.classList.add('is-pop');
        popTimer = clearTimer(popTimer);
        popTimer = window.setTimeout(function () { root.classList.remove('is-pop'); }, POP_MS);
        burst();
      }

      resetTimer = clearTimer(resetTimer);
      resetTimer = window.setTimeout(function () {
        if (prefersReduced()) {
          toIdle();
          return;
        }
        setState('draining');
        drainTimer = clearTimer(drainTimer);
        drainTimer = window.setTimeout(function () { setState('idle'); }, DRAIN_MS);
      }, RESET_MS);
    }

    /* Small one shot confetti burst, transform and opacity only. */
    function burst() {
      if (!confettiLayer) return;
      var count = 10;
      var frag = document.createDocumentFragment();
      var dots = [];

      for (var i = 0; i < count; i++) {
        var dot = document.createElement('i');
        dot.className = 'qc-dot';
        // upward fan, roughly 200deg of arc above the pill
        var angle = (-160 + (i / (count - 1)) * 140 + (Math.random() * 16 - 8)) * Math.PI / 180;
        var dist = 42 + Math.random() * 46;
        dot.style.background = CONFETTI[i % CONFETTI.length];
        dot.style.setProperty('--dx', Math.round(Math.cos(angle) * dist) + 'px');
        dot.style.setProperty('--dy', Math.round(Math.sin(angle) * dist) + 'px');
        dot.style.setProperty('--rot', Math.round(Math.random() * 300 - 150) + 'deg');
        dot.style.animationDelay = (i * 12) + 'ms';
        frag.appendChild(dot);
        dots.push(dot);
      }

      confettiLayer.appendChild(frag);
      window.setTimeout(function () {
        for (var j = 0; j < dots.length; j++) {
          if (dots[j].parentNode) dots[j].parentNode.removeChild(dots[j]);
        }
      }, 1200);
    }

    /* ---- Pointer (mouse, touch, pen) ---- */
    press.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      start(e);
    });
    press.addEventListener('pointerup', release);
    press.addEventListener('pointercancel', release);
    press.addEventListener('pointerleave', release);
    press.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    press.addEventListener('dragstart', function (e) { e.preventDefault(); });

    /* ---- Keyboard: hold Space or Enter ---- */
    press.addEventListener('keydown', function (e) {
      if (e.key !== ' ' && e.key !== 'Spacebar' && e.key !== 'Enter') return;
      e.preventDefault();
      if (e.repeat) return;
      start(null);
    });
    press.addEventListener('keyup', function (e) {
      if (e.key !== ' ' && e.key !== 'Spacebar' && e.key !== 'Enter') return;
      e.preventDefault();
      release();
    });
    press.addEventListener('blur', release);
    press.addEventListener('click', function (e) { e.preventDefault(); });

    /* Pointer devices without pointer events fall back to a plain tap. */
    if (!window.PointerEvent) {
      press.addEventListener('click', function () { complete(); });
    }

    toIdle();
  }

  function boot() {
    var cards = document.querySelectorAll('[data-quest-card]');
    for (var i = 0; i < cards.length; i++) QuestCard(cards[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
