import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
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

export function renderArticle(markdown) {
  const { body, title } = articleParts(markdown);
  const safeTitle = escapeHtml(title);

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${safeTitle}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${safeTitle}">
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="page">
    <header class="article-header">
      <h1 data-instant-view="title">${safeTitle}</h1>
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

export async function buildSite({
  inputPath = resolve(projectDirectory, 'content/article.md'),
  outputDirectory = resolve(projectDirectory, 'docs'),
  staticDirectory = resolve(projectDirectory, 'static')
} = {}) {
  const markdown = await readFile(inputPath, 'utf8');
  const page = renderArticle(markdown);

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  if (existsSync(staticDirectory)) {
    await cp(staticDirectory, outputDirectory, { recursive: true });
  }

  await writeFile(resolve(outputDirectory, 'index.html'), page);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildSite();
}
