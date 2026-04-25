import re
from bs4 import BeautifulSoup
import html

# Helper functions from make_md.py
def strip_html(s):
    s = html.unescape(s)
    s = re.sub(r'<br\s*/?>', '\n', s)
    s = re.sub(r'<div class="scene-break">[^<]*</div>', '\n\n---\n\n', s)
    s = re.sub(r'<p class="scene-title">(.*?)</p>',   r'\n### \1\n',  s, flags=re.DOTALL)
    s = re.sub(r'<h2 class="chapter-title">(.*?)</h2>',r'\n## \1\n',  s, flags=re.DOTALL)
    s = re.sub(r'<span class="chapter-num">(.*?)</span>',r'*\1*\n',   s, flags=re.DOTALL)
    s = re.sub(r'<p class="chapter-subtitle">(.*?)</p>',r'*\1*\n',    s, flags=re.DOTALL)
    s = re.sub(r'<span class="(?:dialogue|thought|shout|emphasis)">(.*?)</span>',r'\1',s,flags=re.DOTALL)
    s = re.sub(r'<em>(.*?)</em>',     r'*\1*',  s, flags=re.DOTALL)
    s = re.sub(r'<strong>(.*?)</strong>',r'**\1**',s,flags=re.DOTALL)
    s = re.sub(r'<span class="big-sfx">(.*?)</span>',r'\n\n**\1**\n\n',s,flags=re.DOTALL)
    def fmt_sysbox(m):
        body = re.sub(r'<[^>]+>', '', m.group(2)).replace('\n', '\n> ')
        return f'\n\n> **{m.group(1)}**\n> {body.strip()}\n\n'
    s = re.sub(r'<div class="system-box">\s*<h5>(.*?)</h5>(.*?)</div>', fmt_sysbox, s, flags=re.DOTALL)
    s = re.sub(r'<div class="ep-intro-bar">.*?</div>','',s,flags=re.DOTALL)
    s = re.sub(r'<div class="tbc">(.*?)</div>',
               lambda m: '\n\n---\n\n*' + re.sub(r'<[^>]+>','',m.group(1)) + '*\n', s, flags=re.DOTALL)
    s = re.sub(r'<div class="fanservice-note">(.*?)</div>',
               lambda m: '\n\n*' + m.group(1).strip() + '*\n\n', s, flags=re.DOTALL)
    s = re.sub(r'<p[^>]*>(.*?)</p>', r'\1\n\n', s, flags=re.DOTALL)
    s = re.sub(r'<div[^>]*>', '', s); s = re.sub(r'</div>', '', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\n{4,}', '\n\n\n', s)
    return s.strip()

def extract_template_literals(js_block):
    results = []
    i = 0
    while i < len(js_block):
        if js_block[i] == '`':
            j = i + 1
            while j < len(js_block):
                if js_block[j] == '\\':
                    j += 2
                elif js_block[j] == '`':
                    results.append(js_block[i+1:j])
                    i = j + 1
                    break
                else:
                    j += 1
            else:
                break
        else:
            i += 1
    return results

def get_pages_block(js_text, start_hint=0):
    m = re.search(r'pages:\s*\[', js_text[start_hint:])
    if not m:
        return []
    abs_start = start_hint + m.end()
    depth = 1
    i = abs_start
    while i < len(js_text) and depth:
        if js_text[i] == '[':   depth += 1
        elif js_text[i] == ']': depth -= 1
        i += 1
    inner = js_text[abs_start:i-1]
    return extract_template_literals(inner)

with open("index-jp.html", "r", encoding="utf-8") as f:
    src = f.read()

js_start = src.index('const legacyEpisodes = [')
js_end   = src.index('const chapters = [')
legacy_js = src[js_start:js_end]

chapter_blocks_v1 = re.split(r'// ---- CHAPTER \d+ ----', legacy_js)
chapter_blocks_v1 = [b for b in chapter_blocks_v1 if 'pages:' in b]
ch5_match = re.search(r'legacyEpisodes\.push\(\{([\s\S]*?)\}\);', legacy_js, re.DOTALL)

legacy_pages = []
for block in chapter_blocks_v1:
    pages = get_pages_block(block)
    legacy_pages.append(pages)

if ch5_match:
    ch5_pages = get_pages_block('{' + ch5_match.group(1) + '}')
    legacy_pages.append(ch5_pages)

# V1 mapping: index 0 -> V1C1, index 1 -> V1C2, index 2 -> V1C3 (broken), index 3 -> V1C4, index 4 -> V1C5
v1c1 = legacy_pages[0] if len(legacy_pages) > 0 else []
v1c2 = legacy_pages[1] if len(legacy_pages) > 1 else []
v1c4 = legacy_pages[3] if len(legacy_pages) > 3 else []
v1c5 = legacy_pages[4] if len(legacy_pages) > 4 else []

# Now extract V2 from chapters
ch_start = src.index('const chapters = [')
ch_end   = src.index('const characters = [')
chapters_js = src[ch_start:ch_end]

vol2_pages_all = []
for m in re.finditer(r'volume:\s*"Volume 2"', chapters_js):
    pages = get_pages_block(chapters_js, m.start())
    if pages:
        vol2_pages_all.append(pages)

v2c1 = vol2_pages_all[0] if len(vol2_pages_all) > 0 else []
v2c2 = vol2_pages_all[1] if len(vol2_pages_all) > 1 else []

# Combine into markdown strings
def build_ch(pages):
    return "\n\n".join([strip_html(p) for p in pages])

# Read the manually translated files
with open("v1c3.md", "r", encoding="utf-8") as f: v1c3_str = f.read()
with open("v2c3.md", "r", encoding="utf-8") as f: v2c3_str = f.read()
with open("v2c4.md", "r", encoding="utf-8") as f: v2c4_str = f.read()
with open("v2c5.md", "r", encoding="utf-8") as f: v2c5_str = f.read()
with open("v2c6.md", "r", encoding="utf-8") as f: v2c6_str = f.read()

final_md = f"""# スレッドボーン — 巻1 — 尊厳ゼロで再生

*完結 · 5章*

---

{build_ch(v1c1)}

---

{build_ch(v1c2)}

---

{v1c3_str}

---

{build_ch(v1c4)}

---

{build_ch(v1c5)}

---

# スレッドボーン — 巻2 — 誓約の扉

*アクティブ · 6章*

---

{build_ch(v2c1)}

---

{build_ch(v2c2)}

---

{v2c3_str}

---

{v2c4_str}

---

{v2c5_str}

---

{v2c6_str}
"""

# Wait, replace multiple newlines with double newlines just in case
final_md = re.sub(r'\n{4,}', '\n\n\n', final_md)

with open("Threadborn-Complete-JP.md", "w", encoding="utf-8") as f:
    f.write(final_md)

print("Threadborn-Complete-JP.md created successfully!")
