"""Build a repo's README.md in the standard style (see 000. readme-template.md).

Header, run instructions, project tree, author card and footer are generated
from the repo itself, so links and file lists always match what is really there.
The project-specific sections (features, architecture, modules, ...) come from
the existing README or from a body file.

Usage:
  python readme_gen.py REPO_DIR                  # restyle an existing fancy README
  python readme_gen.py REPO_DIR --meta META.json # header from META, body from META["body"]
                                                 # or from the existing README (wrap mode)
"""
import json, re, subprocess, sys, unicodedata
from pathlib import Path

GH_USER = "mnoorchenar"
OLD_NAMES = ["vae-mnist-playground", "financial-rag-intelligence-platform",
             "drug-discovery-dashboard", "biomedical-protein-target-explorer"]
# Sections the generator writes itself; any copy in the source README is dropped.
GENERATED = re.compile(r"(table of contents|project structure|file structure|project layout|author|contributing|"
                       r"disclaimer|^license|^📜 license)", re.I)
SETUP = re.compile(r"(getting started|docker|run (and test )?locally|quick start|installation|prerequisites|"
                   r"local setup|^deploy|^requirements)", re.I)
DEFAULT_NOTES = {"app.py": "Application entry point", "dockerfile": "Container definition (port 7860)",
                 "requirements.txt": "Python dependencies", "docker-compose.yml": "Multi-service orchestration",
                 ".env.example": "Environment variable template", "index.html": "App entry page",
                 "templates": "HTML templates", "static": "CSS, JavaScript & assets", "tests": "Automated tests",
                 "license": "MIT license"}
SKIP_TREE = {"sync.ps1", ".gitattributes", ".gitignore", ".syncconfig", "README.md", "readme.md"}


HEADING_EMOJI = [  # first match wins; gives plain headings the same look as the template's
    (r"security|privacy|safety|credential", "🔒"), (r"chat|assistant|copilot|\bai\b", "🤖"),
    (r"feature", "✨"), (r"architect|how it works|how .* works|workflow|pipeline", "🏗️"),
    (r"getting started|quick start|install|\brun\b|setup|deploy|prerequisite|requirement", "🚀"),
    (r"docker", "🐳"), (r"usage|how to use|using", "📖"), (r"config|option", "⚙️"),
    (r"\bapi\b|endpoint", "📡"), (r"\bmodels?\b|algorithm", "🧠"), (r"data|schema", "🗄️"),
    (r"dashboard|module|\btabs?\b|\bpages?\b", "📊"), (r"troubleshoot", "🛠️"), (r"example|demo", "💡"),
    (r"limitation|known issue", "🚧"), (r"source|learn more|reference|credit", "📚"),
    (r"technical|stack|tech", "🧰"), (r"find|search", "🔎"), (r"note", "📝"), (r"naming|file", "🗂️"),
    (r"sync|github", "🔄"), (r"log", "📜"), (r"version|status", "🏷️"), (r"overview|what it does", "📖"),
    (r"offline|cache", "📴"), (r"menu", "🍕"), (r"advanced", "🧪"), (r"math|table", "🧮"),
]


def decorate(heading):
    if not heading[:1].isalnum():
        return heading
    for pat, emoji in HEADING_EMOJI:
        if re.search(pat, heading, re.I):
            return f"{emoji} {heading}"
    return f"📌 {heading}"


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True,
                          encoding="utf-8").stdout.strip()


def public_repos():
    import os, tempfile, time, urllib.request
    cache = Path(tempfile.gettempdir()) / "readme_gen_public_repos.json"
    if cache.exists() and time.time() - cache.stat().st_mtime < 3600:
        return set(json.loads(cache.read_text()))
    url = f"https://api.github.com/users/{GH_USER}/repos?per_page=100"
    names = sorted(r["name"].lower() for r in json.load(urllib.request.urlopen(url)))
    cache.write_text(json.dumps(names))
    return set(names)


def anchor(heading):
    s = "".join(c for c in heading.lower()
                if unicodedata.category(c)[0] in "LMN" or unicodedata.category(c) == "Pc" or c in " -")
    return "#" + s.replace(" ", "-")


def split_front_matter(text):
    text = text.lstrip("﻿")
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    return (m.group(1), text[m.end():]) if m else (None, text)


def split_sections(body):
    """Return (preamble, [(heading, content), ...]) for '## ' sections."""
    pre, sections, cur, fence = [], [], None, False
    for line in body.split("\n"):
        if line.lstrip().startswith("```"):
            fence = not fence
        if not fence and line.startswith("## "):
            cur = [line[3:].strip(), []]
            sections.append(cur)
        else:
            (cur[1] if cur else pre).append(line)
    return "\n".join(pre), [(h, "\n".join(c)) for h, c in sections]


def clean(content):
    content = re.sub(r"\n---\s*$", "", content.rstrip()).strip("\n")
    return content


def parse_fancy_header(pre):
    meta = {}
    m = re.search(r"<h1>(.*?)</h1>", pre)
    if m:
        h1 = m.group(1).strip()
        em = re.match(r"^(\S+)\s+(.*)$", h1)
        meta["emoji"], meta["title"] = (em.group(1), em.group(2)) if em and not em.group(1)[0].isalnum() else ("", h1)
    m = re.search(r'<img src="(https://readme-typing-svg[^"]+)"', pre)
    if m:
        meta["typing_url"] = m.group(1).replace("%3B", ";")
    m = re.search(r"<h3>(.*?)</h3>", pre)
    if m:
        meta["subtitle"] = m.group(1).strip()
    meta["badges"] = [b for b in re.findall(r"^\[!\[[^\n]*img\.shields\.io/badge[^\n]*$", pre, re.M)
                      if "HuggingFace-Spaces" not in b and "Live_Demo" not in b and "GitHub-Repo" not in b]
    m = re.search(r"^\*\*.+?\*\*.+$", pre, re.M)
    if m:
        meta["intro"] = m.group(0).strip()
    return meta


def tree(repo, old_comments):
    files = [f for f in git(repo, "-c", "core.quotepath=off", "ls-files").splitlines() if f]
    top = {}
    for f in files:
        parts = f.split("/")
        if parts[0] in SKIP_TREE or parts[0] == ".claude" or "__pycache__" in parts:
            continue
        top.setdefault(parts[0], set())
        if len(parts) > 1:
            top[parts[0]].add(parts[1] + ("/" if len(parts) > 2 else ""))
    dirs = sorted(k for k, v in top.items() if v)
    plain = sorted(k for k, v in top.items() if not v)
    lines = [f"{repo.name}/", "│"]
    entries = [(d, True) for d in dirs] + [(f, False) for f in plain]
    for i, (name, is_dir) in enumerate(entries):
        last = i == len(entries) - 1
        icon = "📂" if is_dir else "📄"
        label = f"{icon} {name}{'/' if is_dir else ''}"
        note = old_comments.get(name.lower())
        lines.append(f"{'└──' if last else '├──'} {label:<28}" + (f" # {note}" if note else ""))
        if is_dir:
            kids = sorted(top[name])
            shown = kids[:6]
            for j, k in enumerate(shown):
                more = j == len(shown) - 1 and len(kids) <= 6
                lines.append(f"{'   ' if last else '│  '} {'└──' if more else '├──'} {k}")
            if len(kids) > 6:
                lines.append(f"{'   ' if last else '│  '} └── … {len(kids) - 6} more")
    return "```\n" + "\n".join(l.rstrip() for l in lines) + "\n```"


def old_tree_comments(sections):
    out = {}
    for h, c in sections:
        if "structure" in h.lower():
            for m in re.finditer(r"[📂📄]\s*([\w.\-]+)/?\s+#\s*(.+)", c):
                out[m.group(1).lower()] = m.group(2).strip()
    return out


def docker_cmd(repo):
    df = repo / "Dockerfile"
    if not df.exists():
        return None
    m = re.search(r"^CMD\s+(\[.*?\])", df.read_text(encoding="utf-8", errors="ignore"), re.M | re.S)
    try:
        return json.loads(m.group(1).replace("\\\n", "")) if m else None
    except ValueError:
        return None


def fix_setup(repo, name, text):
    """Keep a hand-written setup section but drop steps for files that don't exist."""
    has = lambda p: (repo / p).exists()
    out = []
    for line in text.split("\n"):
        low = line.lower()
        if not has(".env.example") and (".env.example" in low or re.match(r"\s*# edit \.env", low)
                                        or re.match(r"\s*# \d+\. configure environment", low)):
            continue
        m = re.match(r"(\s*)git clone \S+", line)
        if m:  # placeholder or old clone URLs -> the real repo
            line = f"{m.group(1)}git clone https://github.com/{GH_USER}/{name}.git"
        elif out and "git clone" in out[-1] and re.match(r"\s*cd [\w.-]+\s*$", line):
            line = re.sub(r"cd [\w.-]+", f"cd {name}", line)
        if "docker pull" in low or "pre-built image" in low:
            continue
        if not has("docker-compose.yml") and ("docker compose" in low or "docker-compose" in low):
            continue
        line = re.sub(r"docker run (.*?)\bmnoorchenar/[\w.-]+", lambda m: f"docker run {m.group(1)}{name.lower()}", line)
        if not has("docker-compose.yml"):
            line = line.replace("Docker & Docker Compose", "Docker")
        out.append(line)
    text = "\n".join(out)
    if "docker run" in text and "docker build" not in text and has("Dockerfile"):
        text = re.sub(r"^(\s*)docker run", lambda m: f"{m.group(1)}docker build -t {name.lower()} .\n{m.group(1)}docker run",
                      text, count=1, flags=re.M)

    def renumber(block):
        n = iter(range(1, 100))
        return re.sub(r"^# \d+\.", lambda m: f"# {next(n)}.", block.group(0), flags=re.M)
    text = re.sub(r"```bash\n.*?```", renumber, text, flags=re.S)
    return re.sub(r"```bash\n\s*```\n?", "", text)


def getting_started(repo, name, is_public, front):
    has = lambda p: (repo / p).exists()
    sdk = re.search(r"^sdk:\s*(\S+)", front or "", re.M)
    sdk = sdk.group(1) if sdk else None
    clone = (f"git clone https://github.com/{GH_USER}/{name}.git\ncd {name}" if is_public else
             f"# Private repository — access required\ngit clone https://github.com/{GH_USER}/{name}.git\ncd {name}")
    out = ["## 🚀 Getting Started", ""]
    if has("requirements.txt") or has("app.py"):
        cmd = docker_cmd(repo) or []
        run = "streamlit run app.py --server.port 7860" if "streamlit" in cmd else "python app.py"
        steps = [f"# 1. Clone the repository\n{clone}",
                 "# 2. Create a virtual environment\npython -m venv venv\nsource venv/bin/activate  # Windows: venv\\Scripts\\activate"]
        if has("requirements.txt"):
            steps.append("# 3. Install dependencies\npip install -r requirements.txt")
        if has(".env.example"):
            steps.append("# 4. Configure environment variables\ncp .env.example .env  # then add your keys")
        steps.append(f"# 5. Run the application\n{run}")
        steps = [re.sub(r"^# \d+\.", f"# {i}.", s) for i, s in enumerate(steps, 1)]
        out += ["### Prerequisites", "", "- Python 3.10+", "- Git"]
        if has("Dockerfile"):
            out.append("- Docker (optional)")
        out += ["", "### Local Installation", "", "```bash", "\n\n".join(steps), "```", ""]
        port = "7860" if (has("Dockerfile") or "streamlit" in cmd) else None
        if port:
            out += [f"Open your browser at `http://localhost:{port}` 🎉", ""]
    elif has("index.html") or sdk == "static":
        out += ["This is a static web app — no build step and no server-side code.", "", "```bash",
                f"# 1. Clone the repository\n{clone}\n\n# 2. Serve the folder (any static server works)\npython -m http.server 8000",
                "```", "", "Open your browser at `http://localhost:8000` 🎉", ""]
    else:
        out += ["```bash", clone, "```", ""]
    if has("Dockerfile"):
        lines = []
        if has("docker-compose.yml"):
            lines.append("# Build and run with Docker Compose\ndocker compose up --build\n")
            lines.append("# Or with plain Docker")
        lines.append(f"docker build -t {name.lower()} .\ndocker run -p 7860:7860 {name.lower()}")
        out += ["---", "", "## 🐳 Docker Deployment", "", "```bash", "\n".join(lines), "```", ""]
    return "\n".join(out).rstrip()


AUTHOR = """## 👨‍💻 Author

<div align="center">

<table>
<tr>
<td align="center" width="100%">

<img src="https://avatars.githubusercontent.com/mnoorchenar" width="120" style="border-radius:50%; border: 3px solid #4f46e5;" alt="Mohammad Noorchenarboo"/>

<h3>Mohammad Noorchenarboo</h3>

<code>Data Scientist</code> &nbsp;|&nbsp; <code>AI Researcher</code> &nbsp;|&nbsp; <code>Biostatistician</code>

📍 &nbsp;Ontario, Canada &nbsp;&nbsp; 📧 &nbsp;[mohammadnoorchenarboo@gmail.com](mailto:mohammadnoorchenarboo@gmail.com)

──────────────────────────────────────

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/mnoorchenar)&nbsp;
[![Personal Site](https://img.shields.io/badge/Website-mnoorchenar.github.io-4f46e5?style=for-the-badge&logo=githubpages&logoColor=white)](https://mnoorchenar.github.io/)&nbsp;
[![HuggingFace](https://img.shields.io/badge/HuggingFace-ffcc00?style=for-the-badge&logo=huggingface&logoColor=black)](https://huggingface.co/mnoorchenar)&nbsp;
[![Google Scholar](https://img.shields.io/badge/Scholar-4285F4?style=for-the-badge&logo=googlescholar&logoColor=white)](https://scholar.google.ca/citations?user=nn_Toq0AAAAJ&hl=en)&nbsp;
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/mnoorchenar)

</td>
</tr>
</table>

</div>"""

CONTRIBUTING = """## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request"""

DEFAULT_DISCLAIMER = ("This project is developed strictly for educational and research purposes and does not "
                      "constitute professional advice of any kind. All datasets used are either synthetically "
                      "generated or publicly available — no real user data is stored. This software is provided "
                      "\"as is\" without warranty of any kind; use at your own risk.")


def build(repo, meta, sections, front, is_public, hf_repo):
    name = git(repo, "remote", "get-url", "origin").rstrip("/").split("/")[-1].removesuffix(".git")
    title, emoji = meta["title"], meta.get("emoji", "")
    full = f"{emoji} {title}".strip()
    color = meta.get("color", "4f46e5").lstrip("#")
    space = hf_repo.split("/", 1)[1] if hf_repo and hf_repo.startswith("spaces/") else None

    # project sections: fix leftovers from the template
    fixed = []
    for h, c in sections:
        for old in OLD_NAMES:
            c = c.replace(old, name)
        c = re.sub(r"\s*<tr>\s*<td>🔒 <b>Secure by Design</b></td>\s*<td>Role-based access, audit logs, "
                   r"encrypted data pipelines</td>\s*</tr>", "", c, flags=re.S)
        if not (repo / "Dockerfile").exists():
            c = re.sub(r"\s*<tr>\s*<td>🐳 <b>Containerized Deployment</b></td>.*?</tr>", "", c, flags=re.S)
        fixed.append((decorate(h), clean(c)))

    disclaimer = meta.get("disclaimer") or DEFAULT_DISCLAIMER
    head = []
    if front:
        head += ["---", front.strip(), "---", ""]
    head += ['<div align="center">', "", f"<h1>{full}</h1>"]
    if meta.get("subtitle"):
        head.append(f"<h3>{meta['subtitle']}</h3>")
    if meta.get("typing_url"):
        head.append(f'<img src="{meta["typing_url"]}" alt="Typing SVG"/>')
    elif meta.get("typing"):
        lines = ";".join(l.replace(" ", "+").replace("&", "%26") for l in meta["typing"])
        head.append(f'<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=22&duration=3000'
                    f'&pause=1000&color={color}&center=true&vCenter=true&width=700&lines={lines}" alt="Typing SVG"/>')
    head += ["", "<br/>", ""]
    head += meta.get("badges", [])
    head += ["", "<br/>", ""]
    links = []
    if space and is_public:
        links.append(f"[![Live Demo](https://img.shields.io/badge/%E2%96%B6_Live_Demo-Hugging_Face_Space-ffcc00?style=for-the-badge"
                     f"&logo=huggingface&logoColor=black)](https://huggingface.co/{hf_repo})")
    if is_public:
        links.append(f"[![Source Code](https://img.shields.io/badge/Source_Code-GitHub-181717?style=for-the-badge"
                     f"&logo=github&logoColor=white)](https://github.com/{GH_USER}/{name})")
    else:
        links.append("![Private](https://img.shields.io/badge/%F0%9F%94%92_Private-Personal_Project-64748b?style=for-the-badge)")
    head += links + ["", "<br/>", "", meta.get("intro") or f"**{full}** — {meta['description']}", "", "<br/>", "", "---", "", "</div>"]

    setup = [(h, c) for h, c in fixed if SETUP.search(h)]
    fixed = [(h, c) for h, c in fixed if not SETUP.search(h)]
    setup_md = ("\n\n---\n\n".join(f"## {h}\n\n{fix_setup(repo, name, c)}" for h, c in setup) if setup
                else getting_started(repo, name, is_public, front))
    tail = [setup_md,
            "## 📁 Project Structure\n\n" + tree(repo, meta.get("tree_notes", {})),
            AUTHOR]
    if meta.get("contributing", is_public):
        tail.append(CONTRIBUTING)
    tail.append(f"## ⚠️ Disclaimer\n\n> [!WARNING]\n> {disclaimer}")
    if meta.get("license"):
        tail.append(f"## 📜 License\n\n{meta['license']}")
    elif is_public or meta.get("mit"):
        lic ="See [`LICENSE`](LICENSE) for more information." if (repo / "LICENSE").exists() else ""
        tail.append(f"## 📜 License\n\nDistributed under the **MIT License**. {lic}".rstrip())

    # split generated getting-started/docker block into its own sections for the TOC
    gs_parts = re.split(r"\n---\n\n(?=## )", tail[0])
    tail = gs_parts + tail[1:]
    # put Getting Started / Docker after the first two project sections (features, architecture)
    proj = [f"## {h}\n\n{c}" for h, c in fixed]
    cut = min(2, len(proj))
    body = proj[:cut] + gs_parts + proj[cut:] + tail[len(gs_parts):]
    headings = [re.match(r"## (.+)", b).group(1) for b in body]
    toc = "## Table of Contents\n\n" + "\n".join(f"- [{re.sub(r'^[^A-Za-z0-9]+', '', h)}]({anchor(h)})"
                                                 for h in headings)
    footer = ['<div align="center">', "",
              f'<img src="https://capsule-render.vercel.app/api?type=waving&color=0:{meta.get("footer_from", color)},'
              f'100:{meta.get("footer_to", "06b6d4")}&height=120&section=footer&text=Made%20with%20%E2%9D%A4%EF%B8%8F'
              f'%20by%20Mohammad%20Noorchenarboo&fontColor=ffffff&fontSize=18&fontAlignY=80" width="100%"/>', ""]
    if is_public:
        # static badges: shields' live star counts fail intermittently ("invalid")
        footer += [f"[![Star on GitHub](https://img.shields.io/badge/%E2%AD%90_Star-on_GitHub-181717?style=for-the-badge"
                   f"&logo=github&logoColor=white)](https://github.com/{GH_USER}/{name}/stargazers)",
                   f"[![Fork on GitHub](https://img.shields.io/badge/%F0%9F%8D%B4_Fork-on_GitHub-181717?style=for-the-badge"
                   f"&logo=github&logoColor=white)](https://github.com/{GH_USER}/{name}/fork)", ""]
    footer += [f'<sub>The name "{title}" is used purely for academic and research purposes. Any similarity to '
               "existing product names or trademarks is entirely coincidental. This project has no affiliation "
               "with any commercial entity.</sub>", "", "</div>"]
    doc = "\n".join(head) + "\n\n" + toc + "\n\n---\n\n" + "\n\n---\n\n".join(body) + "\n\n---\n\n" + "\n".join(footer) + "\n"
    return re.sub(r"\n{3,}", "\n\n", doc)


def main():
    repo = Path(sys.argv[1]).resolve()
    meta = {}
    if "--meta" in sys.argv:
        meta = json.loads(Path(sys.argv[sys.argv.index("--meta") + 1]).read_text(encoding="utf-8"))
    readme = repo / "README.md"
    front, body = split_front_matter(readme.read_text(encoding="utf-8")) if readme.exists() else (None, "")
    if meta.get("front") is not None:
        front = meta["front"] or None
    if "body" in meta:
        pre, sections = split_sections(meta["body"])
    else:
        pre, sections = split_sections(body)
        if "<h1>" in pre:  # existing fancy README
            parsed = parse_fancy_header(pre)
            meta = {**parsed, **meta}
            m = re.search(r"capsule-render[^\"]*color=0:([0-9a-fA-F]{6}),100:([0-9a-fA-F]{6})", body)
            if m:
                meta.setdefault("footer_from", m.group(1)); meta.setdefault("footer_to", m.group(2))
        else:  # plain README: keep its intro (minus the title line) as an overview
            intro = re.sub(r"^\s*# .*\n", "", pre).strip()
            intro = re.sub(r"\n---\s*$", "", intro).strip()
            paras = [p for p in intro.split("\n\n") if p.strip()]
            if paras:  # the first paragraph becomes the header description
                meta.setdefault("description", paras[0].replace("\n", " ").strip())
                if paras[1:]:
                    sections.insert(0, ("📖 Overview", "\n\n".join(paras[1:])))
    for h, c in sections:
        if re.search(r"licen[cs]e", h, re.I) and not h.lower().startswith("sources"):
            c = re.split(r"\n---\s*\n", c.strip())[0].strip()
            if "rights reserved" in c.lower():  # a custom license is kept word for word
                meta.setdefault("license", c)
                meta.setdefault("contributing", False)
            elif "mit" in c.lower():
                meta.setdefault("mit", True)
        if "disclaimer" not in h.lower():
            continue
        m = re.search(r'<span style="color:red">(.*?)</span>', c, re.S)
        text = m.group(1) if m else re.sub(r"\n---\s*$", "", c)
        meta.setdefault("disclaimer", " ".join(text.split()))
    meta["tree_notes"] = {**DEFAULT_NOTES, **old_tree_comments(sections), **meta.get("tree_notes", {})}
    sections = [(h, c) for h, c in sections if not GENERATED.search(h) and h not in meta.get("drop", [])]
    name = git(repo, "remote", "get-url", "origin").rstrip("/").split("/")[-1].removesuffix(".git")
    is_public = name.lower() in public_repos()
    hf_repo = git(repo, "config", "hf.repo")
    readme.write_text(build(repo, meta, sections, front, is_public, hf_repo), encoding="utf-8", newline="\n")
    print(f"wrote {readme} ({'public' if is_public else 'private'})")


if __name__ == "__main__":
    main()
