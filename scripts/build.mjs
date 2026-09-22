import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, '..');
const sanitizerOptions = {
  allowedTags: [
    'a', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'figcaption', 'figure',
    'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img', 'li', 'ol', 'p', 'pre', 's',
    'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul'
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    code: ['class'],
    img: ['alt', 'height', 'src', 'title', 'width']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false
};

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function titleText(tokens) {
  return tokens.map((token) => {
    if (token.type === 'html') {
      return '';
    }

    return token.tokens ? titleText(token.tokens) : token.text;
  }).join('');
}

function articleParts(markdown) {
  const tokens = marked.lexer(markdown);
  const titleIndex = tokens.findIndex((token) => token.type === 'heading' && token.depth === 1);

  if (titleIndex === -1) {
    throw new Error('The article must start with a level-one Markdown heading (# Title).');
  }

  const [titleToken] = tokens.splice(titleIndex, 1);
  const title = titleText(titleToken.tokens);
  const body = sanitizeHtml(marked.parser(tokens), sanitizerOptions);

  return { body, title };
}

function directoryDate(date) {
  const [, month, day] = date.split('-');
  return `${Number(month)}月${Number(day)}日`;
}

function renderDirectory(articles) {
  const articlesByDate = Map.groupBy(
    [...articles].sort((left, right) => right.date.localeCompare(left.date) || left.title.localeCompare(right.title)),
    (article) => article.date
  );
  const groups = [...articlesByDate].map(([date, dateArticles]) => `      <section class="archive-day">
        <h2><time datetime="${date}">${directoryDate(date)}</time></h2>
        <ul>
${dateArticles.map((article) => `          <li><a href="${article.url}">${escapeHtml(article.title)}</a></li>`).join('\n')}
        </ul>
      </section>`).join('\n');

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>文章目錄</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="page">
    <header class="article-header">
      <h1>文章目錄</h1>
    </header>
    <nav aria-label="文章目錄">
${groups}
    </nav>
  </main>
</body>
</html>
`;
}

function displayDate(date) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`));
}

export function renderArticle(markdown, stylesheetHref = 'style.css', publishedDate) {
  const { body, title } = articleParts(markdown);
  const safeTitle = escapeHtml(title);
  const dateMarkup = publishedDate
    ? `\n      <time class="published-date" data-instant-view="published-date" datetime="${publishedDate}">${displayDate(publishedDate)}</time>`
    : '';

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${safeTitle}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${safeTitle}">
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="${stylesheetHref}">
</head>
<body>
  <main class="page">
    <header class="article-header">
      <h1 data-instant-view="title">${safeTitle}</h1>${dateMarkup}
    </header>
    <article data-instant-view="article">
      <div class="article-body">
${body}
      </div>
    </article>
  </main>
</body>
</html>
`;
}

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return markdownFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : [];
  }));

  return files.flat();
}

function containsRawHtml(tokens) {
  return tokens.some((token) => token.type === 'html' || (token.tokens && containsRawHtml(token.tokens)));
}

function containsTaskList(tokens) {
  return tokens.some((token) => token.task || (token.tokens && containsTaskList(token.tokens)) || (token.items && containsTaskList(token.items)));
}

function containsImageInBlockquote(tokens, insideBlockquote = false) {
  return tokens.some((token) => {
    const isInsideBlockquote = insideBlockquote || token.type === 'blockquote';

    if (isInsideBlockquote && token.type === 'image') {
      return true;
    }

    return (token.tokens && containsImageInBlockquote(token.tokens, isInsideBlockquote))
      || (token.items && containsImageInBlockquote(token.items, isInsideBlockquote));
  });
}

function hasUnsupportedImage(tokens) {
  return tokens.some((token) => {
    if (token.type === 'image') {
      const extension = token.href.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
      return !['gif', 'jpg', 'jpeg', 'png'].includes(extension);
    }

    return token.tokens && hasUnsupportedImage(token.tokens);
  });
}

function validateInstantViewMarkdown(markdown, inputPath) {
  const tokens = marked.lexer(markdown);

  if (containsRawHtml(tokens)) {
    throw new Error(`${inputPath} contains raw HTML. Raw HTML is not supported by Telegram Instant View.`);
  }

  if (containsTaskList(tokens)) {
    throw new Error(`${inputPath} contains task lists. task lists are not supported by Telegram Instant View.`);
  }

  if (hasUnsupportedImage(tokens)) {
    throw new Error(`${inputPath} only supports GIF, JPG, and PNG images for Telegram Instant View.`);
  }

  if (containsImageInBlockquote(tokens)) {
    throw new Error(`${inputPath} contains images inside blockquotes. images inside blockquotes are not supported by Telegram Instant View.`);
  }
}

function isCalendarDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function articleSource(markdown, inputPath) {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);

  if (!frontmatter) {
    throw new Error(`${inputPath} must begin with a date frontmatter block.`);
  }

  const date = frontmatter[1].match(/^date:\s*(\d{4}-\d{2}-\d{2})\s*$/m)?.[1];

  if (!date) {
    throw new Error(`${inputPath} must include a date in YYYY-MM-DD format.`);
  }

  if (!isCalendarDate(date)) {
    throw new Error(`${inputPath} must include a valid date in YYYY-MM-DD format.`);
  }

  return { date, markdown: markdown.slice(frontmatter[0].length) };
}

export async function buildSite({
  contentDirectory = resolve(projectDirectory, 'content'),
  outputDirectory = resolve(projectDirectory, 'docs'),
  staticDirectory = resolve(projectDirectory, 'static')
} = {}) {
  const inputPaths = await markdownFiles(contentDirectory);

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  if (existsSync(staticDirectory)) {
    await cp(staticDirectory, outputDirectory, { recursive: true });
  }

  const articles = [];

  for (const inputPath of inputPaths) {
    const { date, markdown } = articleSource(await readFile(inputPath, 'utf8'), inputPath);
    validateInstantViewMarkdown(markdown, inputPath);
    const pathWithoutExtension = relative(contentDirectory, inputPath).replace(/\.md$/, '');
    const outputPath = resolve(outputDirectory, pathWithoutExtension, 'index.html');
    const stylesheetHref = relative(dirname(outputPath), resolve(outputDirectory, 'style.css')) || 'style.css';
    const { title } = articleParts(markdown);

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, renderArticle(markdown, stylesheetHref, date));
    articles.push({ date, title, url: `/${pathWithoutExtension}/` });
  }

  await writeFile(resolve(outputDirectory, 'index.html'), renderDirectory(articles));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildSite();
}
