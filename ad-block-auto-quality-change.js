// ==UserScript==
// @name         CHZZK  Ad Block Auto Quality Change
// @version      1.0.8
// @match        https://chzzk.naver.com/*
// @description  치지직 광고 차단 감지 스크립트를 우회합니다.
// @run-at       document-start
// @grant        none
// @author       k22pr
// @namespace    k22pr/chzzk-ad-block-auto-quality-change
// @license MIT
// ==/UserScript==

(function () {
  const VIDEO_ELEMENT_NAME = "video.webplayer-internal-video";
  const QUALITY_ELEMENT_NAME = "li.pzp-ui-setting-quality-item";

  let qualityInterval = null;
  let processed = false;

  function pressEnterOnElement(el) {
    if (!el) return;
    el.focus?.({ preventScroll: true });
    el.click();
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        key: "Enter",
        code: "Enter",
      })
    );
    el.dispatchEvent(
      new KeyboardEvent("keyup", { bubbles: true, key: "Enter", code: "Enter" })
    );
  }

  async function tick() {
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))
    );
    const hasLive = location.pathname.includes("/live/");
    const videoEl = document.querySelector(VIDEO_ELEMENT_NAME);
    const items = [
      ...new Set([...document.querySelectorAll(QUALITY_ELEMENT_NAME)]),
    ];
    const target = items.find((li) => /1080p|720p/.test(li.innerText));
    if (!target) return false;

    const isNowHighQuality =
      target?.classList.contains("pzp-ui-setting-pane-item--checked") ?? false;

    if (hasLive && !isNowHighQuality && !processed) {
      pressEnterOnElement(target);
      videoEl.play().catch(() => {});
      processed = true;
      return;
    }

    if (isNowHighQuality && videoEl && !videoEl.paused) {
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
    setTimeout(stopQualityInterval, 3000);
  }

  // test: Alt+H
  window.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "h") pressEnterOnElement();
  });

  function tryMount() {
    const videoElement = document.querySelector(VIDEO_ELEMENT_NAME);

    videoElement?.addEventListener("loadedmetadata", () => {
      // videoElement.pause().catch(() => {});
      tick();
      restartQualityInterval();
    });
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

  // 초기 시도
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryMount, { once: true });
  } else {
    tryMount();
  }

  // 동적 삽입 감시: 비디오나 컨테이너가 나중에 생길 때
  new MutationObserver((list) => {
    for (const m of list) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (
          n.matches?.(VIDEO_ELEMENT_NAME) ||
          n.querySelector?.(VIDEO_ELEMENT_NAME)
        )
          tryMount();
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
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

    container.parentElement.style.opacity = "0";
    document.documentElement.style.overflow = "auto";
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

  // SPA URL change
  (function () {
    const fireLoc = () => setTimeout(() => scan(document), 0);
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
})();
