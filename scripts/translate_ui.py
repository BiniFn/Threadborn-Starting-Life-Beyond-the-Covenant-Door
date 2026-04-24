import os
import re

def fix_ui(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # JS changes
    content = content.replace(
        "`PAGE ${pageIndex + 1} OF ${chapter.pages.length} \u00a0 ABOUT ${Math.ceil(words / 200)} MIN LEFT \u00a0 PROGRESS SAVED ON THIS DEVICE`",
        "`ページ ${pageIndex + 1} / ${chapter.pages.length} \u00a0 残り約 ${Math.ceil(words / 200)} 分 \u00a0 進行状況は保存されています`"
    )
    content = content.replace(
        "`${chapter.volume} • ${chapter.chapter}`",
        "`${chapter.volume.replace('Volume ', '第')}巻 • ${chapter.chapter.replace('Chapter ', '第')}章`"
    )
    content = content.replace(
        'button.textContent = "Remove Bookmark";',
        'button.textContent = "ブックマークを削除";'
    )
    content = content.replace(
        'button.textContent = "Add Bookmark";',
        'button.textContent = "ブックマークを追加";'
    )
    content = content.replace(
        'toolsBtn.textContent = "Hide tools";',
        'toolsBtn.textContent = "ツールを隠す";'
    )
    content = content.replace(
        'toolsBtn.textContent = "Show tools";',
        'toolsBtn.textContent = "ツールを表示";'
    )
    
    # HTML changes
    content = content.replace('<span>Close</span>', '<span>閉じる</span>')
    content = content.replace('>Show tools</button>', '>ツールを表示</button>')
    content = content.replace('>Add Bookmark</button>', '>ブックマークを追加</button>')
    content = content.replace('>Previous</button>', '>前へ</button>')
    content = content.replace('>Next</button>', '>次へ</button>')
    content = content.replace('Page 1 / 3', 'ページ 1 / 3')
    
    # Additional missed UI translations from index.html
    content = content.replace('>Guest reader<', '>ゲストリーダー<')
    content = content.replace('Resume Volume', '続きを読む: 第')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

fix_ui('index-jp.html')
print("UI fixed")
