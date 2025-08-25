// ==UserScript==
// @name         CHZZK Live Bar
// @version      1.0.6
// @match        https://chzzk.naver.com/*
// @description  치지직 라이브 방송 접속 시점부터의 최대 1분 30초간의 재생바를 제공합니다.
// @run-at       document-idle
// @grant        none
// @author       k22pr
// @namespace    k22pr/chzzk-live-bar
// @license MIT
// ==/UserScript==

(function () {
  const VIDEO_ELEMENT_NAME = "video.webplayer-internal-video";
  const BOTTOM_SEL = "div.pzp-pc__bottom";
  const EDGE_EPS = 0.5;
  const LIVE_EPS = 3.5;
  const MAX_VIDEO_DURATION = 60 * 1.5;

  const CSS = `
      .live-bar-box{display:flex !important;position:absolute;left:0px;bottom:30px !important;width:100%;font-size:11px;line-height:1;}
      // .live-bar-box{opacity:1 !important;}
      .live-bar-box .live-bar-ui{width:100%;display:flex;gap:8px;align-items:center;color:#fff;padding:6px 8px;}
      .live-bar-box .go{width:45px;border:0;border-radius:6px;padding:2px 8px;background:#868e96;color:#fff;cursor:pointer;font-size:11px;line-height:1;margin-left:4px;}
      .live-bar-box .go.live{background:rgb(221, 51, 51);box-shadow:0px 0px 4px rgba(221, 51, 51, 0.5);}
      .live-bar-box .t{white-space:nowrap;min-width:20px;text-align:center}
      .live-bar-box .time{display:flex;gap:4px;align-items:center}
      .live-bar-box .slide-box{display:flex;flex:1;position:relative;align-items:center;width:100%; height:3px;padding:8px 0px;cursor:pointer}
      .live-bar-box .slide-box:hover{height:6px;}
      .live-bar-box .slide-box div{transition:height 0.2s;}
      .live-bar-box .slide-box .track{position:absolute;left:0px;width:100%;height:3px;background:rgba(255,255,255,0.5);}
      .live-bar-box .slide-box .rng{position:absolute;left:0px;height:3px;background:#00f889;transition:width 0.1s;transition-delay: 0.1}
      .live-bar-box .slide-box:hover .track{height:6px;border-radius:3px;box-shadow:0px 0px 4px rgba(0,0,0,0.3);}
      .live-bar-box .slide-box:hover .rng{height:6px;border-radius:3px;box-shadow:0px 0px 5px #00f889;}
      .live-bar-box.no-anim .slide-box .rng { transition: none !important; }

      .live-bar-box .hover-tip{
        position:absolute; top:0; transform:translate(-50%,-140%);
        background:rgba(0,0,0,.7); color:#fff; padding:2px 6px; border-radius:4px;
        font-size:11px/1; pointer-events:none;
        opacity:0; transition:opacity .12s;
      }
      .live-bar-box .hover-tip.show{ opacity:1; }
      .live-bar-box .hover-x{
        position:absolute; top:0; bottom:0; width:1px; background:rgba(255,255,255,1);
        transform:translateX(-.5px); opacity:0; transition:opacity .12s;
      }
      .live-bar-box .hover-x.show{ opacity:1; }
  `;

  const styleOnce = (() => {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      const s = document.createElement("style");
      s.textContent = CSS;
      document.head.appendChild(s);
    };
  })();

  const timeFormat = (t) => {
    // t = Math.max(0, t | 0);
    const h = (t / 3600) | 0,
      m = ((t % 3600) / 60) | 0,
      s = t % 60 | 0;

    return h
      ? `${t > 0 ? "" : "-"}${Math.abs(h)}:${String(Math.abs(m)).padStart(
          2,
          "0"
        )}:${String(Math.abs(s)).padStart(2, "0")}`
      : `${t > 0 ? "" : "-"}${Math.abs(m)}:${String(Math.abs(s)).padStart(
          2,
          "0"
        )}`;
  };

  const getEdges = (v) => {
    const s = v.seekable;
    if (s && s.length) {
      const start = s.start(0);
      const end = s.end(s.length - 1);
      return {
        start: Math.max(start, end - MAX_VIDEO_DURATION),
        end: s.end(s.length - 1),
        ok: true,
      };
    }
    const b = v.buffered;
    if (b && b.length) {
      const start = b.start(0);
      const end = b.end(b.length - 1);
      return {
        start: Math.max(start, end - MAX_VIDEO_DURATION),
        end: b.end(b.length - 1),
        ok: true,
      };
    }
    return { start: 0, end: isFinite(v.duration) ? v.duration : 0, ok: false };
  };

  function findBottomContainer(v) {
    // 같은 문서에서 우선 탐색
    let c = document.querySelector(BOTTOM_SEL);
    if (c) return c;
    // Shadow DOM 호스트들 위로 탐색
    let node = v;
    while (node) {
      const root = node.getRootNode?.();
      const host = root && root.host;
      if (!host) break;
      const inHost = root.querySelector?.(BOTTOM_SEL);
      if (inHost) return inHost;
      node = host;
    }
    return null;
  }

  function mount(v) {
    if (v.__liveBarMounted) return;
    const bottom = findBottomContainer(v);
    if (!bottom) return; // 컨테이너가 아직 없음

    styleOnce();

    if (bottom.querySelector(".live-bar-box")) return; // 중복 방지

    document.querySelector(`${BOTTOM_SEL} .slider`)?.remove();

    const wrap = document.createElement("div");
    wrap.className = "live-bar-box pzp-pc__progress-slider";
    wrap.innerHTML = `
      <div class="live-bar-ui">
      <div class='slide-box'>
        <div class='track'></div>
        <div class="rng"></div>
      </div>
        <div class='time'>
          <span class="t total">0:00</span>
          <!-- <span class="t curr">0:00</span><span>/</span> -->
          <!-- <span class="t total">0:00</span> -->
          <button class="go">LIVE</button>
          <!-- <button class="slide-test">0</button> -->
        </div>
      </div>
    `;
    bottom.appendChild(wrap);

    const rng = wrap.querySelector(".rng");
    const tCurr = wrap.querySelector(".curr");
    const tTotal = wrap.querySelector(".total");
    const btn = wrap.querySelector(".go");
    const slide = wrap.querySelector(".slide-box");
    // const testBox = wrap.querySelector(".slide-test");

    const tip = document.createElement("div");
    tip.className = "hover-tip";
    tip.textContent = "0:00";
    const cross = document.createElement("div");
    cross.className = "hover-x";
    slide.appendChild(cross);
    slide.appendChild(tip);
    let raf = 0,
      lastEvt = null;

    let dragging = false;
    const useRVFC = "requestVideoFrameCallback" in v;
    let rafId = 0;

    const onMove = (e) => {
      lastEvt = e;
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (lastEvt) renderAt(lastEvt.clientX);
        });
    };

    function seekFromClick(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      wrap.classList.add("no-anim");
      const rect = slide.getBoundingClientRect();
      const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
      const ratio = rect.width ? x / rect.width : 0;

      const { start, end, ok } = getEdges(v);
      const target = start + ratio * (end - start);
      seekTo(target);

      requestAnimationFrame(() => wrap.classList.remove("no-anim"));
    }

    const atLiveEdge = (currentTime) => {
      const { end } = getEdges(v);
      // return isFinite(end) && end - v.currentTime < 2;
      return currentTime - end > -LIVE_EPS;
    };

    // 시간 포맷은 기존 timeFormat 사용
    function renderAt(clientX) {
      const rect = slide.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const ratio = rect.width ? x / rect.width : 0;

      const { start, end, ok } = getEdges(v);
      const lo = ok ? start : 0;
      const hi =
        ok && isFinite(end) ? end : isFinite(v.duration) ? v.duration : lo;
      if (!isFinite(hi) || hi <= lo) return;

      const t = lo + ratio * (hi - lo);
      const nearLive = atLiveEdge(t);

      tip.textContent = nearLive ? "LIVE" : timeFormat(t - hi); // DVR 경과시간 표기
      // 위치
      cross.style.left = `${x}px`;
      tip.style.left = `${x}px`;
    }

    function updateUI() {
      const { start, end, ok } = getEdges(v);

      const percent = (v.currentTime - start) / (end - start);
      if (end - v.currentTime < LIVE_EPS) {
        rng.style.width = "100%";
      } else {
        rng.style.width = `${Math.min(100, percent * 100)}%`;
      }

      // testBox.textContent = (v.currentTime - start).toFixed(4);
      const currentTime = Math.max(0, v.currentTime - start);
      const totalTime = Math.max(0, end - start);

      tTotal.textContent = timeFormat(Math.min(totalTime, MAX_VIDEO_DURATION));

      const live = atLiveEdge(v.currentTime);
      // btn.textContent = live ? "LIVE" : "LIVE";
      if (live) {
        btn.textContent = "LIVE";
        btn.classList.add("live", live);
      } else {
        btn.textContent = timeFormat(currentTime - totalTime);
        btn.classList.remove("live");
      }
      if (lastEvt) renderAt(lastEvt.clientX);
    }

    function seekTo(val) {
      const { start, end, ok } = getEdges(v);
      const lo = start,
        hi = end;
      v.currentTime = Math.min(hi, Math.max(lo, val));
    }

    // rng.addEventListener("input", () => {
    //   dragging = true;
    //   tCurr.textContent = timeFormat(
    //     Math.max(
    //       0,
    //       parseFloat(rng.getAttribute("value")) -
    //         parseFloat(rng.getAttribute("min"))
    //     )
    //   );
    // });

    slide.addEventListener("mousedown", seekFromClick);
    // slide.addEventListener("click", seekFromClick);
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        wrap.classList.add("no-anim");

        if (e.key === "ArrowLeft") {
          seekTo(parseFloat(v.currentTime) - 5);
        } else if (e.key === "ArrowRight") {
          seekTo(parseFloat(v.currentTime) + 5);
        }

        requestAnimationFrame(() => wrap.classList.remove("no-anim"));
      }
    });

    btn.addEventListener("click", () => {
      const { end, ok } = getEdges(v);
      if (!ok) return;
      seekTo(end - EDGE_EPS);
    });

    slide.addEventListener(
      "pointerenter",
      (e) => {
        tip.classList.add("show");
        cross.classList.add("show");
        onMove(e);
      },
      { passive: true }
    );

    slide.addEventListener("pointermove", onMove, { passive: true });

    slide.addEventListener("pointerleave", () => {
      tip.classList.remove("show");
      cross.classList.remove("show");
    });

    function loopRVFC() {
      v.requestVideoFrameCallback(() => {
        if (!dragging) updateUI();
        loopRVFC();
      });
    }
    function loopRAF() {
      updateUI();
      rafId = requestAnimationFrame(loopRAF);
    }

    [
      "loadedmetadata",
      "durationchange",
      "progress",
      "playing",
      "pause",
      "waiting",
      "seeked",
      "seeking",
      "ratechange",
      "timeupdate",
      "resize",
    ].forEach((ev) => v.addEventListener(ev, updateUI));

    updateUI();
    if (useRVFC) loopRVFC();
    else loopRAF();

    // 비디오 제거 시 정리
    const mo = new MutationObserver(() => {
      if (!document.contains(v) || !document.contains(wrap)) {
        if (rafId) cancelAnimationFrame(rafId);
        wrap.remove();
        mo.disconnect();
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    v.__liveBarMounted = true;
  }

  function tryMountAll() {
    const hasLive = location.pathname.includes("/live/");
    if (!hasLive) return;
    document.querySelectorAll(VIDEO_ELEMENT_NAME).forEach((v) => {
      const bottom = findBottomContainer(v);
      if (bottom) mount(v);
    });
  }

  // SPA URL change
  (function () {
    const fireLoc = () => setTimeout(tryMountAll, 0);
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
    document.addEventListener("DOMContentLoaded", tryMountAll, { once: true });
  } else {
    tryMountAll();
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
          tryMountAll();
        if (n.matches?.(BOTTOM_SEL) || n.querySelector?.(BOTTOM_SEL))
          tryMountAll();
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
