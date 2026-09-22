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

test('builds the Markdown article as a deployable index page', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'telegram-pages-'));
  const outputDirectory = join(directory, 'docs');
  const staticDirectory = join(directory, 'static');

  try {
    await mkdir(staticDirectory);
    await writeFile(join(directory, 'content.md'), '# Published article\n\nThis is ready for Telegram.');
    await writeFile(join(staticDirectory, 'style.css'), 'body { color: black; }');

    await buildSite({ inputPath: join(directory, 'content.md'), outputDirectory, staticDirectory });

    const page = await readFile(join(outputDirectory, 'index.html'), 'utf8');
    const stylesheet = await readFile(join(outputDirectory, 'style.css'), 'utf8');
    assert.match(page, /<title>Published article<\/title>/);
    assert.match(page, /<article data-instant-view="article">/);
    assert.match(page, /This is ready for Telegram/);
    assert.equal(stylesheet, 'body { color: black; }');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
