// ==UserScript==
// @name         CHZZK  Ad Block Auto Quality Change
// @version      1.0.6
// @match        https://chzzk.naver.com/*
// @description  치지직 광고 차단 감지 스크립트를 우회합니다.
// @run-at       document-start
// @grant        none
// @author       k22pr
// @namespace    k22pr/chzzk-ad-block-auto-quality-change
// @license MIT
// ==/UserScript==

(function () {
  const VIDEO_SEL = "video.webplayer-internal-video";
  const QUALITY_SEL = "li.pzp-ui-setting-quality-item";

  let qualityInterval = null;
  let processed = false;

  function pressEnterOnElement(el) {
    if (!el) return;
    el.focus?.({ preventScroll: true });
    el.click();
    el.dispatchEvent(
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
    console.log(qualityItems);
    let highItem = Array.from(qualityItems).find((option) =>
      option.textContent.includes("1080p")
    );

    console.log("highItem", highItem, highItem?.textContent);

    if (!highItem)
      highItem = Array.from(qualityItems).find((option) =>
        option.textContent.includes("720p")
      );

    console.log("highItem", highItem);
    const isNowHighQuality =
      highItem?.classList.contains("pzp-ui-setting-pane-item--checked") ??
      false;

    // console.log("hq:", !!isNowHighQuality, "paused:", videoEl?.paused ?? null);

    console.log("highItem", highItem, "isNowHighQuality", isNowHighQuality);
    console.log(
      "1080p",
      highItem?.textContent?.includes("1080p"),
      "720p",
      highItem?.textContent?.includes("720p"),
      "checked",
      highItem?.classList.contains("pzp-ui-setting-pane-item--checked")
    );

    if (!hasLive) {
      console.log("stop interval (!hasLive)", !hasLive);
      return stopQualityInterval();
    }

    if (hasLive && !isNowHighQuality && !processed) {
      pressEnterOnElement(highItem);
      processed = true;
      return;
    }

    if (isNowHighQuality && videoEl && videoEl.paused) {
      videoEl.play().catch(() => {});
    }

    if (isNowHighQuality && videoEl && !videoEl.paused) {
      console.log(
        "stop interval (isNowHighQuality && videoEl && !videoEl.paused)",
        isNowHighQuality,
        videoEl,
        !videoEl.paused
      );
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
    processed = false;
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
    if (e.altKey && e.key.toLowerCase() === "h") pressEnterOnElement();
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
        '[role="dialog"], [role="alertdialog"], [class*="popup"], [class*="modal"], [class*="layer"]'
      ) || el;

    const nodes = container.parentElement.querySelectorAll(
      'button, [role="button"], input[type="button"], input[type="submit"], a[role="button"]'
    );

    container.parentElement.style.opacity = "0";
    document.documentElement.style.overflow = "auto";
    container.parentElement.remove();

    // if (nodes.length != 0) {
    //   let event = new MouseEvent("click", {
    //     bubbles: true,
    //     cancelable: true,
    //     view: window,
    //   });
    //   nodes[0].dispatchEvent(event);
    // }
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
