import os
import re

for html_file in ["signup.html", "signup-jp.html"]:
    with open(html_file, "r") as f:
        html = f.read()

    # Remove the HTML input fields and labels
    html = re.sub(r'<label for="avatar">Profile picture</label>.*?</style>', '', html, flags=re.DOTALL) # wait there is no style tag there
    
    html = re.sub(r'<label for="avatar">.*?</label>\s*', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<input[^>]*id="avatar"[^>]*>\s*', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<img[^>]*id="avatar-preview"[^>]*>\s*', '', html, flags=re.IGNORECASE)
    
    # Remove the JS variables and event listener
    html = re.sub(r'const avatarInput = document\.getElementById\("avatar"\);\s*', '', html)
    html = re.sub(r'const avatarPreview = document\.getElementById\("avatar-preview"\);\s*', '', html)
    html = re.sub(r'let avatarDataUrl = "";\s*', '', html)
    html = re.sub(r'avatarInput\.addEventListener\("change", \(\) => \{.*?\}\);\s*', '', html, flags=re.DOTALL)
    
    # Update payload
    html = html.replace('avatarUrl: avatarDataUrl', 'avatarUrl: ""')
    
    with open(html_file, "w") as f:
        f.write(html)

print("Avatar uploader removed.")
