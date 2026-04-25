import re

with open('index-jp.html', 'r', encoding='utf-8') as f:
    content = f.read()

# I will replace the titles, labels, summaries in the legacyEpisodes array
# Actually, legacyEpisodes doesn't have label/title/summary properties, it just has `pages: [ ... ]`
# Let's find the `// ---- CHAPTER 3 ----` inside legacyEpisodes
idx_v1c3 = content.find('// ---- CHAPTER 3 ----')

if idx_v1c3 != -1:
    p_start = content.find('pages: [', idx_v1c3)
    bracket_count = 0
    p_end = -1
    for i in range(p_start, len(content)):
        if content[i] == '[': bracket_count += 1
        elif content[i] == ']':
            bracket_count -= 1
            if bracket_count == 0:
                p_end = i + 1
                break
                
    # Now read the generated pages
    with open('generated_pages.js', 'r', encoding='utf-8') as f:
        gen_js = f.read()
        
    def extract_pages_array(text, start_marker):
        idx = text.find(start_marker)
        if idx == -1: return None
        start_pages = text.find('pages: [', idx)
        end_pages = text.find(']', start_pages) + 1
        return text[start_pages:end_pages]
        
    v1c3_pages = extract_pages_array(gen_js, '// --- V1C3 ---')
    
    content = content[:p_start] + v1c3_pages + content[p_end:]
    
    with open('index-jp.html', 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Successfully injected V1C3 Japanese pages into index-jp.html")
else:
    print("Could not find CHAPTER 3 block")
