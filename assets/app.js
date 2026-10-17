/* Haunted House Solver
 * Loads a clue spreadsheet (CSV) for a chosen year and narrows down suspects.
 * CSV format is documented in README.md. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = { years: [], year: null, data: null, selected: new Set(), custom: false };

  /* ---------- CSV parsing ---------- */
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

  /* Turn the matrix CSV into { categories, suspects } */
  function buildData(rows) {
    const meta = {};
    const suspectRows = [];
    for (const r of rows) {
      const key = (r[0] || "").toLowerCase();
      if (["category", "clue", "hint", "weapon"].includes(key)) meta[key] = r;
      else if (r[0]) suspectRows.push(r);
    }
    if (!meta.category || !meta.clue) throw new Error('The CSV needs a "category" row and a "clue" row.');

    const categories = [];
    const byName = {};
    const clues = {};
    meta.clue.forEach((label, col) => {
      if (col === 0 || !label) return;
      const catName = meta.category[col] || "Other";
      if (!byName[catName]) {
        const low = catName.toLowerCase();
        const cat = { name: catName, kind: low.includes("weapon") ? "weapon" : low.includes("final") ? "final" : "normal", clues: [] };
        byName[catName] = cat; categories.push(cat);
      }
      const clue = {
        id: "c" + col, label,
        hint: (meta.hint && meta.hint[col]) || "",
        weapon: (meta.weapon && meta.weapon[col]) || ""
      };
      byName[catName].clues.push(clue);
      clues[clue.id] = clue;
    });

    const suspects = suspectRows.map((r) => {
      const has = new Set(), maybe = new Set();
      Object.keys(clues).forEach((id) => {
        const col = Number(id.slice(1));
        const v = (r[col] || "").toLowerCase();
        if (!v) return;
        if (v === "?" || v === "~" || v === "maybe") { has.add(id); maybe.add(id); }
        else if (!["0", "false", "no", "n"].includes(v)) has.add(id);
      });
      return { name: r[0], has, maybe };
    });
    return { categories, suspects, clues };
  }

  /* ---------- solving ---------- */
  function solve() {
    const { data, selected } = state;
    const picked = [...selected].filter((id) => data.clues[id] && !isWeaponClue(id));
    return data.suspects.map((s) => {
      const missing = picked.filter((id) => !s.has.has(id));
      const unsure = picked.filter((id) => s.maybe.has(id));
      return { s, missing, unsure, ok: missing.length === 0 };
    });
  }
  function isWeaponClue(id) {
    return state.data.categories.some((c) => c.kind === "weapon" && c.clues.some((k) => k.id === id));
  }

  /* ---------- rendering ---------- */
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v; else if (k === "text") n.textContent = v; else n.setAttribute(k, v);
    }
    kids.forEach((k) => n.append(k));
    return n;
  };

  function renderClues() {
    const host = $("clueGroups");
    host.replaceChildren();
    state.data.categories.forEach((cat) => {
      const exclusive = cat.kind !== "normal";
      const fs = el("fieldset", {}, el("legend", { text: cat.name }));
      if (exclusive) fs.firstChild.append(el("small", { text: "pick one" }));
      const chips = el("div", { class: "chips" });
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
        const span = el("span", { text: cl.label });
        if (cl.hint) span.append(el("small", { text: cl.hint }));
        chips.append(el("label", { class: "chip" }, input, span));
      });
      fs.append(chips);
      host.append(fs);
    });
  }

  function renderResults() {
    const results = solve();
    const anyPicked = [...state.selected].some((id) => !isWeaponClue(id));
    const alive = results.filter((r) => r.ok);
    const culprit = $("culprit");
    culprit.replaceChildren();

    if (!anyPicked) {
      culprit.append(answer("Your culprit is…", "Pick some clues", "", ""));
    } else if (alive.length === 1) {
      const r = alive[0];
      const note = r.unsure.length ? "Heads up: this match relies on a clue marked as uncertain (" + r.unsure.map(lbl).join(", ") + ")." : "Every clue you picked matches this suspect.";
      culprit.append(answer("Your culprit is…", r.s.name, "found", note));
    } else if (alive.length > 1) {
      culprit.append(answer("Still narrowing down", alive.length + " suspects left", "", "Check more clues, especially your final clue, to narrow it to one."));
    } else {
      const best = Math.min(...results.map((r) => r.missing.length));
      const close = results.filter((r) => r.missing.length === best).map((r) => r.s.name).join(", ");
      culprit.append(answer("No suspect matches", "Check your clues", "warn", "Closest: " + close + ". A clue may be mis-ticked, or missing from this year's data."));
    }

    const weapon = $("weapon");
    weapon.replaceChildren();
    const wc = [...state.selected].map((id) => state.data.clues[id]).find((c) => c && isWeaponClue(c.id));
    if (!state.data.categories.some((c) => c.kind === "weapon")) {
      /* no weapon clues in this data set */
    } else if (wc) {
      weapon.append(answer("The weapon is…", wc.weapon || "(weapon not listed)", wc.weapon ? "found" : "warn", "From weapon clue: " + wc.label));
    } else {
      weapon.append(answer("The weapon is…", "Pick a weapon clue", "", ""));
    }

    const list = $("suspectList");
    list.replaceChildren();
    results
      .sort((a, b) => a.missing.length - b.missing.length)
      .forEach((r) => {
        const li = el("li", { class: anyPicked ? (r.ok ? "in" : "out") : "" });
        const tag = !anyPicked ? "" : r.ok ? (r.unsure.length ? "possible ⚠" : "matches") : "ruled out";
        const nameRow = el("div", { class: "name" }, el("span", { text: r.s.name }));
        if (tag) nameRow.append(el("span", { class: "tag " + (r.ok ? (r.unsure.length ? "warn" : "in") : ""), text: tag }));
        li.append(nameRow);
        if (anyPicked && !r.ok) li.append(el("div", { class: "why", text: "Doesn't have: " + r.missing.map(lbl).join(", ") }));
        if (anyPicked && r.ok && r.unsure.length) li.append(el("div", { class: "why", text: "Uncertain on: " + r.unsure.map(lbl).join(", ") }));
        list.append(li);
      });
  }
  const lbl = (id) => state.data.clues[id].label;
  function answer(label, big, cls, note) {
    const d = el("div", { class: "answer " + cls }, el("div", { class: "label", text: label }), el("div", { class: "big", text: big }));
    if (note) d.append(el("p", { text: note }));
    return d;
  }

  function showNotice(msg, error) {
    const n = $("notice");
    n.hidden = !msg; n.textContent = msg || ""; n.className = "notice" + (error ? " error" : "");
  }

  /* ---------- storage (per-year, optional) ---------- */
  const key = () => "hh-solver-" + state.year;
  function save() { if (state.custom) return; try { localStorage.setItem(key(), JSON.stringify([...state.selected])); } catch (e) {} }
  function load() { try { return new Set(JSON.parse(localStorage.getItem(key()) || "[]")); } catch (e) { return new Set(); } }

  /* ---------- loading ---------- */
  function show(data, meta, custom) {
    state.data = data; state.custom = !!custom;
    state.selected = custom ? new Set() : load();
    [...state.selected].forEach((id) => { if (!data.clues[id]) state.selected.delete(id); });
    $("subtitle").textContent = (meta && meta.title) || "Check the clues you found. The culprit and weapon appear on the right.";
    const hasData = data.suspects.some((s) => s.has.size > 0);
    if (!hasData) {
      showNotice((meta && meta.year ? meta.year + " " : "") + "clues haven't been added yet. Fill in the CSV in data/ (see the README), or switch years above.");
    } else if (meta && meta.note) showNotice(meta.note); else showNotice("");
    $("app").querySelector(".layout").style.display = "";
    renderClues(); renderResults();
  }

  async function loadYear(year) {
    const meta = state.years.find((y) => String(y.year) === String(year));
    if (!meta) return;
    state.year = meta.year;
    try {
      const res = await fetch(meta.file, { cache: "no-cache" });
      if (!res.ok) throw new Error("Could not load " + meta.file + " (" + res.status + ")");
      show(buildData(parseCSV(await res.text())), meta, false);
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
    sel.addEventListener("change", () => loadYear(sel.value));
    $("resetBtn").addEventListener("click", () => { state.selected.clear(); save(); renderClues(); renderResults(); });
    $("uploadInput").addEventListener("change", (ev) => {
      const f = ev.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try { show(buildData(parseCSV(String(r.result))), { title: "Custom file: " + f.name, note: "Showing your uploaded file. Nothing is saved or published." }, true); }
        catch (e) { showNotice("Couldn't read that CSV: " + e.message, true); }
      };
      r.readAsText(f); ev.target.value = "";
    });
    loadYear(start);
  }
  init();
})();
