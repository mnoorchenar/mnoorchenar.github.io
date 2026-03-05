"""
PDF to SVG Batch Converter
Requires: pip install pymupdf

Usage:
  - Place this script in the same folder as your PDFs, then run it
  - OR run from terminal: python pdf2svg.py
  - OR specify a folder: python pdf2svg.py "E:/path/to/your/folder"
"""

import sys
import os

# ── Install pymupdf automatically if not present ──────────────────────────────
try:
    import fitz  # PyMuPDF
except ImportError:
    print("[INFO] PyMuPDF not found. Installing it now...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pymupdf"])
    import fitz
    print("[OK] PyMuPDF installed.\n")

# ── Determine target folder ────────────────────────────────────────────────────
if len(sys.argv) > 1:
    folder = sys.argv[1]
else:
    folder = os.path.dirname(os.path.abspath(__file__))

print("=" * 60)
print("  PDF to SVG Batch Converter")
print(f"  Folder: {folder}")
print("=" * 60)

if not os.path.isdir(folder):
    print(f"[ERROR] Folder not found: {folder}")
    input("\nPress Enter to exit...")
    sys.exit(1)

# ── Find all PDFs ──────────────────────────────────────────────────────────────
pdf_files = [f for f in os.listdir(folder) if f.lower().endswith(".pdf")]

if not pdf_files:
    print("\n[WARNING] No PDF files found in this folder.")
    input("\nPress Enter to exit...")
    sys.exit(0)

print(f"\n  Found {len(pdf_files)} PDF file(s):\n")
for f in pdf_files:
    print(f"   - {f}")

print()

# ── Convert each PDF ───────────────────────────────────────────────────────────
success = 0
failed  = 0

for filename in pdf_files:
    pdf_path = os.path.join(folder, filename)
    base_name = os.path.splitext(filename)[0]

    try:
        doc = fitz.open(pdf_path)

        if len(doc) == 1:
            # Single page → one SVG file with the same name
            svg_path = os.path.join(folder, base_name + ".svg")
            page = doc[0]
            svg_content = page.get_svg_image(matrix=fitz.Matrix(1, 1))
            with open(svg_path, "w", encoding="utf-8") as f:
                f.write(svg_content)
            print(f"[DONE]  {filename}  →  {base_name}.svg")
        else:
            # Multi-page → one SVG per page: name_page1.svg, name_page2.svg ...
            for i, page in enumerate(doc, start=1):
                svg_path = os.path.join(folder, f"{base_name}_page{i}.svg")
                svg_content = page.get_svg_image(matrix=fitz.Matrix(1, 1))
                with open(svg_path, "w", encoding="utf-8") as f:
                    f.write(svg_content)
                print(f"[DONE]  {filename} (page {i})  →  {base_name}_page{i}.svg")

        doc.close()
        success += 1

    except Exception as e:
        print(f"[FAIL]  {filename}  →  Error: {e}")
        failed += 1

# ── Summary ────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print(f"  Finished! {success} converted, {failed} failed.")
print("=" * 60)
input("\nPress Enter to exit...")