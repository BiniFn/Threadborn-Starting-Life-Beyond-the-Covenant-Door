import re
from bs4 import BeautifulSoup

def get_english_paragraphs(html_path):
    with open(html_path, 'r', encoding='utf-8') as f:
        src = f.read()
    
    ch_start = src.index('const chapters = [')
    ch_end = src.index('const characters = [')
    chapters_js = src[ch_start:ch_end]
    
    import ast
    # Instead of full parsing, let's just extract all `<p class="novel-p">` contents
    soup = BeautifulSoup(chapters_js, 'html.parser')
    paragraphs = soup.find_all('p', class_='novel-p')
    return [p.get_text().strip() for p in paragraphs if p.get_text().strip()]

def get_japanese_paragraphs(md_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # split by double newline
    blocks = text.split('\n\n')
    # filter out headers, rules, blockquotes
    paragraphs = []
    for b in blocks:
        b = b.strip()
        if not b: continue
        if b.startswith('#'): continue
        if b.startswith('-'): continue
        if b.startswith('>'): continue
        if b == '---': continue
        paragraphs.append(b)
    return paragraphs

en_p = get_english_paragraphs('index.html')
# The chapters array has Vol 2 Ch 1, 2, 3, 4, 5, 6.
# I need to isolate Vol 2 Ch 3, 4, 5, 6
print(f"Total English paragraphs in chapters array: {len(en_p)}")

jp_p = []
for file in ['v2c3.md', 'v2c4.md', 'v2c5.md', 'v2c6.md']:
    jp_p.extend(get_japanese_paragraphs(file))

print(f"Total Japanese paragraphs generated: {len(jp_p)}")

# Print a few to check
for i in range(min(5, len(en_p), len(jp_p))):
    print(f"EN: {en_p[i]}")
    print(f"JP: {jp_p[i]}")
    print("---")
