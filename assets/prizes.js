/* Past prizes page. Reads data/nav.json for the year list and data/prizes/<year>.csv for the items.
 * CSV columns: Type, Image URL, Name, Nipots Cost, URL */
(function () {
  "use strict";
  const { parseCSV, el } = window.HH;
  const $ = (id) => document.getElementById(id);

  function notice(msg) { const n = $("notice"); n.hidden = !msg; n.textContent = msg || ""; }

  async function init() {
    let nav;
    try { nav = await (await fetch("data/nav.json", { cache: "no-cache" })).json(); }
    catch (e) { notice("Could not load data/nav.json. Run this through a web server or GitHub Pages."); return; }

    const avail = (nav.prizes || []).filter((p) => !p.soon);
    const wanted = new URLSearchParams(location.search).get("year");
    const entry = avail.find((p) => String(p.year) === wanted) || avail[0];
    window.HH.renderNav("nav", entry && entry.year);
    if (!entry) { notice("No past prizes have been added yet."); return; }

    $("prizeTitle").textContent = entry.year + " Prizes";
    document.title = "Haunted House " + entry.year + " Prizes";

    let rows;
    try {
      const res = await fetch(entry.file, { cache: "no-cache" });
      if (!res.ok) throw new Error();
      rows = parseCSV(await res.text()).slice(1).filter((r) => r[2]);
    } catch (e) { notice("Could not load " + entry.file + "."); return; }

    const items = rows.map((r) => ({ type: (r[0] || "Other").replace(/^"+|"+$/g, ""), image: r[1], name: r[2], cost: Number(r[3]) || 0, url: r[4] }));
    const byName = (a, b) => a.name.localeCompare(b.name);
    const sorts = {
      type: (a, b) => a.type.localeCompare(b.type) || byName(a, b),
      name: byName,
      cost: (a, b) => a.cost - b.cost || byName(a, b)
    };

    let mode = "type", dir = 1;
    const label = { type: "Type", name: "A-Z", cost: "Cost" };
    function draw() {
      document.querySelectorAll(".sort-btn").forEach((b) => {
        const on = b.dataset.sort === mode;
        b.classList.toggle("current", on);
        b.textContent = label[b.dataset.sort] + (on ? (dir === 1 ? " \u2191" : " \u2193") : "");
        b.setAttribute("aria-pressed", on);
      });
      const grid = $("prizeGrid");
      grid.replaceChildren();
      [...items].sort((a, b) => dir * sorts[mode](a, b)).forEach((it) => {
        const img = el("img", { src: it.image, alt: "", loading: "lazy" });
        img.addEventListener("error", () => img.remove());
        const card = el(it.url ? "a" : "div", { class: "prize" }, el("div", { class: "pic" }, img), el("div", { class: "name", text: it.name }),
          el("div", { class: "cost", text: it.cost + (it.cost === 1 ? " Nipot" : " Nipots") }), el("div", { class: "type", text: it.type }));
        if (it.url) { card.href = it.url; card.target = "_blank"; card.rel = "noopener"; }
        grid.append(card);
      });
    }
    document.querySelectorAll(".sort-btn").forEach((b) => b.addEventListener("click", () => { dir = b.dataset.sort === mode ? -dir : 1; mode = b.dataset.sort; draw(); }));
    $("prizePanel").hidden = false;
    draw();
  }
  init();
})();
