import os

filepath = "index-jp.html"
if not os.path.exists(filepath):
    print("Not found")
    exit(1)

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

translations = [
    # Navigation
    ('>Home<', '>ホーム<'),
    ('>Volumes<', '>巻<'),
    ('>Chapters<', '>チャプター<'),
    ('>App<', '>アプリ<'),
    ('>Characters<', '>キャラクター<'),
    ('>Powers<', '>能力<'),
    ('>Leaks<', '>リーク<'),
    ('>Lore<', '>世界観<'),
    ('>Drawings<', '>アート<'),
    ('>Credits<', '>クレジット<'),
    ('>Login<', '>ログイン<'),
    ('>Sign Up<', '>登録<'),
    ('>Profile<', '>プロフィール<'),
    ('>Logout<', '>ログアウト<'),
    ('>Dashboard<', '>ダッシュボード<'),
    
    # Hero
    ('Anime / Light Novel • dark fantasy • romance • gore • cosmic horror', 'アニメ / ライトノベル • ダークファンタジー • ロマンス • ゴア • コズミックホラー'),
    ('Fate isn\'t given. It\'s severed.', '運命は与えられるものではない。断ち切るものだ。'),
    ('A boy dies, wakes in Lumera, and steps into a world that was never meant to survive him.', '一人の少年が死に、ルメラで目覚め、彼が生き延びるはずのなかった世界へと足を踏み入れる。'),
    ('<strong>Threadborn</strong> follows <strong>Yono Kazeshima</strong> after a sudden death throws him into Lumera beside Violet. Survival turns into dark fantasy, romance, and sealed monsters that get worse each chapter.', '『スレッドボーン』は、<strong>風島ヨノ</strong>の物語。突然の死により、彼はヴィオレットと共にルメラへと投げ出される。生存を懸けた闘いは、ダークファンタジー、ロマンス、そして章を追うごとに凶悪さを増す封印された怪物たちとの戦いへと変わっていく。'),
    
    # Buttons
    ('>Start Reading<', '>読み始める<'),
    ('>Download App<', '>アプリをダウンロード<'),
    
    # Sections
    ('<h2>Volumes & Arcs</h2>', '<h2>巻・アーク</h2>'),
    ('Select a volume to view its chapters.', '巻を選択して章を表示します。'),
    ('<h2>Recent Chapters</h2>', '<h2>最新の章</h2>'),
    ('Jump into the latest additions to the story.', '物語の最新の追加部分に飛び込もう。'),
    ('<h2>Reader Community</h2>', '<h2>読者コミュニティ</h2>'),
    ('Rate any volume or chapter. Everyone can read comments; login is required to post.', 'どの巻や章でも評価できます。コメントは誰でも読めますが、投稿にはログインが必要です。'),
    ('Share your comment, theory, or spoiler note...', 'コメント、考察、またはネタバレを共有...'),
    ('>Post Reaction<', '>反応を投稿<'),
    
    # App Section
    ('<h2>Threadborn App</h2>', '<h2>スレッドボーン アプリ</h2>'),
    ('Install the lightweight native app for the best offline reading experience.', '最高のオフライン読書体験のために、軽量なネイティブアプリをインストールしてください。'),
    ('>Android APK<', '>Android APK<'),
    ('>Windows App<', '>Windows アプリ<'),
    ('>macOS App<', '>macOS アプリ<'),
    
    # Characters Section
    ('<h2>Characters</h2>', '<h2>キャラクター</h2>'),
    ('Major players in the Covenant Door storyline.', 'コヴナント・ドアの物語における主要な登場人物。'),
    
    # Lore Section
    ('<h2>World Lore</h2>', '<h2>世界観</h2>'),
    ('The rules, locations, and history of Lumera.', 'ルメラの規則、場所、そして歴史。'),
    
    # Art Section
    ('<h2>Drawings</h2>', '<h2>アート</h2>'),
    ('Character art for Threadborn will be shown here.', '『スレッドボーン』のキャラクターアートがここに表示されます。'),
    ('Official character designs, concept art, and illustrations for the Threadborn cast.', '『スレッドボーン』のキャストの公式キャラクターデザイン、コンセプトアート、イラスト。'),
    ('Character Gallery', 'キャラクターギャラリー'),
    
    # Credits
    ('<h2>Credits</h2>', '<h2>クレジット</h2>'),
    ('Core project credits, official links, and export attribution for <em>Threadborn</em>.', '『スレッドボーン』のコアプロジェクトクレジット、公式リンク、およびエクスポートの帰属。')
]

for eng, jp in translations:
    content = content.replace(eng, jp)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Translated index-jp.html")
