# Trickster guide

Thai-language guide pages for Trickster Online, built with [VitePress](https://vitepress.dev) (Vue + Vite)
and published to GitHub Pages at https://jj-nilbodee.github.io/trickster/.

## Layout

```
docs/
  index.md                 hub (home page)
  <guide>.md               7 guides: daily quests, card quests, skill mastery, …
  key-<zone>.md            11 key-quest pages, in game order in the sidebar
  assets/img/              all images, referenced as ./assets/img/<file>
  .vitepress/
    config.mts             site title, sidebar, search, base path
    theme/
      index.ts             extends the default theme, loads the styles below
      PageBehavior.vue     runs a page's checklist scripts (placed at the end of each page)
      behaviors-guide.js   ticks, section counters, search, hide-done for guides
      behaviors-key.js     hide rows, item totals, "ready" badges for key quests
      zones/<zone>.js      each key-quest zone's progress counter
      styles/              guide.css, key.css, hub.css, palettes.css (per-page colours), layout.css
```

Each page's frontmatter says which scripts run:

- guides: `kind: guide`, `storageKey` (where ticks are saved in the browser), `daily: true` to reset every day
- key quests: `kind: key`, `zone` (file in `theme/zones/`), `hiddenKey`

Text is Markdown; the interactive tables stay as HTML blocks inside the Markdown because their cells hold checkboxes.
Ticks are saved per browser in `localStorage`, under the same keys as the old pages.

## Adding a page

1. Copy a page of the same kind, change the frontmatter keys and the content.
2. Add colours for it in `theme/styles/palettes.css` (`data-page` is the file name).
3. Add it to the sidebar in `.vitepress/config.mts` and, if you like, a card in `index.md`.

## Commands

```sh
npm install
npm run dev       # local dev server with hot reload
npm run build     # output in docs/.vitepress/dist
npm run preview   # serve the built site
```

Pushing to `main` builds and deploys via `.github/workflows/deploy.yml`.
