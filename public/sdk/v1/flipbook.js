/*!
 * Flipbook embed, v1 — shows a flipbook viewer link on any web page.
 * Docs: /docs on the site this file is served from.
 *
 *   <div data-flipbook-url="VIEWER_URL"></div>
 *   <script src="https://newsletter.smithtonchurch.com/sdk/v1/flipbook.js" async></script>
 *
 * or from your own script:
 *
 *   const viewer = Flipbook.mount("#newsletter", { url: VIEWER_URL, height: 720 });
 *   viewer.on("pagechange", (e) => console.log(e.pageNumber, "of", e.pageCount));
 *
 * VIEWER_URL is the `url` your server gets from POST /api/v1/viewer-tokens. Never put your
 * secret API key in a web page.
 */
(function () {
  "use strict";
  if (window.Flipbook && window.Flipbook.version) return;

  var EVENTS = ["ready", "pagechange", "linkclick"];

  function cssSize(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    return typeof value === "number" || /^\d+$/.test(String(value)) ? value + "px" : String(value);
  }

  function resolveTarget(target) {
    var el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el || el.nodeType !== 1) throw new Error("Flipbook.mount: target element not found");
    return el;
  }

  /**
   * Puts a viewer into `target` (an element or a CSS selector).
   * Options: url (required), height (default 720, number = px, or any CSS size), title,
   * className, onReady, onPageChange, onLinkClick.
   * Returns { iframe, on(event, fn), off(event, fn), destroy() }.
   */
  function mount(target, options) {
    var el = resolveTarget(target);
    options = options || {};
    var viewerUrl;
    try {
      viewerUrl = new URL(options.url, window.location.href);
    } catch {
      throw new Error("Flipbook.mount: `url` must be the viewer URL from your server");
    }
    if (!/^\/v1\/view\/[^/]+$/.test(viewerUrl.pathname)) {
      throw new Error("Flipbook.mount: `url` must be the viewer URL from your server (…/v1/view/…)");
    }

    var listeners = { ready: [], pagechange: [], linkclick: [] };
    if (options.onReady) listeners.ready.push(options.onReady);
    if (options.onPageChange) listeners.pagechange.push(options.onPageChange);
    if (options.onLinkClick) listeners.linkclick.push(options.onLinkClick);

    var iframe = document.createElement("iframe");
    iframe.src = viewerUrl.href;
    iframe.title = options.title || "Document viewer";
    iframe.allow = "fullscreen";
    iframe.allowFullscreen = true;
    iframe.loading = "lazy";
    iframe.style.cssText = "display:block;width:100%;border:0;height:" + cssSize(options.height, "720px");
    if (options.className) iframe.className = options.className;
    el.appendChild(iframe);

    function handleMessage(e) {
      // Only messages from this viewer's own frame and origin.
      if (e.source !== iframe.contentWindow || e.origin !== viewerUrl.origin) return;
      var data = e.data;
      if (!data || data.source !== "flipbook" || EVENTS.indexOf(data.type) === -1) return;
      var detail = { type: data.type, pageNumber: data.pageNumber, pageCount: data.pageCount, url: data.url };
      listeners[data.type].slice().forEach(function (fn) {
        try {
          fn(detail);
        } catch (err) {
          setTimeout(function () {
            throw err;
          });
        }
      });
      el.dispatchEvent(new CustomEvent("flipbook:" + data.type, { detail: detail, bubbles: true }));
    }
    window.addEventListener("message", handleMessage);

    var instance = {
      iframe: iframe,
      on: function (type, fn) {
        if (!listeners[type]) throw new Error("Flipbook: unknown event " + type);
        listeners[type].push(fn);
        return instance;
      },
      off: function (type, fn) {
        if (listeners[type]) listeners[type] = listeners[type].filter(function (f) { return f !== fn; });
        return instance;
      },
      destroy: function () {
        window.removeEventListener("message", handleMessage);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      },
    };
    el.__flipbook = instance;
    return instance;
  }

  /** Mounts every `[data-flipbook-url]` element not mounted yet (data-flipbook-height, data-flipbook-title). */
  function mountAll(root) {
    var nodes = (root || document).querySelectorAll("[data-flipbook-url]");
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.__flipbook) continue;
      try {
        mount(node, {
          url: node.getAttribute("data-flipbook-url"),
          height: node.getAttribute("data-flipbook-height") || undefined,
          title: node.getAttribute("data-flipbook-title") || undefined,
        });
      } catch (err) {
        console.error(err);
      }
    }
  }

  window.Flipbook = { version: "1", mount: mount, mountAll: mountAll };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { mountAll(); });
  else mountAll();
})();
