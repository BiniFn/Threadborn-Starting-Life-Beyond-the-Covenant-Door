import os

def fix_hero(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replacements
    content = content.replace(
        'Threadborn: Reborn With Zero Dignity • dark fantasy • romance • gore • cosmic horror',
        'スレッドボーン：Reborn With Zero Dignity • ダークファンタジー • ロマンス • ゴア • コズミックホラー'
    )
    content = content.replace(
        'A boy dies, wakes in Lumera, and steps into a world that was never meant to survive him.',
        '少年は死に、ルメラで目覚め、彼が生き延びることを決して想定していなかった世界へと足を踏み入れる。'
    )
    content = content.replace(
        '<strong>Threadborn</strong> follows <strong>Yono Kazeshima</strong> after a sudden death throws him into Lumera beside Violet. Survival turns into dark fantasy, romance, and sealed monsters that get worse each chapter.',
        '<strong>Threadborn</strong> は、突然の死によってバイオレットと共にルメラへと放り込まれた<strong>風嶋ヨノ</strong>の物語。生き残るための戦いは、ダークファンタジー、ロマンス、そして章を追うごとに凶悪になる封印された怪物たちとの遭遇へと変わっていく。'
    )
    content = content.replace(
        '<strong>Volume 1:</strong> Yono learns Lumera’s rules, survives the Shade debt arc, and reaches the forest door hiding Velkor’s prison.',
        '<strong>第1巻:</strong> ヨノはルメラの法則を学び、シェイドの借金編を生き延び、ヴェルコールの牢獄を隠す森の扉に到達する。'
    )
    content = content.replace(
        '<button class="btn btn-secondary" onclick="localStorage.setItem(\'threadborn_lang\', \'en\'); window.location.href=\'./index.html\'">🇺🇸 English Version</button></button>\n              <button class="btn btn-secondary" onclick="localStorage.setItem(\'threadborn_lang\', \'en\'); window.location.href=\'./index.html\'">🇺🇸 English Version</button>',
        '<button class="btn btn-secondary" onclick="localStorage.setItem(\'threadborn_lang\', \'en\'); window.location.href=\'./index.html\'">🇺🇸 English Version</button>'
    )
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

fix_hero('index-jp.html')
print("Hero text fixed")
