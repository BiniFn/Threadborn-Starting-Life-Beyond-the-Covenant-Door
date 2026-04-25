import os
import re

html_files = [f for f in os.listdir('.') if f.endswith('.html')]
for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Remove <style> blocks
    content = re.sub(r'<style>.*?</style>', '', content, flags=re.DOTALL)
    
    # Add link tag if not present
    if '<link rel="stylesheet" href="./global.css">' not in content and '<link rel="stylesheet" href="global.css">' not in content:
        head_end = content.find('</head>')
        if head_end != -1:
            content = content[:head_end] + '  <link rel="stylesheet" href="./global.css" />\n' + content[head_end:]
            
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Stripped styles from {file}")
