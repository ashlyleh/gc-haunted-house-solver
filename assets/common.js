/* Shared helpers: CSV parser, tiny DOM builder, and the top button row (data/nav.json). */
(function () {
  "use strict";

  function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", inQ = false;
    text = text.replace(/^﻿/, "");
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
        } else cell += c;
      } else if (c === '"') inQ = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.map((r) => r.map((v) => v.trim()));
  }

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v; else if (k === "text") n.textContent = v; else n.setAttribute(k, v);
    }
    kids.forEach((k) => n.append(k));
    return n;
  };

  /* Buttons above the solver: external links + one button per past-prizes year */
  async function renderNav(hostId, currentPrizeYear) {
    const host = document.getElementById(hostId);
    if (!host) return;
    let nav;
    try { nav = await (await fetch("data/nav.json", { cache: "no-cache" })).json(); } catch (e) { return; }
    host.replaceChildren();

    const links = el("div", { class: "nav-group" });
    if (document.body.dataset.page === "prizes") links.append(el("a", { class: "nav-btn", href: "index.html", text: "Solver" }));
    (nav.links || []).forEach((l) => links.append(el("a", { class: "nav-btn", href: l.url, target: "_blank", rel: "noopener", text: l.label })));
    host.append(links);

    if ((nav.prizes || []).length) {
      const g = el("div", { class: "nav-group" }, el("span", { class: "nav-label", text: nav.prizesLabel || "Past Prizes" }));
      nav.prizes.forEach((p) => {
        if (p.soon) g.append(el("span", { class: "nav-btn soon", title: "Coming soon", "aria-disabled": "true", text: p.year }));
        else g.append(el("a", { class: "nav-btn" + (String(p.year) === String(currentPrizeYear) ? " current" : ""), href: "prizes.html?year=" + p.year, text: p.year }));
      });
      host.append(g);
    }
  }

  window.HH = { parseCSV, el, renderNav };
})();
