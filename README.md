# Entropic Software Labs

The studio site for Entropic Software Labs (entropicsoftwarelabs.com). The homepage is about the studio; `projects/` lists every app, and each app has its own page.

It is plain HTML, CSS and a little JavaScript. There is no build step and no dependencies.

Preview it locally:

- `npx serve .` and open the address it prints, or
- open `index.html` in a browser (root-relative links like `/css/site.css` need the server, so use `serve` for a faithful preview).

Deploy: Cloudflare Pages serves the repo root as-is. Leave the build command empty and set the output directory to `/`. `_headers` sets the security headers and the asset cache rules.

Layout: `index.html`, `projects/index.html` and `404.html` at the root, styles in `css/site.css`, scripts in `js/`, images in `assets/`. The Content-Security-Policy blocks inline scripts and styles, so keep both in their own files.
