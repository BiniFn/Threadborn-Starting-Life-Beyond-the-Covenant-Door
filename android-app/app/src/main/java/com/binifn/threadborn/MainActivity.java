package com.binifn.threadborn;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.http.SslError;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceError;
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
  private static final String APP_HOST = "https://appassets.androidplatform.net/";
  private static final String LEGACY_WEB_HOST = "https://threadborn.vercel.app";
  private static final String APP_SITE_PREFIX = "https://appassets.androidplatform.net/assets/site";
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
    CookieManager cookieManager = CookieManager.getInstance();
    cookieManager.setAcceptCookie(true);
    cookieManager.setAcceptThirdPartyCookies(webView, true);

    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setAllowFileAccess(true);
    settings.setAllowContentAccess(true);
    settings.setUseWideViewPort(true);
    settings.setLoadWithOverviewMode(true);
    settings.setTextZoom(100);
    settings.setBuiltInZoomControls(false);
    settings.setDisplayZoomControls(false);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
    settings.setAllowFileAccessFromFileURLs(true);
    webView.clearCache(true);

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
        String apiBase = BuildConfig.API_BASE_URL == null ? "" : BuildConfig.API_BASE_URL;
        String escapedApiBase = apiBase.replace("\\", "\\\\").replace("'", "\\'");
        webView.evaluateJavascript(
          "window.__THREADBORN_API_BASE='" + escapedApiBase + "';" +
            "try{localStorage.setItem('threadborn_api_base','" + escapedApiBase + "');}catch(e){}" +
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
      public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        super.onReceivedError(view, request, error);
        if (request != null && request.isForMainFrame()) {
          recoverToOfflineShell();
        }
      }

      @Override
      public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
        super.onReceivedHttpError(view, request, errorResponse);
        if (request != null && request.isForMainFrame() && errorResponse != null && errorResponse.getStatusCode() >= 400) {
          recoverToOfflineShell();
        }
      }

      @Override
      public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
        handler.cancel();
        recoverToOfflineShell();
      }

      @Override
      public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        return assetLoader.shouldInterceptRequest(request.getUrl());
      }

      @Override
      public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
        return assetLoader.shouldInterceptRequest(Uri.parse(url));
      }
    });

    webView.loadUrl(START_URL);
  }

  private boolean handleUrl(String url) {
    if (url == null) {
      return false;
    }

    Uri parsed = Uri.parse(url);
    String path = parsed.getPath() == null ? "" : parsed.getPath();

    // Keep any in-app navigation pinned to bundled site files.
    if (url.startsWith(APP_HOST) || url.startsWith(LEGACY_WEB_HOST) || !path.isEmpty()) {
      String bundledUrl = toBundledSiteUrl(parsed);
      if (bundledUrl != null) {
        if (!bundledUrl.equals(url)) {
          webView.loadUrl(bundledUrl);
          return true;
        }
        return false;
      }
    }

    if (path.endsWith(".html") || path.equals("/") || path.isEmpty()) {
      String fallback = APP_SITE_PREFIX + "/index.html";
      if (!fallback.equals(url)) {
        webView.loadUrl(fallback);
        return true;
      }
      return false;
    }

    if (url.startsWith("http://") || url.startsWith("https://")) {
      openExternal(url);
      return true;
    }
    return false;
  }

  private String toBundledSiteUrl(Uri parsed) {
    String path = parsed.getPath();
    if (path == null || path.isEmpty() || "/".equals(path)) {
      path = "/index.html";
    }
    if (path.startsWith("/assets/site/")) {
      return APP_HOST + path.substring(1);
    }
    if (path.startsWith("/assets/")) {
      return APP_HOST + path.substring(1);
    }
    if (path.endsWith(".html")) {
      return APP_SITE_PREFIX + path;
    }
    if (path.startsWith("/api/")) {
      return null;
    }
    if (path.startsWith("/")) {
      return APP_SITE_PREFIX + path;
    }
    return APP_SITE_PREFIX + "/" + path;
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

  private void recoverToOfflineShell() {
    runOnUiThread(() -> {
      if (webView != null) {
        webView.loadUrl(START_URL);
      }
      showToast("Offline mode: loading bundled reader.");
    });
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
