# Haunted House Solver

Pick the clues you found; the page shows which suspect (and weapon) they point to.
Plain HTML/CSS/JS, no build step.

## Publish on GitHub Pages
1. Create a repo and upload everything in this folder.
2. Repo **Settings → Pages → Deploy from a branch → `main` / root**.
3. Open `https://<your-username>.github.io/<repo-name>/`.

Test locally: `python3 -m http.server` in this folder, then open http://localhost:8000.
(Opening `index.html` by double-click won't load data; the browser blocks it.)

## Add this year's clues (2026)
1. Open `templates/blank-template.csv` in Google Sheets or Excel.
2. Fill it in (format below). Export as CSV.
3. Replace `data/2026.csv` with it and commit.
4. To add another year, add a line to `data/years.json` and drop in `data/<year>.csv`.

To test a sheet first without publishing, use **Upload CSV** on the page.

## CSV format
Rows 1-4 describe the clues. One column per clue.

| Column A | What the row holds |
|---|---|
| `category` | Group name per clue (Anagrams, Fabrics, ...). Any name with **"final"** = pick-one final clues. Any name with **"weapon"** = weapon clues. |
| `clue` | The clue's name |
| `hint` | Optional small text, like the scrambled anagram |
| `weapon` | Weapon clues only: the weapon that clue points to |

Every row after that is one suspect: name in column A, then `X` under each clue that suspect has.
Use `?` if you're not sure. It still counts as a match but is flagged as uncertain.
Final clues: put `X` under that suspect's final clue only.

## Notes on the 2025 data
Your three sheets disagreed in places. I used the **Clue Quick Guide** as the source of truth.
The Suspect Calculator differed for:
- **Mr. Chipper**: calculator has Stitching (no Neopet) and Rope (no Pointy Tooth). Guide has Neopet and Pointy Tooth.
- **Lady Frostbite**: calculator also gives her Rope. Guide doesn't.

Also fixed: "Beard Coam" to "Beard Comb", and the Neopet anagram to `PEENTO` (the Quick Guide and Calculator had `PENNTO`).
If the calculator was right, edit `data/2025.csv`.
