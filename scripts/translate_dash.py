import os

filepath = "index-jp.html"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

translations = [
    ('>Owner Dashboard<', '>オーナーダッシュボード<'),
    ('>Manage site content, global announcements, and art gallery.<', '>サイトコンテンツ、グローバルアナウンスメント、アートギャラリーを管理します。<'),
    ('>Global Announcement<', '>グローバルアナウンスメント<'),
    ('>Set a persistent banner at the top of the main menus.<', '>メインメニューの上部に持続的なバナーを設定します。<'),
    ('placeholder="Announcement text..."', 'placeholder="アナウンスメントのテキスト..."'),
    ('>Save Config<', '>設定を保存<'),
    ('>Global Countdown<', '>グローバルカウントダウン<'),
    ('placeholder="Countdown Title..."', 'placeholder="カウントダウンのタイトル..."'),
    ('>Upload Art<', '>アートをアップロード<'),
    ('>Add new art to the Drawings gallery.<', '>アートギャラリーに新しいアートを追加します。<'),
    ('placeholder="Character Name (e.g. Yono)"', 'placeholder="キャラクター名（例: ヨノ）"'),
    ('placeholder="Label (e.g. Official Concept)"', 'placeholder="ラベル（例: 公式コンセプト）"')
]

for eng, jp in translations:
    content = content.replace(eng, jp)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Translated dashboard section in index-jp.html")
