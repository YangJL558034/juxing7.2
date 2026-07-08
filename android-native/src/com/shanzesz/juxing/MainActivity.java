package com.shanzesz.juxing;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.net.NetworkRequest;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final String CLOUD_URL = "https://test.shanzesz.com/mobile";
    private static final String OFFLINE_URL = "file:///android_asset/offline.html";
    private static final String NOTIFICATION_CHANNEL_ID = "juxing_messages";
    private static final String NOTIFICATION_CHANNEL_NAME = "聚星消息提醒";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 3011;
    private static final int FILE_CHOOSER_REQUEST = 3012;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private boolean showingOffline;
    private ConnectivityManager.NetworkCallback networkCallback;
    private ValueCallback<Uri[]> pendingFileChooser;
    private long lastOfflineBackAt;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(Color.parseColor("#071A33"));
            getWindow().setNavigationBarColor(Color.parseColor("#071A33"));
        }

        WebView.setWebContentsDebuggingEnabled(false);
        createNotificationChannel();
        requestNotificationPermissionIfNeeded();
        setupWebView();
        registerNetworkWatcher();

        if (isOnline()) {
            loadCloud();
        } else {
            showOfflinePage();
        }
    }

    private void setupWebView() {
        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setUserAgentString(settings.getUserAgentString() + " JuxingAndroid/1.0");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }
        CookieManager.getInstance().setAcceptCookie(true);

        webView.addJavascriptInterface(new JuxingAndroidBridge(), "JuxingAndroid");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                WebView view,
                ValueCallback<Uri[]> filePathCallback,
                FileChooserParams fileChooserParams
            ) {
                if (pendingFileChooser != null) {
                    pendingFileChooser.onReceiveValue(null);
                }
                pendingFileChooser = filePathCallback;

                try {
                    startActivityForResult(fileChooserParams.createIntent(), FILE_CHOOSER_REQUEST);
                } catch (ActivityNotFoundException error) {
                    pendingFileChooser = null;
                    Toast.makeText(MainActivity.this, "当前设备没有可用的文件选择器", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme) || "file".equalsIgnoreCase(scheme)) {
                    return false;
                }

                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException error) {
                    Toast.makeText(MainActivity.this, "无法打开该链接", Toast.LENGTH_SHORT).show();
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (url != null && url.startsWith("http")) {
                    injectBridgeScript();
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request != null && request.isForMainFrame()) {
                    showOfflinePage();
                }
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || pendingFileChooser == null) return;

        Uri[] result = resultCode == RESULT_OK
            ? WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            : null;
        pendingFileChooser.onReceiveValue(result);
        pendingFileChooser = null;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }

        if (showingOffline) {
            long now = System.currentTimeMillis();
            if (now - lastOfflineBackAt < 1800) {
                finish();
                return;
            }
            lastOfflineBackAt = now;
            Toast.makeText(this, "再按一次退出聚星", Toast.LENGTH_SHORT).show();
            return;
        }

        if (webView != null) {
            webView.evaluateJavascript(
                "try{window.dispatchEvent(new PopStateEvent('popstate'));history.back();}catch(e){history.back();}",
                null
            );
        }
    }

    @Override
    protected void onDestroy() {
        unregisterNetworkWatcher();
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private void loadCloud() {
        showingOffline = false;
        if (webView == null) return;
        webView.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
        webView.loadUrl(CLOUD_URL);
    }

    private void showOfflinePage() {
        showingOffline = true;
        if (webView == null) return;
        webView.getSettings().setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
        webView.loadUrl(OFFLINE_URL);
    }

    private void injectBridgeScript() {
        if (webView == null) return;
        try {
            String script = readAssetText("juxing-bridge.js");
            webView.evaluateJavascript(script, null);
        } catch (IOException error) {
            // The app can still work online even if the helper script cannot be injected.
        }
    }

    private void flushOfflineQueue() {
        if (webView == null) return;
        webView.evaluateJavascript(
            "try{window.dispatchEvent(new Event('online'));if(window.juxingFlushOfflineQueue){window.juxingFlushOfflineQueue();}}catch(e){}",
            null
        );
    }

    private String readAssetText(String name) throws IOException {
        InputStream input = getAssets().open(name);
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        } finally {
            input.close();
        }
    }

    private boolean isOnline() {
        ConnectivityManager manager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (manager == null) return false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Network network = manager.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities capabilities = manager.getNetworkCapabilities(network);
            return capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        }

        NetworkInfo info = manager.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }

    private void registerNetworkWatcher() {
        ConnectivityManager manager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (manager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return;

        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                mainHandler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        flushOfflineQueue();
                        if (showingOffline) {
                            loadCloud();
                        }
                    }
                }, 800);
            }

            @Override
            public void onLost(Network network) {
                mainHandler.post(new Runnable() {
                    @Override
                    public void run() {
                        if (webView != null) {
                            webView.evaluateJavascript("try{window.dispatchEvent(new Event('offline'));}catch(e){}", null);
                        }
                    }
                });
            }
        };

        try {
            NetworkRequest request = new NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build();
            manager.registerNetworkCallback(request, networkCallback);
        } catch (RuntimeException error) {
            networkCallback = null;
        }
    }

    private void unregisterNetworkWatcher() {
        if (networkCallback == null) return;
        ConnectivityManager manager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (manager == null) return;

        try {
            manager.unregisterNetworkCallback(networkCallback);
        } catch (RuntimeException error) {
            // Callback may already be unregistered during process teardown.
        }
        networkCallback = null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            NOTIFICATION_CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("聊天消息、离线同步和系统提醒");
        channel.enableVibration(true);
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, NOTIFICATION_PERMISSION_REQUEST);
    }

    private boolean canPostNotifications() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private void showNotification(String title, String body, String tag) {
        if (!canPostNotifications()) {
            requestNotificationPermissionIfNeeded();
            return;
        }

        String safeTitle = title == null || title.trim().isEmpty() ? "聚星" : title.trim();
        String safeBody = body == null || body.trim().isEmpty() ? "你有一条新消息" : body.trim();
        String safeTag = tag == null || tag.trim().isEmpty() ? "juxing" : tag.trim();

        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, pendingFlags);

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
            : new Notification.Builder(this);
        builder
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(safeTitle)
            .setContentText(safeBody)
            .setStyle(new Notification.BigTextStyle().bigText(safeBody))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE | Notification.DEFAULT_LIGHTS)
            .setPriority(Notification.PRIORITY_HIGH)
            .setCategory(Notification.CATEGORY_MESSAGE);

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            int id = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
            manager.notify(safeTag, id, builder.build());
        }
    }

    public class JuxingAndroidBridge {
        @JavascriptInterface
        public void notify(String title, String body, String tag) {
            mainHandler.post(new Runnable() {
                @Override
                public void run() {
                    showNotification(title, body, tag);
                }
            });
        }

        @JavascriptInterface
        public boolean isOnline() {
            return MainActivity.this.isOnline();
        }

        @JavascriptInterface
        public void reloadCloud() {
            mainHandler.post(new Runnable() {
                @Override
                public void run() {
                    loadCloud();
                }
            });
        }

        @JavascriptInterface
        public void syncPending() {
            mainHandler.post(new Runnable() {
                @Override
                public void run() {
                    flushOfflineQueue();
                }
            });
        }
    }
}
