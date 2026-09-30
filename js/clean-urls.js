/* GitHub Pages serves each static HTML file at its extensionless URL too. */
(function () {
  'use strict';

  var location = window.location;
  var supportedHost = /^(thequestsapp\.com|www\.thequestsapp\.com|localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (!supportedHost || !/^https?:$/.test(location.protocol)) return;

  var script = document.currentScript;
  var cleanPath = script && script.getAttribute('data-clean-path');
  if (!cleanPath || cleanPath.charAt(0) !== '/' || cleanPath.charAt(1) === '/') return;

  var legacyPath = cleanPath === '/' ? '/index.html' : cleanPath + '.html';
  if (location.pathname !== legacyPath) return;

  // Keep the loaded document, query parameters, fragment and current history state.
  try {
    window.history.replaceState(window.history.state, '', cleanPath + location.search + location.hash);
  } catch (_) {
    // The original address continues to serve the same complete page.
  }
}());
