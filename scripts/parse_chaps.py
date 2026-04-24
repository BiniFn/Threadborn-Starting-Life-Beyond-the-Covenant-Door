import re
import os
import time

def process_inline(text):
    text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', text)
    text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)
    return text

def parse_chapter(text, ch_num, label, summary, ep_intro):
    # split by ---
    sections = [s.strip() for s in text.split('---')]
    pages = []
    
    for i, section in enumerate(sections):
        if not section.strip(): continue
        
        if i == 0:
            page_html = f"""          `<div class="chapter-head">
            <span class="chapter-num">Volume 02 · Chapter {ch_num:02d}</span>
            <h2 class="chapter-title">{label}</h2>
            <p class="chapter-subtitle">{process_inline(summary)}</p>
          </div>
          <div class="ep-intro-bar"><p>{ep_intro}</p></div>"""
        else:
            page_html = "          `"
            
        lines = section.strip().split('\n\n')
        for line in lines:
            line = line.strip()
            if not line: continue
            
            if line.startswith('### '):
                page_html += f'\n          <p class="scene-title">{process_inline(line[4:])}</p>'
            elif line.startswith('>'):
                box_lines = line.replace(">", "").strip().split('\n')
                final_box = "<br>".join([process_inline(l.strip().lstrip('>').strip()) for l in box_lines])
                page_html += f'\n          <div class="system-box">{final_box}</div>'
            elif line.startswith(f'*— End of Chapter'):
                page_html += f'\n          <div class="tbc">— End of Chapter {ch_num:02d} —</div>'
            else:
                line = line.replace('\n', '<br>')
                page_html += f'\n          <p class="novel-p">{process_inline(line)}</p>'
        
        page_html += "`"
        pages.append(page_html)
        
    pages_str = ",\n".join(pages)
    
    chapter_obj = f"""      {{
        volume: "Volume 2",
        chapter: "Chapter {ch_num}",
        label: "{label}",
        title: "{label}",
        summary: "{summary}",
        tags: ["story"],
        pages: [
{pages_str}
        ]
      }}"""
    return chapter_obj

with open('Threadborn-Complete.md', 'r', encoding='utf-8') as f:
    text = f.read()

# Extract Chapter 5
ch5_start = text.find('## Chapter 5: Everything That Fits in One Night')
ch6_start = text.find('## Chapter 6: The Part She Won\'t Admit')

if ch5_start != -1 and ch6_start != -1:
    ch5_text = text[ch5_start:ch6_start]
    ch6_text = text[ch6_start:]
    
    # Process Chapter 5
    ch5_content = ch5_text.split('*In which ')[1].split('---', 1)[1].strip()
    summary5 = "In which " + ch5_text.split('*In which ')[1].split('*')[0].strip()
    obj5 = parse_chapter(ch5_content, 5, "Everything That Fits in One Night", summary5, "Quiet Before · The Final Talk · Morning Arrives")
    
    # Process Chapter 6
    ch6_content = ch6_text.split('*In which ')[1].split('---', 1)[1].strip()
    summary6 = "In which " + ch6_text.split('*In which ')[1].split('*')[0].strip()
    obj6 = parse_chapter(ch6_content, 6, "The Part She Won't Admit", summary6, "Loss · The Realization · Moving Forward")

    # Insert into index.html
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()
        
    if "Everything That Fits in One Night" not in html:
        html = html.replace('        ]\n      }\n    ];', '        ]\n      },\n' + obj5 + ',\n' + obj6 + '\n    ];')
        with open('index.html', 'w', encoding='utf-8') as f:
            f.write(html)
        print("Chapters 5 and 6 added to index.html")
    else:
        print("Chapters already in index.html")
        
    # Translate to JP using deep-translator
    from deep_translator import GoogleTranslator
    translator = GoogleTranslator(source='en', target='ja')
    
    def translate_obj(obj_str):
        # We will do a basic chunk translation
        # Since the html strings are inside `...` we can regex replace them
        def tr_html(m):
            t = m.group(1)
            # quick and dirty translation of inner text
            from bs4 import BeautifulSoup, NavigableString
            soup = BeautifulSoup(t, 'html.parser')
            for node in soup.find_all(string=True):
                s = node.string
                if s and s.strip() and s.strip() != '&nbsp;':
                    try:
                        tr = translator.translate(s.strip())
                        node.replace_with(NavigableString(s.replace(s.strip(), tr)))
                    except: pass
            return f'`{str(soup)}`'
            
        translated = re.sub(r'`(.*?)`', tr_html, obj_str, flags=re.DOTALL)
        # translate title and summary
        translated = re.sub(r'title: "([^"]+)"', lambda m: f'title: "{translator.translate(m.group(1))}"', translated)
        translated = re.sub(r'summary: "([^"]+)"', lambda m: f'summary: "{translator.translate(m.group(1))}"', translated)
        translated = re.sub(r'label: "([^"]+)"', lambda m: f'label: "{translator.translate(m.group(1))}"', translated)
        return translated

    print("Translating Chapter 5...")
    obj5_jp = translate_obj(obj5)
    print("Translating Chapter 6...")
    obj6_jp = translate_obj(obj6)

    # Wait until index-jp.html is free
    # Since background translation might be done or still writing, we'll try to append.
    # Actually, we can just append it now if it's safe.
    with open('index-jp.html', 'r', encoding='utf-8') as f:
        jp_html = f.read()
    
    if "Everything That Fits in One Night" not in jp_html and obj5_jp.split('title: "')[1].split('"')[0] not in jp_html:
        jp_html = jp_html.replace('        ]\n      }\n    ];', '        ]\n      },\n' + obj5_jp + ',\n' + obj6_jp + '\n    ];')
        with open('index-jp.html', 'w', encoding='utf-8') as f:
            f.write(jp_html)
        print("Chapters 5 and 6 added to index-jp.html")

