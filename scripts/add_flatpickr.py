import re
import os

flatpickr_tags = '''  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/themes/dark.css">
  <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
  <style>
    .flatpickr-calendar { font-family: 'Space Mono', monospace; }
  </style>
'''

init_script = '''
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      const dp = document.getElementById("dashboard-countdown-date");
      if (dp && typeof flatpickr !== "undefined") {
        flatpickr(dp, {
          enableTime: true,
          dateFormat: "Y-m-d H:i",
          time_24hr: false
        });
      }
    });
  </script>
</body>'''

def process_file(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add tags before </head> if not exists
    if 'flatpickr' not in content:
        content = content.replace('</head>', flatpickr_tags + '</head>')
        
        # Add init script before </body>
        content = content.replace('</body>', init_script)

        # Update CSS version tag just to be safe
        content = re.sub(r'global\.css\?v=\d+', 'global.css?v=17', content)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

process_file('index.html')
process_file('index-jp.html')
print("Added Flatpickr to index files.")
