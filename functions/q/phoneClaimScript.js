export function questPhoneClaimScript({ shareCode, turnstileSiteKey, appHandoff }) {
  const serializedCode = JSON.stringify(shareCode);
  const serializedSiteKey = JSON.stringify(turnstileSiteKey);
  const serializedAppScheme = JSON.stringify(appHandoff.appScheme);
  const serializedAndroidPackage = JSON.stringify(appHandoff.androidPackage);
  const serializedAppStoreUrl = JSON.stringify(appHandoff.appStoreUrl);
  const serializedPlayStoreUrl = JSON.stringify(appHandoff.playStoreUrl);

  return `(function () {
    "use strict";

    var shareCode = ${serializedCode};
    var siteKey = ${serializedSiteKey};
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
    var ANDROID_PACKAGE = ${serializedAndroidPackage};
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
      var digits = String(value || "").replace(/\D/g, "");
      if (digits.charAt(0) === "1") digits = digits.substring(1);
      return digits.substring(0, 10);
    }

    function formatPhone(value) {
      var digits = inputDigits(value);
      if (!digits) return "";
      if (digits.length <= 3) return "+1 (" + digits;
      if (digits.length <= 6) {
        return "+1 (" + digits.substring(0, 3) + ") " + digits.substring(3);
      }
      return "+1 (" + digits.substring(0, 3) + ") " + digits.substring(3, 6) + "-" + digits.substring(6);
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
      if (status === 404 || code === "quest_not_found") return "This Quest is no longer available.";
      if (code === "quest_unavailable") return "This Quest is no longer accepting participants.";
      if (code === "invalid_phone") return "Enter a valid phone number.";
      if (code === "turnstile_failed") return "Verification failed. Try again.";
      if (status === 503) return "Joining is temporarily unavailable. Try again shortly.";
      return "Something went wrong. Try again.";
    }

    input.addEventListener("input", function () {
      input.value = formatPhone(input.value);
      input.setSelectionRange(input.value.length, input.value.length);
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
      if (!turnstileToken) {
        initTurnstile();
        setError("Verification is getting ready. Try again in a moment.");
        return;
      }

      submitting = true;
      setError("");
      submitLabel.textContent = "Saving your invite...";
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

    openApp.addEventListener("click", function () {
      if (platform() === "android") {
        window.location.href = "intent://q/" + shareCode +
          "#Intent;scheme=" + APP_SCHEME + ";package=" + ANDROID_PACKAGE + ";S.browser_fallback_url=" +
          encodeURIComponent(PLAY_STORE_URL) + ";end";
        return;
      }
      if (platform() === "ios") {
        var fallbackTimer = setTimeout(function () {
          if (document.visibilityState === "visible") window.location.href = APP_STORE_URL;
        }, 1400);
        var cancelFallback = function () {
          if (document.visibilityState === "hidden") clearTimeout(fallbackTimer);
        };
        document.addEventListener("visibilitychange", cancelFallback, { once: true });
        window.addEventListener("pagehide", function () { clearTimeout(fallbackTimer); }, { once: true });
        window.location.href = APP_SCHEME + "://q/" + shareCode;
        return;
      }
      window.location.href = APP_STORE_URL;
    });

    updateButton();
    startTurnstilePolling();
  })();`;
}
