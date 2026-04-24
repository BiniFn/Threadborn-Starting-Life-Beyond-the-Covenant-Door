import os

files = ['index', 'login', 'signup', 'profile']

# The exact block to remove
loading_block_en = """  <div id="loading-screen" class="loading-screen" aria-hidden="true">
    <div class="loading-shell">
      <img class="loading-logo" src="assets/threadborn-logo.png" alt="Threadborn loading logo" />
      <h2>Entering Lumera</h2>
      <p>Loading the reader, chapters, and collector tools.</p>
      <div class="loading-bar" aria-hidden="true">
        <div class="loading-fill"></div>
      </div>
    </div>
  </div>\n"""

loading_block_jp = """  <div id="loading-screen" class="loading-screen" aria-hidden="true">
    <div class="loading-shell">
      <img class="loading-logo" src="assets/threadborn-logo.png" alt="Threadborn loading logo" />
      <h2>ルメラにアクセス中</h2>
      <p>リーダー、チャプター、コレクターツールを読み込んでいます。</p>
      <div class="loading-bar" aria-hidden="true">
        <div class="loading-fill"></div>
      </div>
    </div>
  </div>\n"""

for name in files:
    for ext in ['.html', '-jp.html']:
        fname = f"{name}{ext}"
        if not os.path.exists(fname): continue
        
        with open(fname, 'r', encoding='utf-8') as f:
            content = f.read()
            
        content = content.replace(loading_block_en, '')
        content = content.replace(loading_block_jp, '')
        
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(content)

print("Loading screen removed from all files.")
