# Cheat Sheets

Concept summaries / cheat sheets, browsed as a slideshow. Each item can be a picture (zoomable) or a full HTML page (rendered full-size, scrolls internally).

## Adding a new section

1. Create a folder for the items: `cheat-sheets/images/<section-id>/` (e.g. `python-basics`), and drop the image or `.html` files in it (`01.png`, `02.html`, …).
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
        "images/python-basics/01.png",
        "images/python-basics/02.png"
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
