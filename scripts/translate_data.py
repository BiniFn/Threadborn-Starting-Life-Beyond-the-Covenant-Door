import os
import re
from deep_translator import GoogleTranslator

translator = GoogleTranslator(source='en', target='ja')

def batch_translate_single(texts):
    res = []
    for t in texts:
        if not t.strip():
            res.append(t)
        else:
            try:
                res.append(translator.translate(t.strip()))
            except:
                res.append(t)
    return res

def process_file(filepath):
    print(f"Translating data in {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Translate titles, summaries, quotes
    # For chapters:
    # title: "...", summary: "..."
    # We can use regex to find keys we want to translate
    
    def replacer(match):
        key = match.group(1)
        text = match.group(2)
        if not text.strip(): return match.group(0)
        translated = translator.translate(text)
        return f'{key}: "{translated}"'
        
    def replacer_tag(match):
        text = match.group(1)
        if not text.strip(): return match.group(0)
        translated = translator.translate(text)
        return f'"{translated}"'

    # Translate `title: "text"`
    content = re.sub(r'(title|summary|label|name|quote|about|type|note):\s*"([^"]+)"', replacer, content)
    # Translate single quotes too
    def replacer_single(match):
        key = match.group(1)
        text = match.group(2)
        if not text.strip(): return match.group(0)
        translated = translator.translate(text)
        return f"{key}: '{translated}'"
    content = re.sub(r"(title|summary|label|name|quote|about|type|note):\s*'([^']+)'", replacer_single, content)

    # Translate tags array: tags: ["...", "..."]
    # We will do a basic replacement of strings inside tags array
    def tags_replacer(match):
        tags_inner = match.group(1)
        tags_translated = re.sub(r'"([^"]+)"', replacer_tag, tags_inner)
        return f'tags: [{tags_translated}]'
    
    content = re.sub(r'tags:\s*\[(.*?)\]', tags_replacer, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Done translating data objects.")

process_file('index-jp.html')
