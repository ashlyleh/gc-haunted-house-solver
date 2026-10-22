# Haunted House Solver

Pick the clues you found; the page shows which suspect (and weapon) they point to.
Plain HTML/CSS/JS, no build step.

## Publish on GitHub Pages
1. Create a repo and upload everything in this folder.
2. Repo **Settings → Pages → Deploy from a branch → `main` / root**.
3. Open `https://<your-username>.github.io/<repo-name>/`.

Test locally: `python3 -m http.server` in this folder, then open http://localhost:8000.
(Opening `index.html` by double-click won't load data; the browser blocks it.)

## Fill in the 2026 suspects
1. Open `templates/blank-template.csv` in Google Sheets or Excel.
2. Fill it in (format below). Export as CSV.
3. Replace `data/2026.csv` with it and commit.
4. To add another year, add a line to `data/years.json` and drop in `data/<year>.csv`.

## CSV format
Rows 1-4 describe the clues. One column per clue.

| Column A | What the row holds |
|---|---|
| `category` | Group name per clue (Anagrams, Fabrics, ...). Any name with **"final"** or **"unique"** = pick-one clues. Any name with **"weapon"** = weapon clues. |
| `clue` | The clue's name |
| `hint` | Optional small text, like the scrambled anagram |
| `weapon` | Weapon clues only: the weapon that clue points to |

Every row after that is one suspect: name in column A, then `X` under each clue that suspect has.
Use `?` if you're not sure. It still counts as a match but is flagged as uncertain.
Pick-one clues (unique/final): put `X` under that suspect's own clue only.

## Images
Images live in `data/2026.assets.json`: clue icons (matched by the clue name in the CSV), suspect photo + species, and weapon images.
A missing image shows a grey circle with the first letter, so you can add them one at a time.

## Buttons
The button row above the solver comes from `data/nav.json`. Add `{ "label": "...", "url": "..." }` to `links`.

## "Last updated" note
Shown under the contact line for the selected year. To change it, edit that year's `"updated"` value in `data/years.json`, e.g. `"2026-10-18T09:30:00-05:00"` (the `-05:00` is Central Daylight Time; use `-06:00` after clocks fall back in November).
Visitors see it converted to their own time zone. Leave `updated` out and nothing is shown.
