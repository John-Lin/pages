# Telegram Instant View Pages

A small GitHub Pages site that turns one Markdown article into a clean static page. The published page contains the complete article HTML, so Telegram Instant View can parse it without depending on browser JavaScript.

## Write and preview

1. Edit [`content/article.md`](content/article.md). Its first level-one heading (`# Title`) becomes the page title.
2. Install dependencies with `npm install`.
3. Run `npm run build`.
4. Open `docs/index.html` in a browser.

Markdown supports headings, links, images, lists, quotes, code blocks, and tables. Use absolute `https://` image URLs; a relative image path must point to a file copied from [`static/`](static/).

## Publish with GitHub Pages

1. Create a GitHub repository and push the `main` branch.
2. In **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**.
3. Push to `main`. The included workflow builds and deploys `docs/`.

The workflow intentionally deploys only from `main`; work can remain on a WIP branch until it is ready.

## Enable Telegram Instant View

Instant View is configured in Telegram for a domain, not embedded or automatically activated by the website. After GitHub Pages gives the site its final public URL:

1. Open [Instant View](https://instantview.telegram.org/).
2. Create a template for the deployed GitHub Pages domain.
3. Paste [`telegram-instant-view.tmpl`](telegram-instant-view.tmpl).
4. Test it against the article URL, then publish the template.

The template selects `h1[data-instant-view="title"]` for the title and `article[data-instant-view="article"]` for the body. Keep those elements and their attributes intact, otherwise Instant View will not see the article correctly.

## Verification

Run `npm test` before publishing. The tests verify Markdown rendering, HTML sanitization, and the static HTML shape required by the Instant View template.
