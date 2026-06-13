var GOOGLE_ANALYTICS_MEASUREMENT_ID = "G-XXXXXXXXXX";

window.loadGoogleAnalytics = function (measurementId) {
  if (!measurementId || measurementId === "G-XXXXXXXXXX" || !/^G-[A-Z0-9]+$/.test(measurementId)) {
    return false;
  }

  if (document.querySelector('script[data-google-analytics="' + measurementId + '"]')) {
    return true;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", measurementId, { anonymize_ip: true });

  var analyticsScript = document.createElement("script");
  analyticsScript.async = true;
  analyticsScript.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
  analyticsScript.dataset.googleAnalytics = measurementId;
  document.head.appendChild(analyticsScript);
  return true;
};

document.addEventListener("DOMContentLoaded", function () {
  var navToggle = document.querySelector("[data-nav-toggle]");
  var siteNav = document.querySelector("[data-site-nav]");
  var cookieBanner = document.querySelector("[data-cookie-banner]");
  var cookieStatus = document.querySelector("[data-cookie-status]");
  var cookieChoiceKey = "sellsmart-analytics-consent";

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      var isOpen = siteNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
      navToggle.textContent = isOpen ? "Close" : "Menu";
    });

    siteNav.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        siteNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.textContent = "Menu";
      }
    });
  }

  document.querySelectorAll("[data-current-year]").forEach(function (element) {
    element.textContent = new Date().getFullYear();
  });

  function getCookieChoice() {
    try {
      return window.localStorage.getItem(cookieChoiceKey);
    } catch (error) {
      return null;
    }
  }

  function saveCookieChoice(choice) {
    try {
      window.localStorage.setItem(cookieChoiceKey, choice);
    } catch (error) {
      // The preference lasts only for this page when storage is unavailable.
    }
  }

  function updateCookieStatus(choice) {
    if (!cookieStatus) {
      return;
    }

    if (choice === "accepted") {
      cookieStatus.textContent = "Current choice: analytics accepted.";
    } else if (choice === "rejected") {
      cookieStatus.textContent = "Current choice: analytics rejected.";
    } else {
      cookieStatus.textContent = "No analytics preference has been saved.";
    }
  }

  function showCookieBanner() {
    if (cookieBanner) {
      cookieBanner.hidden = false;
    }
  }

  function applyCookieChoice(choice) {
    updateCookieStatus(choice);

    if (choice === "accepted") {
      window.loadGoogleAnalytics(GOOGLE_ANALYTICS_MEASUREMENT_ID);
    }

    if (!choice) {
      showCookieBanner();
    }
  }

  if (cookieBanner) {
    cookieBanner.addEventListener("click", function (event) {
      var choiceButton = event.target.closest("[data-cookie-choice]");

      if (!choiceButton) {
        return;
      }

      var choice = choiceButton.dataset.cookieChoice;
      saveCookieChoice(choice);
      cookieBanner.hidden = true;
      applyCookieChoice(choice);
    });
  }

  document.querySelectorAll("[data-cookie-settings]").forEach(function (button) {
    button.addEventListener("click", function () {
      try {
        window.localStorage.removeItem(cookieChoiceKey);
      } catch (error) {
        // The banner can still be reopened without persistent storage.
      }

      updateCookieStatus(null);
      showCookieBanner();
      var firstChoice = cookieBanner && cookieBanner.querySelector("[data-cookie-choice]");
      if (firstChoice) {
        firstChoice.focus();
      }
    });
  });

  applyCookieChoice(getCookieChoice());
});
