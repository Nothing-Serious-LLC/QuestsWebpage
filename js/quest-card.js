/* ==========================================================================
   Quests V2: hold to check in card
   A replica of the app's home quest card interaction. Every timing below is
   quoted from CARD-SPEC.md, which was extracted from the app source. The one
   site-specific addition is the polite reset, so the demo can be tried again.

   TIMINGS (app source)
     400ms   tap disambiguation before the press engages
     1800ms  linear bottom-up fill (scaleY, origin bottom)
     250ms   fill opacity fade-in
     150ms   end grace window: release inside it still completes
     180ms   rewind on early release
     260ms   fill dissolve on completion
     900ms   medallion lift 12px (250) > coin flip on Y (400) > drop (250)
     460ms   card pop to 1.04 and spring back
     3000ms  polite reset back to idle (site only)

   BEHAVIOUR
     Pointer: press and hold anywhere on the card body.
     Keyboard: focus the pill, hold Space or Enter.
     prefers-reduced-motion: a tap toggles the flood state instantly.

   MARKUP CONTRACT
     [data-quest-card]        root, carries data-state and a .cat-* class
     .quest-card__fill        the fill sheet
     [data-quest-press]       the button that receives the press
     [data-quest-medallion]   optional, gets the coin flip
     [data-quest-a11y]        optional live region text
   State on the root: idle | holding | rewind | checked
   ========================================================================== */
(function () {
  'use strict';

  var ENGAGE_MS = 400;
  var FILL_MS = 1800;
  var GRACE_MS = 150;
  var REWIND_MS = 180;
  var DISSOLVE_MS = 260;
  var FLIP_MS = 900;
  var POP_MS = 460;
  var RESET_MS = 3000;

  var motion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  function reduced() { return !!motion.matches; }

  function QuestCard(root) {
    var press = root.querySelector('[data-quest-press]');
    var fill = root.querySelector('.quest-card__fill');
    var medallion = root.querySelector('[data-quest-medallion]');
    var live = root.querySelector('[data-quest-a11y]');
    if (!press || !fill) return;

    var idleText = live ? live.textContent : '';
    var doneText = root.getAttribute('data-quest-done') || 'Checked in for today.';

    var engageTimer = null;
    var fillTimer = null;
    var rewindTimer = null;
    var flipTimer = null;
    var popTimer = null;
    var resetTimer = null;

    var pressed = false;    // pointer or key is down
    var engaged = false;    // the 400ms delay has elapsed, the fill is running
    var engagedAt = 0;

    function clear(t) { if (t) window.clearTimeout(t); return null; }

    function clearAll() {
      engageTimer = clear(engageTimer);
      fillTimer = clear(fillTimer);
      rewindTimer = clear(rewindTimer);
    }

    function setState(state) {
      root.setAttribute('data-state', state);
      var checked = state === 'checked';
      press.setAttribute('aria-pressed', checked ? 'true' : 'false');
      if (live) live.textContent = checked ? doneText : idleText;
    }

    /* Park the fill at scale 0 with no transition, so the next hold starts clean. */
    function parkFill() {
      fill.style.transition = 'none';
      fill.style.transform = '';
      fill.style.opacity = '';
      void fill.offsetWidth;
      fill.style.transition = '';
    }

    function toIdle() {
      pressed = false;
      engaged = false;
      clearAll();
      resetTimer = clear(resetTimer);
      parkFill();
      setState('idle');
    }

    function engage() {
      engaged = true;
      engagedAt = Date.now();
      parkFill();
      setState('holding');
      fillTimer = clear(fillTimer);
      fillTimer = window.setTimeout(complete, FILL_MS);
    }

    function start(event) {
      if (root.getAttribute('data-state') === 'checked') {
        if (reduced()) toIdle();
        return;
      }
      if (reduced()) { complete(); return; }
      if (pressed) return;

      pressed = true;
      rewindTimer = clear(rewindTimer);
      if (event && event.pointerId !== undefined && press.setPointerCapture) {
        try { press.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
      }
      engageTimer = clear(engageTimer);
      engageTimer = window.setTimeout(engage, ENGAGE_MS);
    }

    function release() {
      if (!pressed) return;
      pressed = false;
      engageTimer = clear(engageTimer);

      if (!engaged) return;                 // released inside the 400ms tap window
      if (root.getAttribute('data-state') !== 'holding') return;

      var elapsed = Date.now() - engagedAt;
      if (elapsed >= FILL_MS - GRACE_MS) { complete(); return; }

      // Rewind from wherever the fill currently sits, over 180ms. Read the
      // live matrix first, then hand the sheet an inline transition so the
      // drop starts from the exact height the visitor let go at.
      engaged = false;
      fillTimer = clear(fillTimer);
      var now = window.getComputedStyle(fill).transform;
      setState('rewind');
      fill.style.transition = 'none';
      fill.style.transform = (now && now !== 'none') ? now : 'scaleY(0)';
      void fill.offsetWidth;
      fill.style.transition = 'transform ' + REWIND_MS + 'ms cubic-bezier(0.2, 0.8, 0.2, 1)';
      fill.style.transform = 'scaleY(0)';
      rewindTimer = clear(rewindTimer);
      rewindTimer = window.setTimeout(function () {
        parkFill();
        setState('idle');
      }, REWIND_MS);
    }

    function complete() {
      pressed = false;
      engaged = false;
      clearAll();

      // Freeze the fill where it is, then let the checked state dissolve it
      // while the card floods with the category pale pair.
      fill.style.transition = 'none';
      fill.style.transform = 'scaleY(1)';
      void fill.offsetWidth;
      fill.style.transition = '';
      setState('checked');

      if (!reduced()) {
        if (medallion) {
          medallion.classList.remove('is-flip');
          void medallion.offsetWidth;
          medallion.classList.add('is-flip');
          flipTimer = clear(flipTimer);
          flipTimer = window.setTimeout(function () {
            medallion.classList.remove('is-flip');
          }, FLIP_MS);
        }
        root.classList.remove('is-pop');
        void root.offsetWidth;
        root.classList.add('is-pop');
        popTimer = clear(popTimer);
        popTimer = window.setTimeout(function () { root.classList.remove('is-pop'); }, POP_MS);
      }

      // Polite reset so the next visitor gets to try it. Reduced motion keeps
      // the flood until the visitor taps again, because there the tap is a
      // toggle and a surprise state change would undo their own action.
      resetTimer = clear(resetTimer);
      if (!reduced()) {
        resetTimer = window.setTimeout(toIdle, RESET_MS + DISSOLVE_MS);
      }
    }

    /* ---- Pointer ---- */
    press.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      start(e);
    });
    press.addEventListener('pointerup', release);
    press.addEventListener('pointercancel', release);
    press.addEventListener('pointerleave', release);
    press.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    press.addEventListener('dragstart', function (e) { e.preventDefault(); });
    press.addEventListener('click', function (e) { e.preventDefault(); });

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

    /* Devices without pointer events fall back to a tap that completes. */
    if (!window.PointerEvent) {
      press.addEventListener('touchstart', function (e) { e.preventDefault(); complete(); }, { passive: false });
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
