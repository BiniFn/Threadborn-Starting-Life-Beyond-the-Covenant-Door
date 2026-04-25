package com.binifn.threadborn;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

public class AndroidBridge {
  private final MainActivity activity;
  private final SharedPreferences preferences;

  public AndroidBridge(MainActivity activity) {
    this.activity = activity;
    this.preferences = activity.getSharedPreferences("threadborn_prefs", 0);
  }

  @JavascriptInterface
  public void saveFile(String filename, String mimeType, String base64Data) {
    new Thread(() -> {
      try {
        byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
        Uri uri = saveToDownloads(safeFilename(filename), mimeType, bytes);
        activity.showToast("Saved: " + uri.toString());
      } catch (Exception error) {
        activity.showToast("Save failed");
      }
    }).start();
  }

  private Uri saveToDownloads(String filename, String mimeType, byte[] bytes) throws IOException {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ContentResolver resolver = activity.getContentResolver();
      ContentValues values = new ContentValues();
      values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
      values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
      values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Threadborn");
      values.put(MediaStore.Downloads.IS_PENDING, 1);

      Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
      if (uri == null) {
        throw new IOException("Could not create download entry.");
      }

      try (OutputStream outputStream = resolver.openOutputStream(uri)) {
        if (outputStream == null) {
          throw new IOException("Could not open output stream.");
        }
        outputStream.write(bytes);
      }

      values.clear();
      values.put(MediaStore.Downloads.IS_PENDING, 0);
      resolver.update(uri, values, null, null);
      return uri;
    }

    File directory = new File(activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "Threadborn");
    if (!directory.exists() && !directory.mkdirs()) {
      throw new IOException("Could not create download directory.");
    }

    File outputFile = new File(directory, filename);
    try (FileOutputStream outputStream = new FileOutputStream(outputFile)) {
      outputStream.write(bytes);
    }
    return Uri.fromFile(outputFile);
  }

  private String safeFilename(String filename) {
    return filename.replaceAll("[^A-Za-z0-9._-]", "_");
  }

  @JavascriptInterface
  public void setStringPreference(String key, String value) {
    preferences.edit().putString(key, value).apply();
  }

  @JavascriptInterface
  public String getStringPreference(String key, String defaultValue) {
    return preferences.getString(key, defaultValue);
  }

  @JavascriptInterface
  public void setIntPreference(String key, int value) {
    preferences.edit().putInt(key, value).apply();
  }

  @JavascriptInterface
  public int getIntPreference(String key, int defaultValue) {
    return preferences.getInt(key, defaultValue);
  }

  @JavascriptInterface
  public void syncDataStore(String data) {
    // Store synchronized data for cross-device compatibility
    preferences.edit().putString("data_store", data).apply();
    activity.showToast("Data synchronized");
  }

  @JavascriptInterface
  public String getDataStore() {
    return preferences.getString("data_store", "{}");
  }

  @JavascriptInterface
  public String getDeviceInfo() {
    return "Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")";
  }
}

