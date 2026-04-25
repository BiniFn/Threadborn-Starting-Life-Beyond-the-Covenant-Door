import os
import re

def process_html_files():
    # 1. Extract main CSS from index.html
    with open('index.html', 'r', encoding='utf-8') as f:
        index_content = f.read()
        
    style_match = re.search(r'<style>(.*?)</style>', index_content, re.DOTALL)
    if style_match:
        css_content = style_match.group(1).strip()
        with open('global.css', 'w', encoding='utf-8') as f:
            f.write(css_content)
        print("Extracted global.css")
        
    # 2. Update all HTML files to link global.css and remove embedded styles
    html_files = [f for f in os.listdir('.') if f.endswith('.html')]
    for file in html_files:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Remove <style> blocks
        content = re.sub(r'<style>.*?</style>', '', content, flags=re.DOTALL)
        
        # Add link tag if not present
        if '<link rel="stylesheet" href="global.css">' not in content and '<link rel="stylesheet" href="./global.css">' not in content:
            # find </head> and insert before it
            head_end = content.find('</head>')
            if head_end != -1:
                content = content[:head_end] + '  <link rel="stylesheet" href="./global.css" />\n' + content[head_end:]
                
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
            
        print(f"Updated {file}")

if __name__ == '__main__':
    process_html_files()
