"""Rebuild the app list on /apps/index.html from the app READMEs.

Run after adding or changing an app:   python apps/build_apps.py
Reads every README.md under D:\\Projects\\1-Apps\\<Topic>\\<repo>\\ and embeds the
result between the APPS-DATA markers in apps/index.html.
"""
import json, re, subprocess
from pathlib import Path

APPS_ROOT = Path(r"D:\Projects\1-Apps")
PAGE = Path(__file__).with_name("index.html")
GH_USER = "mnoorchenar"
EXTRA = {}  # repos outside 1-Apps shown on the page
HIDDEN = {"llm-from-scratch"}  # repos kept off the page (e.g. not built yet)
TITLES = {"research-rag-bench": "Research RAG Bench"}  # nicer names where the README title is just the repo name
TOPICS = {
    "LLM-Agents": "LLMs, RAG & Agents",
    "Healthcare": "Healthcare & Biotech",
    "Finance":    "Finance & Risk",
    "Vision":     "Computer Vision",
    "Statistics": "Statistics & Experimentation",
    "MLOps-Data": "MLOps & Data",
    "Education":  "Education & Visualization",
    "Research-Tools": "Research Tools",
}
SKIP_BADGES = {"github", "status", "docker", "live demo", "source code", "use", "private", "star on github", "fork on github"}


def plain(md):
    md = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", md)
    md = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", md)
    md = re.sub(r"<[^>]+>", "", md)
    return re.sub(r"\s+", " ", md.replace("**", "").replace("`", "")).strip()


def short(text, limit=230):
    if len(text) <= limit:
        return text
    cut = text[:limit]
    end = max(cut.rfind(". "), cut.rfind("; "))
    return (cut[:end + 1] if end > 80 else cut.rsplit(" ", 1)[0] + "…").strip()


def read_app(readme, topic):
    text = readme.read_text(encoding="utf-8")
    repo = readme.parent
    name = subprocess.run(["git", "-C", str(repo), "remote", "get-url", "origin"], capture_output=True,
                          text=True).stdout.strip().rstrip("/").split("/")[-1].removesuffix(".git")
    hf = subprocess.run(["git", "-C", str(repo), "config", "hf.repo"], capture_output=True, text=True).stdout.strip()
    h1 = re.search(r"<h1>(.*?)</h1>", text).group(1).strip()
    emoji, title = (h1.split(" ", 1) if not h1[0].isalnum() else ("", h1))
    intro = re.search(r"^\*\*.+?\*\*\s*(?:[—-]\s*)?(.+)$", text, re.M)
    desc = plain(intro.group(1)) if intro else ""
    desc = re.sub(r"^(is|are)\s+", "", desc)
    desc = desc[0].upper() + desc[1:] if desc else desc
    header = text.split("## Table of Contents")[0]
    tags = []
    for alt in re.findall(r"\[!\[([^\]]+)\]\(https://img\.shields\.io/badge/", header):
        if alt.lower() not in SKIP_BADGES and alt not in tags:
            tags.append(alt)
    body = text.split("## Table of Contents")[-1].split("## 👨‍💻 Author")[0]
    features = re.findall(r"<b>([^<]+)</b>", body)
    headings = re.findall(r"^## \S+ (.+)$", text, re.M)
    prose = re.sub(r"```.*?```", " ", body, flags=re.S)  # README text, minus code blocks
    keywords = " ".join(features + headings + [name, title, TOPICS[topic], plain(prose)[:2500]])
    return {
        "name": name, "title": TITLES.get(name, title.strip()), "emoji": emoji, "topic": TOPICS[topic],
        "description": short(desc), "tags": tags[:6], "keywords": plain(keywords).lower(),
        "demo": f"https://huggingface.co/{hf}" if hf.startswith("spaces/") else None,
        "code": f"https://github.com/{GH_USER}/{name}",
    }


def main():
    apps = []
    for topic_dir in sorted(p for p in APPS_ROOT.iterdir() if p.is_dir()):
        for repo in sorted(p for p in topic_dir.iterdir() if (p / "README.md").exists()):
            if repo.name in HIDDEN:
                continue
            apps.append(read_app(repo / "README.md", topic_dir.name))
    for repo, topic in EXTRA.items():
        apps.append(read_app(repo / "README.md", topic))
    apps.sort(key=lambda a: (list(TOPICS.values()).index(a["topic"]), a["title"].lower()))
    data = json.dumps({"topics": list(TOPICS.values()), "apps": apps}, ensure_ascii=False, indent=1)
    page = PAGE.read_text(encoding="utf-8")
    page = re.sub(r"(/\* APPS-DATA:START \*/).*?(/\* APPS-DATA:END \*/)",
                  lambda m: f"{m.group(1)}\nconst APPS_DATA = {data};\n{m.group(2)}", page, flags=re.S)
    PAGE.write_text(page, encoding="utf-8", newline="\n")
    print(f"{len(apps)} apps written to {PAGE}")


if __name__ == "__main__":
    main()
