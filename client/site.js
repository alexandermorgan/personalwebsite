// Loaded render-blocking in <head> (it is tiny and cached forever), so the saved
// theme applies before first paint. The page is light by default; every change
// of the switch is saved in localStorage. It also runs in-page navigation: same-site
// link clicks and back/forward ask fixi (on <body>, see pages/_layout.html) to
// fetch the new page and swap it into <main>, leaving the header and footer alone.
// fixi itself puts the page's <title> and description into <head>.
(() => {
  const root = document.documentElement;

  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  } catch {
    // storage unavailable: keep the server default
  }

  const here = () => location.pathname + location.search;
  // The page whose content is in <main>, so back/forward between #anchors on it doesn't reload it.
  let shown = here();

  window.site = {
    setTheme(theme) {
      const apply = () => {
        root.dataset.theme = theme;
        try {
          localStorage.setItem("theme", theme);
        } catch {
          // storage unavailable: the choice lasts for this page only
        }
      };
      if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
      // Sweep the new theme across the page in a circle growing from the switch,
      // so every part of the page is fully in one theme or the other and text
      // never loses contrast. The duration is --theme-transition, shared with the
      // switch's spin.
      const box = document.querySelector(".theme-toggle")?.getBoundingClientRect();
      const x = box ? box.left + box.width / 2 : innerWidth / 2;
      const y = box ? box.top + box.height / 2 : 0;
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const [duration, easing] = getComputedStyle(root).getPropertyValue("--theme-transition").trim().split(/\s+/);
      const current = (this.themeChanges = (this.themeChanges ?? 0) + 1);
      root.classList.add("theme-changing");
      const change = document.startViewTransition(apply);
      change.ready
        .then(() =>
          root.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: parseFloat(duration) || 500, easing: easing || "ease-in-out", pseudoElement: "::view-transition-new(root)" },
          ),
        )
        .catch(() => {});
      // A quick second click starts a new sweep; only the latest one cleans up.
      change.finished.finally(() => current === this.themeChanges && root.classList.remove("theme-changing"));
    },

    /**
     * For a click on a same-site link that should load in place, return its URL;
     * otherwise return "" and let the browser handle it (new tabs, downloads,
     * other sites, anchors on this page, etc.).
     */
    link(evt) {
      if (evt.defaultPrevented || evt.button !== 0 || evt.metaKey || evt.ctrlKey || evt.shiftKey || evt.altKey) return "";
      // Until fixi has set up <body>, links load normally.
      if (!document.body?.__fixi) return "";
      const a = evt.target instanceof Element ? evt.target.closest("a[href]") : null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download") || a.hasAttribute("data-reload")) return "";
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || /\.\w+$/.test(url.pathname)) return "";
      if (url.hash && url.pathname === location.pathname && url.search === location.search) return "";
      return url.href;
    },
  };

  // The theme switch. The switch's look follows <html data-theme> (see
  // styles/app.css); its checked state is synced once the page has loaded.
  document.addEventListener("change", (evt) => {
    if (evt.target instanceof Element && evt.target.matches(".theme-toggle .switch")) {
      window.site.setTheme(evt.target.checked ? "dark" : "light");
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.querySelector(".theme-toggle .switch");
    if (toggle) toggle.checked = root.dataset.theme !== "light";
    // A reload, or coming back from another site: return to where the reader was.
    if (history.state?.scroll) scrollTo(0, history.state.scroll);
  });

  // In-page navigation. Each history entry remembers its scroll position, which
  // back/forward restores once the page's content is back.
  history.scrollRestoration = "manual";
  const saveScroll = () => history.replaceState({ ...history.state, scroll: scrollY }, "");
  addEventListener("pagehide", saveScroll);

  const navigate = (url, push) => document.body.dispatchEvent(new CustomEvent("site:navigate", { detail: { url, push } }));

  document.addEventListener("click", (evt) => {
    const url = window.site.link(evt);
    if (!url) return;
    evt.preventDefault();
    saveScroll();
    navigate(url, true);
  });

  addEventListener("popstate", () => {
    if (here() !== shown) navigate(location.href, false);
  });

  /** Where a navigation ended up: the URL after any redirects, plus the link's #anchor. */
  const destination = (cfg) => {
    const url = new URL(cfg.response?.url || cfg.action, location.href);
    url.hash = new URL(cfg.action, location.href).hash;
    return url;
  };

  /** Give up on loading in place and load the page normally. */
  const fullLoad = (cfg) => {
    const url = destination(cfg).href;
    cfg.trigger.detail.push ? location.assign(url) : location.replace(url);
  };

  document.addEventListener("fx:config", (evt) => {
    const { cfg, requests } = evt.detail;
    cfg.action = cfg.trigger.detail.url;
    // The latest navigation wins: cancel any that are still loading.
    cfg.drop = 0;
    for (const request of requests) request.abort();
  });

  document.addEventListener("fx:after", (evt) => {
    const { cfg } = evt.detail;
    // Anything but a page, which starts with its <title> (a server error, say), is left to the browser.
    if (!cfg.text.startsWith("<title>")) {
      evt.preventDefault();
      fullLoad(cfg);
    }
  });

  document.addEventListener("fx:error", (evt) => {
    // An aborted request was replaced by a newer navigation.
    if (evt.detail.error?.name !== "AbortError") fullLoad(evt.detail.cfg);
  });

  document.addEventListener("fx:swapped", (evt) => {
    const { cfg } = evt.detail;
    const { push } = cfg.trigger.detail;
    const url = destination(cfg);
    if (push && url.href !== location.href) history.pushState(null, "", url.href);
    else if (url.href !== location.href) history.replaceState(history.state, "", url.href);
    shown = here();

    const main = document.getElementById("main");
    for (const a of document.querySelectorAll(".site-nav a")) {
      if (a.pathname === location.pathname) a.setAttribute("aria-current", "page");
      else if (location.pathname.startsWith(`${a.pathname}/`)) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }

    const anchor = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!push) scrollTo(0, history.state?.scroll ?? 0);
    else if (anchor) anchor.scrollIntoView();
    else scrollTo(0, 0);
    main.focus({ preventScroll: true });
  });
})();
