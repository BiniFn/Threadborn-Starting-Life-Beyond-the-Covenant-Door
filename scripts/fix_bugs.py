import os
import re

files = ['index', 'login', 'signup', 'profile']

old_script = re.compile(r'<script>\s*\(function\(\) \{\s*var savedLang = localStorage\.getItem\(\'threadborn_lang\'\);.*?\}\)\(\);\s*</script>', re.DOTALL)

new_script = """<script>
    (function() {
      try {
        var savedLang = localStorage.getItem('threadborn_lang');
        if (!savedLang) return;
        var path = window.location.pathname;
        var isJp = path.indexOf('-jp') !== -1;
        
        if (savedLang === 'ja' && !isJp) {
          if (path === '/' || path === '/index' || path === '/index.html') {
            window.location.replace('./index-jp.html');
          } else if (path.indexOf('.html') !== -1) {
            window.location.replace(path.replace('.html', '-jp.html'));
          } else {
            window.location.replace(path + '-jp');
          }
        } else if (savedLang === 'en' && isJp) {
          if (path.indexOf('-jp.html') !== -1) {
            window.location.replace(path.replace('-jp.html', '.html'));
          } else {
            window.location.replace(path.replace('-jp', ''));
          }
        }
      } catch(e) {}
    })();
  </script>"""

for name in files:
    for ext in ['.html', '-jp.html']:
        fname = f"{name}{ext}"
        if not os.path.exists(fname): continue
        
        with open(fname, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Replace script
        if '<script>' in content:
            content = old_script.sub(new_script, content)
            
        # Fix avatar
        content = content.replace('<img id="user-avatar" alt="Profile picture" />', '<img id="user-avatar" alt="Profile picture" src="assets/threadborn-logo.png" />')
        
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(content)

print("Bugs fixed in HTML files.")
