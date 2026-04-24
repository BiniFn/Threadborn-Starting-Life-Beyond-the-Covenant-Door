import re
import os

with open('chap3_raw.txt', 'r') as f:
    text = f.read()

# Find chapter 3 volume 2 content
part1 = "## Chapter 3: The Boy Who Buried Himself\n\n*Volume 02 · Chapter 03*\n\n---\n\n*"
if part1 not in text:
    print("Could not find chapter 3 start")
    exit(1)

chapter3_text = text.split(part1)[1]
summary_text = chapter3_text.split("*")[0].strip()

# the rest of the content is after the next "---"
content = chapter3_text.split("---", 1)[1].strip()

# Split content into pages/sections based on '---'
sections = [s.strip() for s in content.split('---')]

pages = []

# process italic markdown
def process_inline(text):
    return re.sub(r'\*(.*?)\*', r'<em>\1</em>', text)

for i, section in enumerate(sections):
    if not section.strip(): continue
    
    if i == 0:
        page_html = f"""          `<div class="chapter-head">
            <span class="chapter-num">Volume 02 · Chapter 03</span>
            <h2 class="chapter-title">The Boy Who Buried Himself</h2>
            <p class="chapter-subtitle">{process_inline(summary_text)}</p>
          </div>
          <div class="ep-intro-bar"><p>The Black Hall · Memory Unlocked · Story Shift</p></div>"""
    else:
        page_html = "          `"
    
    # paragraphs
    lines = section.strip().split('\n\n')
    for line in lines:
        line = line.strip()
        if not line: continue
        
        if line.startswith('### '):
            page_html += f'\n          <p class="scene-title">{process_inline(line[4:])}</p>'
        elif line.startswith('> *') or line.startswith('>'):
            box_content = line.replace("> *", "").replace("*", "").replace(">", "").strip()
            page_html += f'\n          <div class="system-box">{process_inline(box_content)}</div>'
        elif line == '*— End of Chapter 03 —*':
            page_html += f'\n          <div class="tbc">— End of Chapter 03 —</div>'
        else:
            page_html += f'\n          <p class="novel-p">{process_inline(line)}</p>'
    
    page_html += "`"
    pages.append(page_html)

pages_str = ",\n".join(pages)

chapter_obj = f"""      {{
        volume: "Volume 2",
        chapter: "Chapter 3",
        label: "The Boy Who Buried Himself",
        title: "The Boy Who Buried Himself",
        summary: "In which the black hall finally answers — and the answer is worse than anyone expected.",
        tags: ["black hall", "lore", "origin"],
        pages: [
{pages_str}
        ]
      }}"""

# Insert into index.html
with open('index.html', 'r') as f:
    html = f.read()

if "The Boy Who Buried Himself" in html:
    print("Chapter 3 already in index.html")
    exit(0)

# We want to insert it at the end of the chapters array
html = html.replace('        ]\n      }\n    ];', '        ]\n      },\n' + chapter_obj + '\n    ];')

with open('index.html', 'w') as f:
    f.write(html)

print("Added Chapter 3 to index.html successfully")
