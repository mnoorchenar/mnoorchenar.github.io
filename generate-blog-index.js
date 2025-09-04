const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BLOGS_DIR = path.join(__dirname, 'Blogs');
const OUTPUT_FILE = path.join(BLOGS_DIR, 'blog-index.json');

function extractMetadata(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const dom = new JSDOM(content);
  const doc = dom.window.document;

  const title = doc.querySelector('meta[name="title"]')?.content ||
                doc.querySelector('title')?.textContent ||
                doc.querySelector('h1')?.textContent ||
                path.basename(filePath, '.html');

  const description = doc.querySelector('meta[name="description"]')?.content ||
                      doc.querySelector('p')?.textContent?.trim() ||
                      'No description available.';

  const keywords = doc.querySelector('meta[name="keywords"]')?.content?.split(',').map(k => k.trim()) || [];

  const date = doc.querySelector('meta[name="date"]')?.content ||
               fs.statSync(filePath).mtime.toISOString().split('T')[0];

  return {
    title,
    description,
    tags: keywords,
    date,
    url: 'Blogs/' + path.basename(filePath)
  };
}

function generateIndex() {
  const files = fs.readdirSync(BLOGS_DIR)
    .filter(f => f.endsWith('.html') && f !== 'blogs.html');

  const blogs = files.map(f => extractMetadata(path.join(BLOGS_DIR, f)));
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(blogs, null, 2));
  console.log(`✅ Generated blog index with ${blogs.length} entries`);
}

generateIndex();
