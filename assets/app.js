/* Haunted House Solver
 * Loads a clue spreadsheet (CSV) + optional image file for the chosen year,
 * then narrows down suspects and weapon. Format is documented in README.md. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = { years: [], year: null, data: null, assets: {}, selected: new Set() };

  const { parseCSV, el } = window.HH;

  /* Turn the matrix CSV into { categories, suspects, clues } */
  function buildData(rows) {
    const meta = {};
    const suspectRows = [];
    for (const r of rows) {
      const key = (r[0] || "").toLowerCase();
      if (["category", "clue", "hint", "weapon"].includes(key)) meta[key] = r;
      else if (r[0]) suspectRows.push(r);
    }
    if (!meta.category || !meta.clue) throw new Error('The CSV needs a "category" row and a "clue" row.');

    const categories = [], byName = {}, clues = {};
    meta.clue.forEach((label, col) => {
      if (col === 0 || !label) return;
      const catName = meta.category[col] || "Other";
      if (!byName[catName]) {
        const low = catName.toLowerCase();
        const cat = { name: catName, kind: low.includes("weapon") ? "weapon" : (low.includes("final") || low.includes("unique")) ? "final" : "normal", clues: [] };
        byName[catName] = cat; categories.push(cat);
      }
      const clue = { id: "c" + col, label, cat: byName[catName], hint: (meta.hint && meta.hint[col]) || "", weapon: (meta.weapon && meta.weapon[col]) || "" };
      byName[catName].clues.push(clue);
      clues[clue.id] = clue;
    });

    const suspects = suspectRows.map((r) => {
      const has = new Set(), maybe = new Set();
      Object.keys(clues).forEach((id) => {
        const v = (r[Number(id.slice(1))] || "").toLowerCase();
        if (!v) return;
        if (v === "?" || v === "~" || v === "maybe") { has.add(id); maybe.add(id); }
        else if (!["0", "false", "no", "n"].includes(v)) has.add(id);
      });
      return { name: r[0], has, maybe };
    });
    return { categories, suspects, clues };
  }

  /* ---------- helpers ---------- */
  const isWeaponClue = (id) => state.data.clues[id] && state.data.clues[id].cat.kind === "weapon";
  const A = () => state.assets || {};

  /* Image with a soft placeholder if the URL is missing or fails */
  function pic(url, cls, fallbackText) {
    const ph = () => el("div", { class: cls === "ico" ? "ico-ph" : "ph", text: cls === "ico" ? "" : (fallbackText || "?").charAt(0) });
    if (!url) return ph();
    const img = el("img", { src: url, alt: "", class: cls, loading: "lazy" });
    img.addEventListener("error", () => img.replaceWith(ph()));
    return img;
  }
  /* "Blue Fabric" -> "Blue" inside Fabrics / Hair groups */
  function shortLabel(clue) {
    const n = clue.cat.name.toLowerCase();
    return n.includes("fabric") || n.includes("hair") ? clue.label.replace(/\s+(Fabric|Fabric Scrap|Hair)$/i, "") : clue.label;
  }
  function ordered(list, order, nameOf) {
    if (!order || !order.length) return list;
    const rank = (x) => { const i = order.indexOf(nameOf(x)); return i < 0 ? 999 : i; };
    return [...list].sort((a, b) => rank(a) - rank(b));
  }

  /* ---------- solving ---------- */
  function solve() {
    const picked = [...state.selected].filter((id) => state.data.clues[id] && !isWeaponClue(id));
    return state.data.suspects.map((s) => {
      const missing = picked.filter((id) => !s.has.has(id));
      const unsure = picked.filter((id) => s.maybe.has(id));
      return { s, missing, unsure, ok: missing.length === 0 };
    });
  }

  /* ---------- rendering: clue picker ---------- */
  function renderClues() {
    const host = $("clueGroups");
    host.replaceChildren();
    const notes = A().categoryNotes || {};
    state.data.categories.forEach((cat) => {
      const exclusive = cat.kind !== "normal";
      const head = el("div", { class: "group-head" }, el("h3", { text: cat.name }));
      if (notes[cat.name]) head.append(el("p", { text: notes[cat.name] }));
      /* pick a column count that fills the rows evenly: 2->2, 3->3, 4->2x2, 6->3x2 */
      const n = cat.clues.length, cols = n <= 3 ? n : n % 3 === 0 ? 3 : n % 2 === 0 ? 2 : 3;
      const chips = el("div", { class: "chips", style: "--cols:" + cols });
      cat.clues.forEach((cl) => {
        const input = el("input", { type: "checkbox", value: cl.id });
        input.checked = state.selected.has(cl.id);
        input.addEventListener("change", () => {
          if (input.checked) {
            if (exclusive) cat.clues.forEach((o) => state.selected.delete(o.id));
            state.selected.add(cl.id);
          } else state.selected.delete(cl.id);
          if (exclusive) renderClues();
          save(); renderResults();
        });
        const iconUrl = (A().clueIcons || {})[cl.label] || (A().categoryIcons || {})[cat.name];
        const txt = el("span", { class: "txt" });
        if (cl.hint) { txt.append(el("span", { class: "main", text: cl.hint }), el("span", { class: "small", text: cl.label })); }
        else txt.append(el("span", { class: "main", text: shortLabel(cl) }));
        chips.append(el("label", { class: "chip" + (cl.hint ? " anagram" : "") }, input, el("span", { class: "chip-body" }, pic(iconUrl, "ico"), txt)));
      });
      host.append(el("div", { class: "group" }, head, chips));
    });
  }

  /* ---------- rendering: suspects, weapons, summary ---------- */
  function renderResults() {
    const results = solve();
    const picked = [...state.selected].filter((id) => !isWeaponClue(id));
    const anyPicked = picked.length > 0;
    /* until suspects have clue data, never rule anyone out */
    const judge = anyPicked && state.data.suspects.some((s) => s.has.size > 0);
    const alive = results.filter((r) => r.ok);
    const assets = A();

    /* suspects */
    const grid = $("suspectGrid");
    grid.replaceChildren();
    ordered(results, assets.suspectOrder, (r) => r.s.name).forEach((r) => {
      const info = (assets.suspects || {})[r.s.name] || {};
      const cls = "card" + (!judge ? "" : r.ok ? " on" + (r.unsure.length ? " maybe" : "") : " out");
      const card = el("div", { class: cls }, el("div", { class: "pic" }, pic(info.image, "", r.s.name)), el("div", { class: "name", text: r.s.name }));
      if (info.species) card.append(el("div", { class: "sub", text: info.species }));
      grid.append(card);
    });

    const note = $("culpritNote");
    if (judge && alive.length === 0) {
      const best = Math.min(...results.map((r) => r.missing.length));
      note.textContent = "No suspect matches those clues. Double-check what you ticked. Closest: " + results.filter((r) => r.missing.length === best).map((r) => r.s.name).join(", ") + ".";
      note.hidden = false;
    } else if (alive.length === 1 && alive[0].unsure.length) {
      note.textContent = "This match relies on a clue marked as uncertain (" + alive[0].unsure.map((id) => state.data.clues[id].label).join(", ") + ").";
      note.hidden = false;
    } else note.hidden = true;

    /* clues selected line */
    const line = $("selectedLine");
    line.replaceChildren();
    if (anyPicked) {
      const names = state.data.categories.filter((c) => c.kind !== "weapon").flatMap((c) => c.clues).filter((c) => state.selected.has(c.id)).map((c) => (c.hint || c.label).toUpperCase());
      line.append(el("b", { text: "Clues selected: " }), document.createTextNode(names.join(", ")));
    }

    /* weapons */
    const weaponClues = state.data.categories.filter((c) => c.kind === "weapon").flatMap((c) => c.clues);
    const chosen = weaponClues.find((c) => state.selected.has(c.id));
    const names = [...new Set(weaponClues.map((c) => c.weapon).filter(Boolean))];
    $("weaponPanel").hidden = names.length === 0;
    const wGrid = $("weaponGrid");
    wGrid.replaceChildren();
    ordered(names, assets.weaponOrder, (n) => n).forEach((n) => {
      const on = chosen && chosen.weapon === n;
      const cls = "card weapon" + (on ? " on" : "");
      wGrid.append(el("div", { class: cls }, el("div", { class: "pic" }, pic((assets.weapons || {})[n], "", n)), el("div", { class: "name", text: n })));
    });
  }

  function showNotice(msg, error) {
    const n = $("notice");
    n.hidden = !msg; n.textContent = msg || ""; n.className = "notice" + (error ? " error" : "");
  }

  /* ---------- storage (per-year, optional) ---------- */
  const key = () => "hh-solver-" + state.year;
  function save() { try { localStorage.setItem(key(), JSON.stringify([...state.selected])); } catch (e) {} }
  function load() { try { return new Set(JSON.parse(localStorage.getItem(key()) || "[]")); } catch (e) { return new Set(); } }

  /* ---------- loading ---------- */
  async function loadYear(year) {
    const meta = state.years.find((y) => String(y.year) === String(year));
    if (!meta) return;
    state.year = meta.year;
    try {
      const res = await fetch(meta.file, { cache: "no-cache" });
      if (!res.ok) throw new Error("Could not load " + meta.file + " (" + res.status + ")");
      const data = buildData(parseCSV(await res.text()));
      let assets = {};
      if (meta.assets) {
        try { const r = await fetch(meta.assets, { cache: "no-cache" }); if (r.ok) assets = await r.json(); } catch (e) { /* images are optional */ }
      }
      state.data = data; state.assets = assets;
      state.selected = load();
      [...state.selected].forEach((id) => { if (!data.clues[id]) state.selected.delete(id); });
      document.querySelector(".clues-head p").textContent = assets.intro || "Select every clue you were given.";
      showNotice(data.suspects.some((s) => s.has.size > 0) ? "" : meta.year + " is still being filled in. Suspect matches will show up once clues are confirmed.");
      const up = $("updated"), d = meta.updated ? new Date(meta.updated) : null;
      up.hidden = true;
      try {
        if (d && !isNaN(d)) {
          up.textContent = "Last updated " + d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
          up.hidden = false;
        }
      } catch (e) { /* the note is optional; never let it block the page */ }
      renderClues(); renderResults();
    } catch (e) { showNotice(e.message, true); }
  }

  async function init() {
    try {
      const res = await fetch("data/years.json", { cache: "no-cache" });
      state.years = await res.json();
    } catch (e) { showNotice("Could not load data/years.json. If you opened this file directly, run it through a web server or GitHub Pages.", true); return; }
    const sel = $("yearSelect");
    state.years.forEach((y) => sel.append(el("option", { value: y.year, text: y.year })));
    const params = new URLSearchParams(location.search);
    const start = params.get("year") || (state.years.find((y) => y.default) || state.years[0]).year;
    sel.value = start;
    sel.parentElement.hidden = state.years.length < 2;
    sel.addEventListener("change", () => loadYear(sel.value));
    $("resetBtn").addEventListener("click", () => { state.selected.clear(); save(); renderClues(); renderResults(); });
    loadYear(start);
    window.HH.renderNav("nav");
  }
  init();
})();
