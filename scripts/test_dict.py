import re

def extract_paragraphs(md_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    blocks = text.split('\n\n')
    paragraphs = []
    for b in blocks:
        b = b.strip()
        # Clean markdown formatting to match raw text
        b = re.sub(r'^\s*#+\s+', '', b)
        b = re.sub(r'^\s*>\s+', '', b)
        b = b.replace('**', '').replace('*', '').replace('`', '')
        b = b.strip()
        
        if not b or b == '---' or b.startswith('<!--'): continue
        paragraphs.append(b)
    return paragraphs

en = extract_paragraphs('Threadborn-Complete.md')
jp = extract_paragraphs('Threadborn-Complete-JP.md')

print(f"EN paras: {len(en)}, JP paras: {len(jp)}")

# Build dictionary
translation_dict = {}
matches = 0
for i in range(min(len(en), len(jp))):
    e = en[i]
    j = jp[i]
    if len(e) > 5:
        translation_dict[e] = j
        matches += 1

print(f"Built dictionary with {matches} entries.")

# Test against index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

from bs4 import BeautifulSoup
soup = BeautifulSoup(html_content, 'html.parser')

novel_ps = soup.find_all(['p', 'span', 'h2', 'h5', 'div'], class_=re.compile(r'novel-p|dialogue|thought|scene-title|chapter-title|system-box'))
html_texts = [node.get_text().strip().replace('**', '').replace('*', '') for node in novel_ps if node.get_text().strip()]

found = 0
for text in html_texts:
    if text in translation_dict:
        found += 1

print(f"Found {found} / {len(html_texts)} translations for HTML text nodes.")
