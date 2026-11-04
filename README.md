# Floor Plan

A lightweight floor plan editor that runs entirely in the browser. It is a plain static site (HTML, CSS and JavaScript) with no build step, no server and no external libraries.

## Features

- **Units:** mm, cm, m, inches, feet and feet-inches. You can type any unit in any field, e.g. `3.5m`, `350cm` or `12'6"`.
- **Walls** have mitred corners and snap to T-junctions. You can type an exact length while drawing.
- **Rooms** can be drawn three ways:
  - drag a rectangle;
  - click the corners of a polygon (L- or U-shaped);
  - use **Auto Room**: click inside the walls and the room is created to fit them exactly.
- **Doors and windows** snap onto walls: door, double, unequal double, bi-fold, double bi-fold, 2- and 3-panel sliding, pocket door, roller shutter, cased opening, window, sliding window and louvre (nako).
- **Furniture and fixtures library:** about 66 symbols in Living, Bedroom, Kitchen, Bathroom, Electrical and Outdoor. Items snap to wall faces and show alignment guides.
- **Annotations:** text labels and a north arrow.
- **Editing:** multi-select, groups (Ctrl+G), copy and paste across sheets.
- **Sheets** for design options (Option A, Option B, and so on).
- **Underlay:** import a picture of an existing plan, calibrate its scale, and trace over it.
- **Print / PDF to scale** (1:20 to 1:200, or best fit) on A4, A3 or A2, with a title block.
- **Quantities (BQ):** floor areas, skirting, wall-finish areas, door, window and fixture counts, and cabinet runs. Exports to CSV for Excel or Google Sheets.
- **Export** as PNG or SVG. Projects save and open as `.json` files.
- **Interface:** light and dark mode, and installable as an app (PWA) that works offline.

## Run locally

Open `index.html` in Chrome, Edge, Firefox or Safari. Nothing needs to be installed.

When the app is opened straight from the folder (`file://`), it works fully, but **install / offline mode is off**. Browsers only allow service workers over `http(s)`.

## Deploy to GitHub Pages (free)

1. Create a new repository on GitHub, e.g. `floor-plan`.
2. Upload **everything in this folder**, including the hidden `.nojekyll` file:
   - `index.html`, `style.css`, `sw.js`, `manifest.webmanifest`, `.nojekyll`
   - the `js/`, `fonts/` and `icons/` folders

   You can upload with the GitHub website (*Add file → Upload files*), with GitHub Desktop, or with git:

   ```bash
   git init
   git add .
   git commit -m "Floor Plan"
   git branch -M main
   git remote add origin https://github.com/<your-user>/floor-plan.git
   git push -u origin main
   ```

3. In the repository, go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, then branch **main** and folder **/ (root)**, and press **Save**.
4. After a minute or two the site is live at `https://<your-user>.github.io/floor-plan/`.

### Updating the live site

Push or upload the changed files. The service worker fetches from the network first, so users get the new version on their next visit.

If you **add, rename or remove** a file:

- update the `ASSETS` list in `sw.js` so the file is available offline;
- bump `CACHE` (e.g. `floorplan-v2`) so old caches are cleared.

## Where data is stored

Everything stays on the user's own device. Nothing is uploaded anywhere.

- **Autosave** goes to the browser's local storage, separately for each browser and each site address. It is cleared if the user clears site data.
- **Save** (Ctrl+S) downloads a `.json` project file. Use it for backups and to move work between computers. **Open** (Ctrl+O) loads it back.
- Large underlay images use a lot of space. If browser storage fills up, autosave stops and the app shows a warning. Saving to a file always works.

## Project structure

```
index.html            page layout, dialogs, canvas styles
style.css             UI styles (light / dark theme, print layout)
sw.js                 service worker (offline cache)
manifest.webmanifest  install metadata
fonts/                Google Sans (SIL Open Font License, see fonts/OFL.txt)
icons/                app icons
js/                   plain scripts loaded in order (not ES modules, so file:// works)
  units.js            unit formatting and parsing
  state.js            app state, item geometry helpers, opening types
  catalog.js          drawing primitives, built-in furniture, tool definitions
  library.js          extended furniture / fixture library
  store.js            undo history, autosave, sheets, clipboard
  view.js             zoom / pan, snapping
  geometry.js         polygons, wall outlines, auto room detection
  render.js           SVG rendering
  panels.js           Properties and Summary panels
  actions.js          tools, rooms, groups, placement
  input.js            mouse and keyboard
  io.js               open / save / PNG and SVG export
  print.js            print / PDF to scale with title block
  underlay.js         underlay image import and calibration
  bq.js               quantities and CSV export
  ui.js               toolbar and tool palette
  main.js             start-up
```

## Licence notes

Google Sans is included under the SIL Open Font License 1.1 (`fonts/OFL.txt`).
