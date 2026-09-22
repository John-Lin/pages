import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { buildSite, renderArticle } from '../scripts/build.mjs';

test('renders Markdown as a semantic Instant View article', () => {
  const page = renderArticle('# A quiet afternoon\n\nA paragraph with **emphasis**.\n\n- First\n- Second');

  assert.match(page, /<h1 data-instant-view="title">A quiet afternoon<\/h1>/);
  assert.match(page, /<article data-instant-view="article">/);
  assert.match(page, /<p>A paragraph with <strong>emphasis<\/strong>\.<\/p>/);
  assert.match(page, /<ul>\s*<li>First<\/li>\s*<li>Second<\/li>\s*<\/ul>/);
});

test('renders standalone Markdown images as Instant View figures', () => {
  const page = renderArticle('# Article title\n\n![An image](photo.png)');

  assert.match(page, /<figure><img src="photo\.png" alt="An image" \/><\/figure>/);
  assert.doesNotMatch(page, /<p><img src="photo\.png"/);
});

test('renders the publication date beneath the article title', () => {
  const page = renderArticle('# Article title', 'style.css', '2026-09-22');

  assert.match(
    page,
    /<time class="published-date" data-instant-view="published-date" datetime="2026-09-22">September 22, 2026<\/time>/
  );
});

test('renders Markdown in the article title as safe plain text', () => {
  const page = renderArticle('# A **bold** & <em>safe</em> title');

  assert.match(page, /<h1 data-instant-view="title">A bold &amp; safe title<\/h1>/);
});

test('requires a level-one heading for the article title', () => {
  assert.throws(
    () => renderArticle('A paragraph without a Markdown title.'),
    /must start with a level-one Markdown heading/
  );
});

test('removes unsafe HTML from rendered Markdown', () => {
  const page = renderArticle('# Safe article\n\n<script>alert("no")</script>\n\n[Safe link](https://example.com)');

  assert.doesNotMatch(page, /<script|alert\("no"\)/i);
  assert.match(page, /<a href="https:\/\/example\.com">Safe link<\/a>/);
});

test('builds an archive grouped by article year', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'telegram-pages-'));
  const contentDirectory = join(directory, 'content');
  const outputDirectory = join(directory, 'docs');

  try {
    await mkdir(join(contentDirectory, 'posts'), { recursive: true });
    await writeFile(join(contentDirectory, 'posts', 'hello.md'), '---\ndate: 2026-09-22\n---\n# hello');
    await writeFile(join(contentDirectory, 'posts', 'world.md'), '---\ndate: 2026-09-22\n---\n# world');
    await writeFile(join(contentDirectory, 'posts', 'test.md'), '---\ndate: 2026-09-23\n---\n# test');

    await buildSite({ contentDirectory, outputDirectory });

    const directoryPage = await readFile(join(outputDirectory, 'index.html'), 'utf8');
    assert.match(directoryPage, /<h1>Archives<\/h1>/);
    assert.match(directoryPage, /<h2 class="archive-year-header">2026<sup class="archive-count">3<\/sup><\/h2>/);
    assert.match(directoryPage, /<h3 class="archive-month-header">September<sup class="archive-count">3<\/sup><\/h3>/);
    assert.match(directoryPage, /<a href="\/posts\/hello\/">hello<\/a>/);
    assert.match(directoryPage, /<a href="\/posts\/world\/">world<\/a>/);
    assert.match(directoryPage, /<a href="\/posts\/test\/">test<\/a>/);
    assert.doesNotMatch(directoryPage, /<time datetime=/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('requires every article to declare its publication date', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'telegram-pages-'));
  const contentDirectory = join(directory, 'content');
  const outputDirectory = join(directory, 'docs');

  try {
    await mkdir(join(contentDirectory, 'posts'), { recursive: true });
    await writeFile(join(contentDirectory, 'posts', 'undated.md'), '# Undated article');

    await assert.rejects(
      buildSite({ contentDirectory, outputDirectory }),
      /must begin with a date frontmatter block/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('requires dates in an unambiguous format', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'telegram-pages-'));
  const contentDirectory = join(directory, 'content');
  const outputDirectory = join(directory, 'docs');

  try {
    await mkdir(join(contentDirectory, 'posts'), { recursive: true });
    await writeFile(
      join(contentDirectory, 'posts', 'invalid-date.md'),
      '---\ndate: September 22\n---\n# Invalid date'
    );

    await assert.rejects(
      buildSite({ contentDirectory, outputDirectory }),
      /must include a date in YYYY-MM-DD format/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects calendar dates that do not exist', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'telegram-pages-'));
  const contentDirectory = join(directory, 'content');
  const outputDirectory = join(directory, 'docs');

  try {
    await mkdir(join(contentDirectory, 'posts'), { recursive: true });
    await writeFile(
      join(contentDirectory, 'posts', 'impossible-date.md'),
      '---\ndate: 2026-02-30\n---\n# Impossible date'
    );

    await assert.rejects(
      buildSite({ contentDirectory, outputDirectory }),
      /must include a valid date in YYYY-MM-DD format/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects raw HTML that Telegram Instant View cannot represent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'telegram-pages-'));
  const contentDirectory = join(directory, 'content');
  const outputDirectory = join(directory, 'docs');

  try {
    await mkdir(join(contentDirectory, 'posts'), { recursive: true });
    await writeFile(
      join(contentDirectory, 'posts', 'unsafe.md'),
      '---\ndate: 2026-09-22\n---\n# Unsafe article\n\n<details>Hidden content</details>'
    );

    await assert.rejects(
      buildSite({ contentDirectory, outputDirectory }),
      /Raw HTML is not supported by Telegram Instant View/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects task lists that Telegram Instant View cannot represent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'telegram-pages-'));
  const contentDirectory = join(directory, 'content');
  const outputDirectory = join(directory, 'docs');

  try {
    await mkdir(join(contentDirectory, 'posts'), { recursive: true });
    await writeFile(
      join(contentDirectory, 'posts', 'tasks.md'),
      '---\ndate: 2026-09-22\n---\n# Tasks\n\n- [x] Done\n- [ ] Not done'
    );

    await assert.rejects(
      buildSite({ contentDirectory, outputDirectory }),
      /task lists are not supported by Telegram Instant View/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects image formats that Telegram Instant View does not support', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'telegram-pages-'));
  const contentDirectory = join(directory, 'content');
  const outputDirectory = join(directory, 'docs');

  try {
    await mkdir(join(contentDirectory, 'posts'), { recursive: true });
    await writeFile(
      join(contentDirectory, 'posts', 'diagram.md'),
      '---\ndate: 2026-09-22\n---\n# Diagram\n\n![Diagram](diagram.svg)'
    );

    await assert.rejects(
      buildSite({ contentDirectory, outputDirectory }),
      /only supports GIF, JPG, and PNG images/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects images inside blockquotes that Telegram Instant View cannot represent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'telegram-pages-'));
  const contentDirectory = join(directory, 'content');
  const outputDirectory = join(directory, 'docs');

  try {
    await mkdir(join(contentDirectory, 'posts'), { recursive: true });
    await writeFile(
      join(contentDirectory, 'posts', 'quoted-image.md'),
      '---\ndate: 2026-09-22\n---\n# Quoted image\n\n> ![Picture](photo.png)'
    );

    await assert.rejects(
      buildSite({ contentDirectory, outputDirectory }),
      /images inside blockquotes are not supported by Telegram Instant View/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('builds each dated Markdown article at its source path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'telegram-pages-'));
  const contentDirectory = join(directory, 'content');
  const outputDirectory = join(directory, 'docs');
  const staticDirectory = join(directory, 'static');

  try {
    await mkdir(join(contentDirectory, 'posts'), { recursive: true });
    await mkdir(staticDirectory);
    await writeFile(
      join(contentDirectory, 'posts', 'hello.md'),
      '---\ndate: 2026-09-22\n---\n# Hello\n\nThis is ready for Telegram.'
    );
    await writeFile(join(staticDirectory, 'style.css'), 'body { color: black; }');

    await buildSite({ contentDirectory, outputDirectory, staticDirectory });

    const page = await readFile(join(outputDirectory, 'posts', 'hello', 'index.html'), 'utf8');
    const stylesheet = await readFile(join(outputDirectory, 'style.css'), 'utf8');
    assert.match(page, /<title>Hello<\/title>/);
    assert.match(page, /<article data-instant-view="article">/);
    assert.match(page, /This is ready for Telegram/);
    assert.match(page, /href="\.\.\/\.\.\/style\.css"/);
    assert.equal(stylesheet, 'body { color: black; }');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
