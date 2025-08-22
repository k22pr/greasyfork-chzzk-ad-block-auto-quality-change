// ==UserScript==
// @name         chzzk Ad Block Auto Quality Change
// @version      1.0.4
// @match        https://chzzk.naver.com/*
// @description  치지직 광고 차단 감지 스크립트를 우회합니다.
// @run-at       document-start
// @grant        none
// @author       k22pr
// @namespace    k22pr/chzzk-ad-block-auto-quality-change
// @license MIT
// ==/UserScript==

(function () {
  const SLIDER_SEL = "div.pzp-pc-progress-slider";
  const BTN_SEL = "button.pzp-pc-setting-button";
  const VIDEO_SEL = "video.webplayer-internal-video";
  const QUALITY_SEL = "li.pzp-ui-setting-quality-item";

  let qualityInterval = null;

  function pressEnterOnFirstQuality() {
    const item = document.querySelector(QUALITY_SEL);
    if (!item) return;
    item.focus?.({ preventScroll: true });
    item.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
        code: "Enter",
      })
    );
    item.dispatchEvent(
      new KeyboardEvent("keyup", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
        code: "Enter",
      })
    );
  }

  function tick() {
    const hasLive = location.pathname.includes("/live/");
    const videoEl = document.querySelector(VIDEO_SEL);
    const qualityItems = document.querySelectorAll(QUALITY_SEL);
    const isHighQuality =
      qualityItems[0]?.classList.contains(
        "pzp-ui-setting-pane-item--checked"
      ) ?? false;

    // console.log("hq:", !!isHighQuality, "paused:", videoEl?.paused ?? null);

    if (!hasLive) return stopQualityInterval();

    if (hasLive && !isHighQuality) {
      pressEnterOnFirstQuality();
      return;
    }

    if (isHighQuality && videoEl && videoEl.paused) {
      videoEl.play().catch(() => {});
    }

    if (isHighQuality && videoEl && !videoEl.paused) {
      stopQualityInterval();
    }
  }

  function startQualityInterval() {
    if (qualityInterval !== null) return;
    qualityInterval = setInterval(tick, 100);
  }

  function stopQualityInterval() {
    if (qualityInterval === null) return;
    clearInterval(qualityInterval);
    qualityInterval = null;
  }

  function restartQualityInterval() {
    stopQualityInterval();
    startQualityInterval();
    setTimeout(stopQualityInterval, 5000);
  }

  // SPA URL change
  (function () {
    const fireLoc = () => setTimeout(restartQualityInterval, 0);
    const _ps = history.pushState,
      _rs = history.replaceState;
    history.pushState = function () {
      const r = _ps.apply(this, arguments);
      fireLoc();
      return r;
    };
    history.replaceState = function () {
      const r = _rs.apply(this, arguments);
      fireLoc();
      return r;
    };
    window.addEventListener("popstate", fireLoc);
  })();

  // test: Alt+H
  window.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "h") pressEnterOnFirstQuality();
  });

  restartQualityInterval();
})();

(function () {
  const MSG = "광고 차단 프로그램을 사용 중이신가요?";

  const isPopupContents = (el) =>
    el instanceof Element &&
    (el.className + "").includes("popup_contents__") &&
    el.textContent &&
    el.textContent.includes(MSG);

  const removePopup = (el) => {
    const container =
      el.closest(
        '[role="dialog"], [class*="popup"], [class*="modal"], [class*="layer"]'
      ) || el;
    container.parentElement.remove();
  };

  const scan = (root) => {
    if (!root) return;
    const candidates =
      root.querySelectorAll?.('[class*="popup_contents__"]') ?? [];
    candidates.forEach((el) => {
      if (isPopupContents(el)) removePopup(el);
    });

    const all = root.querySelectorAll?.("*") ?? [];
    all.forEach((n) => {
      if (n.shadowRoot) scan(n.shadowRoot);
    });
    if (root.shadowRoot) scan(root.shadowRoot);
  };

  const ready = () => scan(document);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 1) scan(node); // Element
      });
      if (m.type === "characterData" && m.target?.parentElement) {
        const el = m.target.parentElement.closest?.(
          '[class*="popup_contents__"]'
        );
        if (el && isPopupContents(el)) removePopup(el);
      }
    }
  });

  mo.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
