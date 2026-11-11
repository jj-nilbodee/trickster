# Trickster guide

Thai-language guide pages for Trickster Online, built with Vite and published to
GitHub Pages at https://jj-nilbodee.github.io/trickster/.

- `index.html` is the hub. Every other `.html` file in the root is a guide page and
  is picked up by the build automatically.
- Images live in `public/img/`. Pages look them up through their `IMG` map.
- `src/nav.js` and `src/nav.css` add the "back to hub" bar to each guide page.
  Include them in a new page with:
  ```html
  <link rel="stylesheet" href="/src/nav.css">
  <script type="module" src="/src/nav.js"></script>
  ```

```sh
npm install
npm run dev      # local dev server
npm run build    # output in dist/
```

Pushing to `main` builds and deploys via `.github/workflows/deploy.yml`
(Pages source must be set to "GitHub Actions").
