# Cheat Sheets

Concept summaries / cheat sheets, browsed as a slideshow. Each item can be a picture (zoomable) or a full HTML page (rendered full-size, scrolls internally).

## Adding a new section

1. Create a folder for the items: `cheat-sheets/content/<NNN-section-id>/` (e.g. `006-python-basics`; the number sets the order), and drop the image or `.html` files in it (`01.png`, `02.html`, …).
2. Add an entry to `sections.json`:

```json
{
  "sections": [
    {
      "id": "python-basics",
      "title": "Python Cheat Sheets",
      "description": "Syntax, data structures, and idioms",
      "icon": "fa-brands fa-python",
      "images": [
        "content/006-python-basics/01.png",
        "content/006-python-basics/02.png"
      ],
      "captions": [
        "Variables and Type Conversion",
        "Arithmetic, Conditionals, and Loops"
      ]
    }
  ]
}
```

- `icon` (optional): a Font Awesome class shown on the hub card instead of a cover thumbnail — handy for a language/topic mark (e.g. `fa-brands fa-python`, `fa-brands fa-js`). If omitted, falls back to `cover` (an image path), then a generic icon.
- `captions` (optional): one string per image, shown as an overlay in the slideshow. Must line up positionally with `images`.

3. Commit and push. The hub page (`index.html`) picks up new sections automatically; no other code changes needed.

Each section opens in `viewer.html?s=<section-id>` — a full-screen slideshow with arrow-key/swipe navigation and pinch/scroll/double-click zoom.

## Sections with subcategories

A section can group its items into subcategories instead of a flat `images` list. Use `subsections` (same shape as a top-level section: `id`, `title`, `description`, `icon`, `images`, `captions`) instead of `images`/`captions`:

```json
{
  "id": "004-llm",
  "title": "LLM",
  "description": "Large language model concepts, by subtopic",
  "icon": "fa-solid fa-brain",
  "subsections": [
    {
      "id": "01-rag",
      "title": "RAG",
      "description": "Retrieval-Augmented Generation",
      "icon": "fa-solid fa-magnifying-glass",
      "images": ["content/004-llm/01-rag/01.png", "content/004-llm/01-rag/02.png"],
      "captions": ["RAG Overview", "RAG Pipeline"]
    }
  ]
}
```

On the hub, a section with `subsections` opens `category.html?s=<section-id>` — a grid of its subcategories — instead of going straight to the slideshow. Picking a subcategory opens `viewer.html?s=<section-id>&sub=<subsection-id>`.

## Naming convention

All content lives in `content/`. Prefix every section folder/id with a 3-digit number (`001-python`, `002-pandas`, …) and every subsection folder/id with a 2-digit number (`01-rag`, `02-writing`, …). The number shows the intended order; list entries in `sections.json` in the same order, and keep the folder name equal to the `id`.
