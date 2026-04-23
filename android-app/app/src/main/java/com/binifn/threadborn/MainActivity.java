package com.binifn.threadborn;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends AppCompatActivity {
  private static final String START_URL = "https://appassets.androidplatform.net/assets/site/index.html";
  private WebView webView;

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_main);

    webView = findViewById(R.id.web_view);
    WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
      .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
      .build();

    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setAllowFileAccess(true);
    settings.setAllowContentAccess(true);
    settings.setUseWideViewPort(true);
    settings.setLoadWithOverviewMode(true);
    settings.setBuiltInZoomControls(false);
    settings.setDisplayZoomControls(false);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);

    webView.setWebChromeClient(new WebChromeClient());
    webView.addJavascriptInterface(new AndroidBridge(this), "AndroidBridge");
    webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
      if (url != null && url.startsWith("https://appassets.androidplatform.net/")) {
        showToast("This build already includes the offline app files.");
        return;
      }
      openExternal(url);
    });
    webView.setWebViewClient(new WebViewClient() {
      @Override
      public void onPageFinished(WebView view, String url) {
        webView.evaluateJavascript(
          "document.documentElement.classList.add('android-app');" +
            "const apkLink=document.getElementById('apk-download-link');" +
            "if(apkLink){apkLink.textContent='Android app installed';apkLink.removeAttribute('href');apkLink.removeAttribute('download');apkLink.style.pointerEvents='none';apkLink.style.opacity='0.65';}" +
            "const installBtn=document.getElementById('install-btn');if(installBtn){installBtn.style.display='none';}" +
            "const apkNote=document.getElementById('apk-note');if(apkNote){apkNote.textContent='You are using the offline Android app build. PDF and EPUB exports save straight to your device.';}",
          null
        );
      }

      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return handleUrl(request.getUrl().toString());
      }

      @Override
      public boolean shouldOverrideUrlLoading(WebView view, String url) {
        return handleUrl(url);
      }

      @Override
      public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        return assetLoader.shouldInterceptRequest(request.getUrl());
      }
    });

    webView.loadUrl(START_URL);
  }

  private boolean handleUrl(String url) {
    if (url == null) {
      return false;
    }

    if (url.startsWith("http://") || url.startsWith("https://")) {
      if (url.startsWith("https://appassets.androidplatform.net/")) {
        return false;
      }
      openExternal(url);
      return true;
    }

    return false;
  }

  void showToast(String message) {
    runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_SHORT).show());
  }

  private void openExternal(String url) {
    try {
      startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
    } catch (ActivityNotFoundException error) {
      showToast("No app can open this link.");
    }
  }

  @Override
  public void onBackPressed() {
    if (webView.canGoBack()) {
      webView.goBack();
      return;
    }

    super.onBackPressed();
  }
}
