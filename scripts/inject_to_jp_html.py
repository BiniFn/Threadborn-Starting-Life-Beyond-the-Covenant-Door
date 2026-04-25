import re

with open('index-jp.html', 'r', encoding='utf-8') as f:
    content = f.read()

# I will replace the titles, labels, summaries in the chapters array
translations = {
    'label: "The Boy Who Buried Himself"': 'label: "自分自身を埋葬した少年"',
    'title: "The Boy Who Buried Himself"': 'title: "自分自身を埋葬した少年"',
    'summary: "In which the black hall finally answers — and the answer is worse than anyone expected."': 'summary: "黒いホールがついに答える——そしてその答えは誰も予想していなかったものだった。"',
    
    'label: "The One Who Collects the Endings"': 'label: "結末を集める者"',
    'title: "The One Who Collects the Endings"': 'title: "結末を集める者"',
    'summary: "In which someone arrives who has already seen every version of this fight — and Violet decides to stop watching from the sidelines."': 'summary: "この戦いのすべてのバージョンをすでに見たことのある誰かが到着し——そしてバイオレットが横から見ているのをやめると決意する章。"',
    
    'label: "Everything That Fits in One Night"': 'label: "一夜に収まるすべてのもの"',
    'title: "Everything That Fits in One Night"': 'title: "一夜に収まるすべてのもの"',
    'summary: "In which a single night holds everything good, and the morning takes it away."': 'summary: "一夜がすべての良いものを保持し、朝がそれを奪う章。"',
    
    'label: "The Part She Won\'t Admit"': 'label: "彼女が認めない部分"',
    'title: "The Part She Won\'t Admit"': 'title: "彼女が認めない部分"',
    'summary: "In which Violet is definitely not worried, definitely not in love, and completely fine. She is fine. Stop looking at her."': 'summary: "バイオレットが絶対に心配しておらず、絶対に恋をしておらず、完全に大丈夫である章。彼女は大丈夫だ。彼女を見るのをやめなさい。"'
}

for en, jp in translations.items():
    content = content.replace(en, jp)

# Now read the generated pages
with open('generated_pages.js', 'r', encoding='utf-8') as f:
    gen_js = f.read()

# Extract the pages blocks
import ast

def extract_pages_array(text, start_marker):
    idx = text.find(start_marker)
    if idx == -1: return None
    start_pages = text.find('pages: [', idx)
    end_pages = text.find(']', start_pages) + 1
    return text[start_pages:end_pages]

v2c3_pages = extract_pages_array(gen_js, '// --- V2C3 ---')
v2c4_pages = extract_pages_array(gen_js, '// --- V2C4 ---')
v2c5_pages = extract_pages_array(gen_js, '// --- V2C5 ---')
v2c6_pages = extract_pages_array(gen_js, '// --- V2C6 ---')

# Replace in content
# Vol 2 Ch 3 replacement
idx_v2c3 = content.find('title: "自分自身を埋葬した少年"')
if idx_v2c3 != -1:
    p_start = content.find('pages: [', idx_v2c3)
    # find the matching closing bracket
    bracket_count = 0
    p_end = -1
    for i in range(p_start, len(content)):
        if content[i] == '[': bracket_count += 1
        elif content[i] == ']':
            bracket_count -= 1
            if bracket_count == 0:
                p_end = i + 1
                break
    content = content[:p_start] + v2c3_pages + content[p_end:]

# Vol 2 Ch 4 replacement
idx_v2c4 = content.find('title: "結末を集める者"')
if idx_v2c4 != -1:
    p_start = content.find('pages: [', idx_v2c4)
    bracket_count = 0
    p_end = -1
    for i in range(p_start, len(content)):
        if content[i] == '[': bracket_count += 1
        elif content[i] == ']':
            bracket_count -= 1
            if bracket_count == 0:
                p_end = i + 1
                break
    content = content[:p_start] + v2c4_pages + content[p_end:]

# Vol 2 Ch 5 replacement
idx_v2c5 = content.find('title: "一夜に収まるすべてのもの"')
if idx_v2c5 != -1:
    p_start = content.find('pages: [', idx_v2c5)
    bracket_count = 0
    p_end = -1
    for i in range(p_start, len(content)):
        if content[i] == '[': bracket_count += 1
        elif content[i] == ']':
            bracket_count -= 1
            if bracket_count == 0:
                p_end = i + 1
                break
    content = content[:p_start] + v2c5_pages + content[p_end:]

# Vol 2 Ch 6 replacement
idx_v2c6 = content.find('title: "彼女が認めない部分"')
if idx_v2c6 != -1:
    p_start = content.find('pages: [', idx_v2c6)
    bracket_count = 0
    p_end = -1
    for i in range(p_start, len(content)):
        if content[i] == '[': bracket_count += 1
        elif content[i] == ']':
            bracket_count -= 1
            if bracket_count == 0:
                p_end = i + 1
                break
    content = content[:p_start] + v2c6_pages + content[p_end:]

# Write back
with open('index-jp.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully injected V2C3-C6 Japanese pages into index-jp.html")
