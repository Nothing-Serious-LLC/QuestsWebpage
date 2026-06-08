// /subscribe-boot.js — diagnostic bootstrap for the /subscribe checkout page.
//
// Loaded as a NON-module script BEFORE /subscribe-app.js so its global error
// handlers are installed before the SDK module evaluates. Surfaces any
// uncaught error / unhandled promise rejection (including a failed module
// import or a CSP violation) into a visible #debug box, so a sandbox tester can
// read the exact failure on-device without a desktop Web Inspector.
//
// Safe to keep in production: it only writes to #debug (hidden until something
// is logged) and exposes window.__rcDebug for /subscribe-app.js to append steps.
(function () {
  function show(msg) {
    try {
      var d = document.getElementById("debug");
      if (!d) return;
      d.style.display = "block";
      d.textContent += msg + "\n";
    } catch (_e) {
      /* no-op */
    }
  }
  window.__rcDebug = show;

  window.addEventListener("error", function (e) {
    var where = e && e.filename ? " @ " + e.filename + ":" + (e.lineno || 0) : "";
    show("ERROR: " + ((e && (e.message || e.error)) || "unknown") + where);
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    var msg =
      (r && (r.message || r.code || r.name)) ||
      (typeof r === "string" ? r : JSON.stringify(r));
    show("UNHANDLED REJECTION: " + msg);
  });
})();
