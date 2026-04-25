import os
import re
from bs4 import BeautifulSoup, NavigableString
from deep_translator import GoogleTranslator

# Initialize translator
translator = GoogleTranslator(source='en', target='ja')

def batch_translate(texts):
    if not texts: return []
    # Join texts with a rare separator to minimize API calls
    separator = " \n\n###\n\n "
    joined = separator.join(texts)
    
    # Google Translate has a 5000 char limit
    if len(joined) > 4000:
        # Translate one by one
        res = []
        for t in texts:
            if not t.strip():
                res.append(t)
            else:
                try:
                    translated = translator.translate(t.strip())
                    # match whitespace
                    prefix = t[:len(t) - len(t.lstrip())]
                    suffix = t[len(t.rstrip()):]
                    res.append(prefix + translated + suffix)
                except Exception as e:
                    print("Translation error:", e)
                    res.append(t)
        return res

    try:
        translated_joined = translator.translate(joined)
        translated_texts = translated_joined.split("###")
        # clean up spaces around the separator
        translated_texts = [t.strip() for t in translated_texts]
        
        # Restore whitespace
        res = []
        for i, t in enumerate(texts):
            if i < len(translated_texts):
                tr = translated_texts[i]
                prefix = t[:len(t) - len(t.lstrip())]
                suffix = t[len(t.rstrip()):]
                res.append(prefix + tr + suffix)
            else:
                res.append(t)
        return res
    except Exception as e:
        print("Batch translation error:", e)
        # fallback to single
        return batch_translate_single(texts)

def batch_translate_single(texts):
    res = []
    for t in texts:
        if not t.strip():
            res.append(t)
        else:
            try:
                translated = translator.translate(t.strip())
                prefix = t[:len(t) - len(t.lstrip())]
                suffix = t[len(t.rstrip()):]
                res.append(prefix + translated + suffix)
            except:
                res.append(t)
    return res

def translate_html_content(html_str):
    soup = BeautifulSoup(html_str, 'html.parser')
    texts_to_translate = []
    nodes = []
    
    for text_node in soup.find_all(string=True):
        parent = text_node.parent
        if parent.name in ['style', 'script', 'head', 'title', 'meta', '[document]']:
            continue
        text = text_node.string
        if text and text.strip() and not text.strip() == '&nbsp;':
            texts_to_translate.append(text)
            nodes.append(text_node)
            
    translated_texts = batch_translate_single(texts_to_translate) # Using single to avoid delimiter issues in HTML text
    
    for node, tr_text in zip(nodes, translated_texts):
        node.replace_with(NavigableString(tr_text))
        
    return str(soup)

def process_file(filepath):
    print(f"Translating {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # 1. Translate legacyEpisodes HTML strings
    legacy_start = content.find('const legacyEpisodes = [')
    chapters_start = content.find('const chapters = [')
    characters_start = content.find('const characters = [')
    
    def html_replacer(match):
        html = match.group(1)
        translated = translate_html_content(html)
        return f'`{translated}`'
        
    if legacy_start != -1 and chapters_start != -1:
        legacy_block = content[legacy_start:chapters_start]
        translated_legacy = re.sub(r'`(.*?)`', html_replacer, legacy_block, flags=re.DOTALL)
        content = content[:legacy_start] + translated_legacy + content[chapters_start:]
        print("Done translating legacyEpisodes HTML.")
        
    chapters_start = content.find('const chapters = [')
    if chapters_start != -1 and characters_start != -1:
        chapters_block = content[chapters_start:characters_start]
        translated_chapters = re.sub(r'`(.*?)`', html_replacer, chapters_block, flags=re.DOTALL)
        content = content[:chapters_start] + translated_chapters + content[characters_start:]
        print("Done translating chapters HTML.")

    # Write incrementally
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
process_file('index-jp.html')
