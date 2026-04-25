import re

def convert_md_to_pages(md_content, vol_num, ch_num, title, subtitle):
    # Split by paragraphs
    blocks = md_content.split('\n\n')
    
    html_blocks = []
    
    # Add chapter head
    head = f'''<div class="chapter-head">
  <span class="chapter-num">巻0{vol_num} · 第0{ch_num}章</span>
  <h2 class="chapter-title">{title}</h2>
  <p class="chapter-subtitle">{subtitle}</p>
</div>'''
    html_blocks.append(head)
    
    for block in blocks:
        block = block.strip()
        if not block: continue
        if block.startswith('##') or block.startswith('#'): continue
        if block.startswith('*巻'): continue
        if block.startswith('---'): continue
        
        # Replace inline styles
        block = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', block)
        block = re.sub(r'\*(.*?)\*', r'<em>\1</em>', block)
        
        if block.startswith('>'):
            # System box
            lines = block.split('\n')
            title_match = re.search(r'>\s*<strong>(.*?)</strong>', lines[0])
            sys_title = title_match.group(1) if title_match else "Status"
            sys_body = '<br>'.join([l.replace('>', '').replace('<strong>', '').replace('</strong>', '').strip() for l in lines[1:]])
            html = f'<div class="system-box">\n  <h5>{sys_title}</h5>\n  <p>{sys_body}</p>\n</div>'
            html_blocks.append(html)
        elif block.startswith('###'):
            scene_title = block.replace('###', '').strip()
            html_blocks.append(f'<p class="scene-title">{scene_title}</p>')
        else:
            html_blocks.append(f'<p class="novel-p">{block}</p>')
            
    # Group into pages
    pages = []
    current_page = []
    p_count = 0
    
    for hb in html_blocks:
        current_page.append(hb)
        if 'novel-p' in hb: p_count += 1
        
        if p_count >= 12:
            pages.append('\n'.join(current_page))
            current_page = []
            p_count = 0
            
    if current_page:
        pages.append('\n'.join(current_page))
        
    js_pages = "pages: [\n"
    for p in pages:
        js_pages += f"`{p}`,\n"
    js_pages += "]"
    
    return js_pages

# Process v2c3
with open('v2c3.md', 'r', encoding='utf-8') as f: v2c3 = f.read()
v2c3_js = convert_md_to_pages(v2c3, 2, 3, "自分自身を埋葬した少年", "黒いホールがついに答える——そしてその答えは誰も予想していなかったものだった。")

with open('v2c4.md', 'r', encoding='utf-8') as f: v2c4 = f.read()
v2c4_js = convert_md_to_pages(v2c4, 2, 4, "結末を集める者", "この戦いのすべてのバージョンをすでに見たことのある誰かが到着し——そしてバイオレットが横から見ているのをやめると決意する章。")

with open('v2c5.md', 'r', encoding='utf-8') as f: v2c5 = f.read()
v2c5_js = convert_md_to_pages(v2c5, 2, 5, "一夜に収まるすべてのもの", "一夜がすべての良いものを保持し、朝がそれを奪う章。")

with open('v2c6.md', 'r', encoding='utf-8') as f: v2c6 = f.read()
v2c6_js = convert_md_to_pages(v2c6, 2, 6, "彼女が認めない部分", "バイオレットが絶対に心配しておらず、絶対に恋をしておらず、完全に大丈夫である章。彼女は大丈夫だ。彼女を見るのをやめなさい。")

with open('v1c3.md', 'r', encoding='utf-8') as f: v1c3 = f.read()
v1c3_js = convert_md_to_pages(v1c3, 1, 3, "監視者がノックする時", "街が大音量でその意見を紹介する章。")

all_js = f"""
// --- V1C3 ---
{v1c3_js}

// --- V2C3 ---
{v2c3_js}

// --- V2C4 ---
{v2c4_js}

// --- V2C5 ---
{v2c5_js}

// --- V2C6 ---
{v2c6_js}
"""

with open('generated_pages.js', 'w', encoding='utf-8') as f:
    f.write(all_js)
