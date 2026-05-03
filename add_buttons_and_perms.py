import os
import re

# 1. Update MainActivity.java for POST_NOTIFICATIONS
java_file = "android-app/app/src/main/java/com/binifn/threadborn/MainActivity.java"
with open(java_file, "r") as f:
    java_code = f.read()

imports_to_add = """
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import androidx.core.app.ActivityCompat;
"""
if "Manifest.permission.POST_NOTIFICATIONS" not in java_code:
    # insert imports
    java_code = java_code.replace("import android.os.Bundle;", imports_to_add + "import android.os.Bundle;")
    
    # insert permission check
    permission_code = """
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
        }
    }
"""
    java_code = java_code.replace("setContentView(R.layout.activity_main);", "setContentView(R.layout.activity_main);\n" + permission_code)

with open(java_file, "w") as f:
    f.write(java_code)


# 2. Add JP APK download buttons in index.html and index-jp.html
for html_file in ["index.html", "index-jp.html"]:
    with open(html_file, "r") as f:
        html = f.read()

    # Main APK button replacement
    if 'id="apk-download-jp"' not in html:
        # Regex to find the primary download APK link and append the JP one
        html = re.sub(
            r'(<a[^>]*id="apk-download-link"[^>]*>.*?</a>)',
            r'\1\n                            <a class="btn btn-secondary" id="apk-download-jp" href="https://github.com/BiniFn/Threadborn-Starting-Life-Beyond-the-Covenant-Door/releases/latest/download/threadborn-jp.apk" download>Download Japan APK</a>',
            html,
            flags=re.DOTALL
        )
        
        # Regex to find the secondary download APK link
        html = re.sub(
            r'(<a[^>]*id="apk-download-link-secondary"[^>]*>.*?</a>)',
            r'\1\n                                <a class="btn btn-secondary" id="apk-download-jp-secondary" href="https://github.com/BiniFn/Threadborn-Starting-Life-Beyond-the-Covenant-Door/releases/latest/download/threadborn-jp.apk" download>Download Japan APK</a>',
            html,
            flags=re.DOTALL
        )

        # Update Javascript snippet that hides the button natively to also hide the JP button
        html = html.replace(
            "const apkLink=document.getElementById('apk-download-link');",
            "const apkLink=document.getElementById('apk-download-link'); const apkJp=document.getElementById('apk-download-jp'); const apkJpSec=document.getElementById('apk-download-jp-secondary'); if(apkJp) { apkJp.style.display='none'; } if(apkJpSec) { apkJpSec.style.display='none'; }"
        )

    with open(html_file, "w") as f:
        f.write(html)

print("Buttons and permissions added.")
