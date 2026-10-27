package in.smartfleet.depot;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.widget.EditText;
import java.io.IOException;
import java.util.Locale;
import android.speech.tts.TextToSpeech;

public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private WebView web;
    private TextToSpeech speech;
    private volatile boolean speechReady=false;
    private PermissionRequest cameraRequest;
    private ValueCallback<Uri[]> fileResult;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        speech=new TextToSpeech(this,status -> speechReady=status==TextToSpeech.SUCCESS);
        web = new WebView(this); setContentView(web);
        // Android 15+ edge-to-edge: keep controls clear of status/navigation bars.
        web.setOnApplyWindowInsetsListener((view, insets) -> { view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom()); return insets; });
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings=web.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(true); settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(BuildConfig.DEBUG ? WebSettings.MIXED_CONTENT_ALWAYS_ALLOW : WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface public boolean speak(String text,String language) {
                if(!speechReady||text==null||text.length()>2000||!("kn-IN".equals(language)||"hi-IN".equals(language)||"en-IN".equals(language)))return false;
                int supported=speech.setLanguage(Locale.forLanguageTag(language));
                if(supported<0)return false;
                speech.speak(text,TextToSpeech.QUEUE_FLUSH,null,"fleet-guidance");return true;
            }
            @JavascriptInterface public void stopSpeaking() { if(speech!=null)speech.stop(); }
            @JavascriptInterface public String role() { return BuildConfig.WORK_ROLE; }
            @JavascriptInterface public String serverURL() { return getPreferences(MODE_PRIVATE).getString("server",BuildConfig.SERVER_URL); }
            @JavascriptInterface public void configureServer() { runOnUiThread(() -> showSettings()); }
        }, "FleetAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri=request.getUrl();
                if (!"https".equals(uri.getScheme()) || !"appassets.androidplatform.net".equals(uri.getHost())) return null;
                String path=uri.getPath(); if(path==null || !path.startsWith("/assets/") || path.contains("..")) return new WebResourceResponse("text/plain","UTF-8",null);
                String file=path.substring(8),mime="text/plain";
                if(file.endsWith(".html")) mime="text/html"; else if(file.endsWith(".js")) mime="application/javascript"; else if(file.endsWith(".css")) mime="text/css"; else if(file.endsWith(".json")) mime="application/json"; else if(file.endsWith(".png")) mime="image/png"; else if(file.endsWith(".svg")) mime="image/svg+xml";
                try { return new WebResourceResponse(mime,"UTF-8",getAssets().open(file)); } catch(IOException error) { return new WebResourceResponse("text/plain","UTF-8",404,"Not found",null,null); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri=request.getUrl();
                return !"https".equals(uri.getScheme()) || !"appassets.androidplatform.net".equals(uri.getHost());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    if(!"https".equals(request.getOrigin().getScheme()) || !"appassets.androidplatform.net".equals(request.getOrigin().getHost())){request.deny();return;}
                    boolean video=false; for(String resource:request.getResources()) if(PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) video=true;
                    if(!video){request.deny();return;}
                    if(checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED) request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    else { if(cameraRequest!=null)cameraRequest.deny();cameraRequest=request;requestPermissions(new String[]{Manifest.permission.CAMERA},10); }
                });
            }
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> result,FileChooserParams params){
                if(fileResult!=null)fileResult.onReceiveValue(null);fileResult=result;
                Intent picker=new Intent(Intent.ACTION_OPEN_DOCUMENT);picker.setType("image/*");picker.addCategory(Intent.CATEGORY_OPENABLE);
                try{startActivityForResult(picker,11);}catch(Exception error){fileResult.onReceiveValue(null);fileResult=null;}return true;
            }
        });
        web.loadUrl(ORIGIN+"/assets/index.html?app="+BuildConfig.WORK_ROLE);
    }
    private void showSettings(){
        EditText input=new EditText(this);input.setSingleLine(true);input.setHint("https://fleet.your-company.com");input.setText(getPreferences(MODE_PRIVATE).getString("server",""));
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Depot server / ಡಿಪೋ ಸರ್ವರ್ / डिपो सर्वर").setMessage("Enter the server address provided by your depot manager.").setView(input).setPositiveButton("Save",null).setNegativeButton("Cancel",null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String value=input.getText().toString().trim().replaceAll("/+$","");Uri uri=Uri.parse(value);
            if(!"https".equals(uri.getScheme()) && !(BuildConfig.DEBUG && "http".equals(uri.getScheme())) || uri.getHost()==null || uri.getUserInfo()!=null || uri.getQuery()!=null || uri.getFragment()!=null){input.setError("Enter a valid HTTPS server address");return;}
            getPreferences(MODE_PRIVATE).edit().putString("server",value).apply();dialog.dismiss();
            // Changing servers ends the current session and removes the old server's cache.
            web.evaluateJavascript("sessionStorage.clear();localStorage.clear();location.href='index.html?app="+BuildConfig.WORK_ROLE+"'",null);
        }));dialog.show();
    }
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){super.onRequestPermissionsResult(code,permissions,results);if(code==10&&cameraRequest!=null){if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)cameraRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});else cameraRequest.deny();cameraRequest=null;}}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==11&&fileResult!=null){fileResult.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);fileResult=null;}}
    @Override public void onBackPressed(){web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return true;}if(document.querySelector('.scan-overlay')){closeScanner();return true;}return false;})()",value->{if(!"true".equals(value)){if(web.canGoBack())web.goBack();else finish();}});}
    @Override protected void onDestroy(){if(cameraRequest!=null)cameraRequest.deny();if(speech!=null){speech.stop();speech.shutdown();}if(web!=null){web.removeJavascriptInterface("FleetAndroid");web.destroy();}super.onDestroy();}
}
