# Visual Notes

Picture-only concept summaries / cheat sheets, browsed as a zoomable slideshow.

## Adding a new section

1. Create a folder for the images: `visual-notes/images/<section-id>/` (e.g. `python-basics`), and drop the image files in it (`01.png`, `02.png`, …).
2. Add an entry to `sections.json`:

```json
{
  "sections": [
    {
      "id": "python-basics",
      "title": "Python Cheat Sheets",
      "description": "Syntax, data structures, and idioms",
      "cover": "images/python-basics/01.png",
      "images": [
        "images/python-basics/01.png",
        "images/python-basics/02.png"
      ]
    }
  ]
}
```

3. Commit and push. The hub page (`index.html`) picks up new sections automatically; no other code changes needed.

Each section opens in `viewer.html?s=<section-id>` — a full-screen slideshow with arrow-key/swipe navigation and pinch/scroll/double-click zoom.
