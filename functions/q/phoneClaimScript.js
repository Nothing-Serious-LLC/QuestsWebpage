export function questPhoneClaimScript({
  shareCode,
  turnstileSiteKey,
  appHandoff,
  demoMode = false,
}) {
  const serializedCode = JSON.stringify(shareCode);
  const serializedSiteKey = JSON.stringify(turnstileSiteKey ?? null);
  const serializedDemo = JSON.stringify(Boolean(demoMode));
  const serializedAppScheme = JSON.stringify(appHandoff.appScheme);
  const serializedAppSchemes = JSON.stringify([
    appHandoff.appScheme,
    ...(appHandoff.alternateAppSchemes || []),
  ]);
  const serializedAndroidScheme = JSON.stringify(
    appHandoff.androidScheme || appHandoff.appScheme,
  );
  const serializedAndroidPackage = JSON.stringify(appHandoff.androidPackage);
  const serializedAppStoreUrl = JSON.stringify(appHandoff.appStoreUrl);
  const serializedPlayStoreUrl = JSON.stringify(appHandoff.playStoreUrl);

  return `(function () {
    "use strict";

    var shareCode = ${serializedCode};
    var siteKey = ${serializedSiteKey};
    var DEMO = ${serializedDemo};
    var form = document.getElementById("phone-claim-form");
    var input = document.getElementById("phone-input");
    var error = document.getElementById("phone-error");
    var submit = document.getElementById("join-quest-button");
    var submitLabel = document.getElementById("join-quest-label");
    var openApp = document.getElementById("open-app-link");
    var success = document.getElementById("claim-success");
    var turnstileBox = document.getElementById("turnstile-container");
    var turnstileToken = null;
    var turnstileWidget = null;
    var submitting = false;
    var APP_SCHEME = ${serializedAppScheme};
    var APP_SCHEMES = ${serializedAppSchemes};
    var ANDROID_SCHEME = ${serializedAndroidScheme};
    var ANDROID_PACKAGE = ${serializedAndroidPackage};
    var SCHEME_FALLBACK_MS = 1400;
    var APP_STORE_URL = ${serializedAppStoreUrl};
    var PLAY_STORE_URL = ${serializedPlayStoreUrl};

    function platform() {
      var ua = (navigator.userAgent || "").toLowerCase();
      if (/android/.test(ua)) return "android";
      if (/iphone|ipad|ipod/.test(ua)) return "ios";
      if (ua.indexOf("mac") >= 0 && navigator.maxTouchPoints > 1) return "ios";
      return "desktop";
    }

    function inputDigits(value) {
      var digits = String(value || "").replace(/\\D/g, "");
      if (digits.length === 11 && digits.charAt(0) === "1") digits = digits.substring(1);
      return digits;
    }

    function formatPhone(value) {
      var digits = inputDigits(value);
      if (!digits) return "";
      if (digits.length > 10) return digits;
      if (digits.length < 3) return digits;
      if (digits.length === 3) return "(" + digits + ")";
      if (digits.length <= 6) {
        return "(" + digits.substring(0, 3) + ") " + digits.substring(3);
      }
      return "(" + digits.substring(0, 3) + ") " + digits.substring(3, 6) + "-" + digits.substring(6);
    }

    function normalizedPhone() {
      var digits = inputDigits(input.value);
      return digits.length === 10 ? "+1" + digits : null;
    }

    function setError(message) {
      error.textContent = message || "";
      error.hidden = !message;
      input.setAttribute("aria-invalid", message ? "true" : "false");
    }

    function updateButton() {
      submit.disabled = submitting || !normalizedPhone();
    }

    function resetChallenge() {
      turnstileToken = null;
      if (typeof turnstile !== "undefined" && turnstileWidget != null) {
        turnstile.reset(turnstileWidget);
      }
    }

    function initTurnstile() {
      if (typeof turnstile === "undefined" || turnstileWidget != null) return;
      turnstileWidget = turnstile.render(turnstileBox, {
        sitekey: siteKey,
        theme: "light",
        size: "invisible",
        callback: function (token) { turnstileToken = token; },
        "error-callback": function () { turnstileToken = null; },
        "expired-callback": function () { turnstileToken = null; }
      });
    }

    function startTurnstilePolling() {
      if (typeof turnstile !== "undefined") {
        initTurnstile();
        return;
      }
      var attempts = 0;
      var poll = setInterval(function () {
        attempts += 1;
        if (typeof turnstile !== "undefined") {
          clearInterval(poll);
          initTurnstile();
        } else if (attempts >= 50) {
          clearInterval(poll);
        }
      }, 100);
    }

    function responseErrorMessage(status, body, headers) {
      if (status === 429) {
        var seconds = Number(headers.get("Retry-After") || 300);
        var minutes = Math.max(1, Math.ceil(seconds / 60));
        return "Too many attempts. Try again in " + minutes + " minute" + (minutes === 1 ? "" : "s") + ".";
      }
      var code = body && body.error;
      if (status === 404 || code === "quest_not_found") return "This Quest is unavailable.";
      if (code === "quest_unavailable") return "This Quest is unavailable.";
      if (code === "invalid_phone") return "Enter a valid phone number.";
      if (code === "turnstile_failed") return "Verification failed. Try again.";
      if (status === 503) return "Joining is temporarily unavailable. Try again.";
      return "Something went wrong. Try again.";
    }

    var lastPhoneValue = "";
    input.addEventListener("input", function () {
      var previous = input.value;
      var caretFromEnd = previous.length - (input.selectionStart || 0);
      if (lastPhoneValue.length - previous.length === 1 &&
          previous.replace(/\\D/g, "") === lastPhoneValue.replace(/\\D/g, "")) {
        previous = inputDigits(previous).slice(0, -1);
      }
      var formatted = formatPhone(previous);
      lastPhoneValue = formatted;
      if (formatted !== input.value) {
        input.value = formatted;
        var caret = Math.max(0, formatted.length - caretFromEnd);
        input.setSelectionRange(caret, caret);
      }
      setError("");
      updateButton();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (submitting) return;
      var phone = normalizedPhone();
      if (!phone) {
        setError("Enter a valid 10-digit phone number.");
        input.focus();
        return;
      }
      if (DEMO) {
        form.hidden = true;
        success.hidden = false;
        success.focus();
        var demoTarget = platform() === "android" ? PLAY_STORE_URL : APP_STORE_URL;
        setTimeout(function () { window.location.href = demoTarget; }, 1600);
        return;
      }
      if (!turnstileToken) {
        initTurnstile();
        setError("Verification is getting ready. Try again in a moment.");
        return;
      }

      submitting = true;
      setError("");
      submitLabel.innerHTML = 'Opening Quests<span class="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>';
      updateButton();

      fetch("/api/link-claims/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareCode: shareCode,
          phone: phone,
          turnstileToken: turnstileToken
        })
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          return { ok: response.ok, status: response.status, body: body, headers: response.headers };
        });
      }).then(function (result) {
        if (!result.ok) {
          setError(responseErrorMessage(result.status, result.body, result.headers));
          resetChallenge();
          return;
        }

        form.hidden = true;
        success.hidden = false;
        success.focus();
        var target = platform() === "android" ? PLAY_STORE_URL : APP_STORE_URL;
        setTimeout(function () { window.location.href = target; }, 1600);
      }).catch(function () {
        setError("Something went wrong. Try again.");
        resetChallenge();
      }).finally(function () {
        submitting = false;
        submitLabel.textContent = "Join Quest";
        updateButton();
      });
    });

    // iOS walks the scheme chain: each scheme gets SCHEME_FALLBACK_MS to take
    // the page away; if the page is still visible the next scheme fires, and
    // the store is the last stop. A host with one client has a one-item chain.
    function openIosChain(index) {
      if (index >= APP_SCHEMES.length) {
        window.location.href = APP_STORE_URL;
        return;
      }
      var fallbackTimer = setTimeout(function () {
        if (document.visibilityState === "visible") openIosChain(index + 1);
      }, SCHEME_FALLBACK_MS);
      var cancelFallback = function () {
        if (document.visibilityState === "hidden") clearTimeout(fallbackTimer);
      };
      document.addEventListener("visibilitychange", cancelFallback, { once: true });
      window.addEventListener("pagehide", function () { clearTimeout(fallbackTimer); }, { once: true });
      window.location.href = APP_SCHEMES[index] + "://q/" + shareCode;
    }

    openApp.addEventListener("click", function (event) {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      if (platform() === "android") {
        window.location.href = "intent://q/" + shareCode +
          "#Intent;scheme=" + ANDROID_SCHEME + ";package=" + ANDROID_PACKAGE + ";S.browser_fallback_url=" +
          encodeURIComponent(PLAY_STORE_URL) + ";end";
        return;
      }
      if (platform() === "ios") {
        openIosChain(0);
        return;
      }
      window.location.href = APP_STORE_URL;
    });

    updateButton();
    if (!DEMO) startTurnstilePolling();
  })();`;
}
