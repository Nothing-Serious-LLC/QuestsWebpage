/* The guide is permanent; the supplied campaign invite has a limited life. */
(function () {
  'use strict';
  function updateInviteState() {
    var expired = false;
    document.querySelectorAll('[data-event-invite]').forEach(function (link) {
      var cutoff = Date.parse(link.getAttribute('data-event-cutoff'));
      if (Number.isFinite(cutoff) && Date.now() >= cutoff) {
        link.href = '/';
        link.textContent = 'Explore challenges on Quests';
        expired = true;
      }
    });
    if (expired) document.querySelectorAll('[data-invite-note]').forEach(function (note) {
      note.textContent = 'This invitation has closed. Open Quests to explore current challenges or start one with friends.';
    });
  }
  updateInviteState();
  window.addEventListener('pageshow', updateInviteState);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) updateInviteState(); });
  document.querySelectorAll('[data-event-invite]').forEach(function (link) { link.addEventListener('click', updateInviteState); });
  async function copy(text, button, status, success, fallback) {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = success;
      status.textContent = success;
    } catch (_) {
      status.textContent = fallback;
    }
  }
  var share = document.querySelector('[data-copy-page]');
  if (share) share.addEventListener('click', function () {
    copy(document.querySelector('link[rel="canonical"]').href, share, document.querySelector('[data-copy-status]'), 'Guide link copied', 'Copy this page address from your browser’s address bar.');
  });
}());
