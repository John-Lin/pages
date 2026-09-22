# Telegram Instant View Pages

A small GitHub Pages publisher for Markdown articles. Each article is converted to complete semantic HTML during the build, so Telegram Instant View can fetch it without browser JavaScript.

## Add an article

Create a Markdown file below `content/posts/`. The source path becomes the public URL:

```text
content/posts/hello.md        → https://pages.johnlin.dev/posts/hello/
content/posts/notes/world.md  → https://pages.johnlin.dev/posts/notes/world/
```

Every article must start with its publication date, followed by a level-one title:

```markdown
---
date: 2026-09-22
---
# Article title

Article content goes here.
```

The generated home page is an article directory. It groups links by date and lists the newest dates first.

Put shared images and other static files in `static/`. Refer to them with a root-relative URL, for example `![Description](/images/photo.png)`. Images intended for Instant View must be GIF, JPG, or PNG.

## Instant View-safe Markdown

The publisher accepts headings, paragraphs, emphasis, strikethrough, links, ordered and unordered lists, blockquotes, horizontal rules, fenced code blocks, simple tables, and GIF/JPG/PNG images.

The build fails rather than silently losing content in Instant View when an article contains raw HTML, task-list checkboxes, an unsupported image format, or an image inside a blockquote. Avoid embeds, Mermaid diagrams, and complex tables because Telegram Instant View cannot reliably represent them.

## Build and preview

1. Install dependencies with `npm install`.
2. Run `npm test`.
3. Run `npm run build`.
4. Open `docs/index.html` in a browser.

## Publish with GitHub Pages

The included GitHub Actions workflow builds and deploys the site when `main` changes. In the repository's **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**.

## Enable Telegram Instant View

Instant View is configured in Telegram for a domain, not embedded or automatically activated by the website. After publishing:

1. Open [Instant View](https://instantview.telegram.org/).
2. Create or update the template for the public domain.
3. Paste [`telegram-instant-view.tmpl`](telegram-instant-view.tmpl).
4. Test each article URL, then submit the template for Telegram review.

The template selects `h1[data-instant-view="title"]` for the title and `article[data-instant-view="article"]` for the body. Keep those elements and their attributes intact.
