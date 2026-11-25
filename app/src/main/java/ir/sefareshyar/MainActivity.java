package ir.sefareshyar;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.ContactsContract;
import android.util.AtomicFile;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String HOST = "sefareshyar.local";
    private static final String ORIGIN = "https://" + HOST + "/";
    private WebView view;
    private ValueCallback<Uri[]> picker;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private File pending;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().getDecorView().setLayoutDirection(android.view.View.LAYOUT_DIRECTION_RTL);
        if (android.os.Build.VERSION.SDK_INT < 35) getWindow().setStatusBarColor(Color.rgb(44,55,111));
        view = new WebView(this);
        view.getSettings().setJavaScriptEnabled(true);
        view.getSettings().setDomStorageEnabled(true);
        view.getSettings().setAllowFileAccess(false);
        view.getSettings().setAllowContentAccess(true);
        view.getSettings().setTextZoom(Math.round(getResources().getConfiguration().fontScale * 100));
        view.addJavascriptInterface(new Bridge(), "Android");
        view.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                return !ORIGIN.equals(request.getUrl().toString());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                Uri uri = req.getUrl();
                if (!HOST.equals(uri.getHost())) return null;
                String path = uri.getLastPathSegment();
                if (path == null || path.isEmpty()) path = "index.html";
                String type;
                switch (path) {
                    case "index.html": type = "text/html"; break;
                    case "style.css": case "invoice.css": case "appearance.css": type = "text/css"; break;
                    case "core.js": case "app.js": case "files.js": case "presets.js": case "invoice.js": case "appearance.js": case "workspace.js": type = "application/javascript"; break;
                    case "vazirmatn.ttf": case "estedad.ttf": type = "font/ttf"; break;
                    case "brand-logo.svg": type = "image/svg+xml"; break;
                    case "brand-mascot.png": type = "image/png"; break;
                    default: return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
                }
                try {
                    return new WebResourceResponse(type, ("font/ttf".equals(type)||"image/png".equals(type))?null:"UTF-8", getAssets().open(path));
                } catch (Exception e) { return null; }
            }
        });
        view.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams p) {
                if (picker != null) picker.onReceiveValue(null);
                picker = callback;
                try { startActivityForResult(p.createIntent(), 31); }
                catch (Exception e) { picker.onReceiveValue(null); picker = null; message("انتخابگر فایل در دسترس نیست."); }
                return true;
            }
        });
        if (state != null && state.getString("pending") != null) pending = new File(state.getString("pending"));
        if (android.os.Build.VERSION.SDK_INT >= 35) {
            android.widget.FrameLayout root = new android.widget.FrameLayout(this);
            root.setBackgroundColor(Color.WHITE);
            root.addView(view,new android.widget.FrameLayout.LayoutParams(-1,-1));
            root.setOnApplyWindowInsetsListener((v,insets) -> {
                android.graphics.Insets padding=insets.getInsets(android.view.WindowInsets.Type.systemBars()
                    |android.view.WindowInsets.Type.displayCutout()|android.view.WindowInsets.Type.ime());
                v.setPadding(padding.left,padding.top,padding.right,padding.bottom);
                return android.view.WindowInsets.CONSUMED;
            });
            setContentView(root);
            android.view.WindowInsetsController controller=getWindow().getInsetsController();
            if(controller!=null){
                int flags=android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    |android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(flags,flags);
            }
        } else setContentView(view);
        view.loadUrl(ORIGIN);
        io.execute(this::purgeOldFiles);
    }

    @Override protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (pending != null) out.putString("pending", pending.getAbsolutePath());
    }

    @Override public void onBackPressed() {
        view.evaluateJavascript("(function(){if(typeof welcomeDialog!=='undefined'&&welcomeDialog){closeWelcome();return null;}const modal=document.querySelector('dialog[open]');if(modal){modal.close();return null;}return page==='home'||page==='setup';})()", result -> {
            if ("true".equals(result)) finish();
            else if ("false".equals(result)) view.evaluateJavascript("go('home')", null);
        });
    }

    private void purgeOldFiles() {
        File[] dirs = new File(getCacheDir(), "shared").listFiles();
        if (dirs == null) return;
        long cutoff = System.currentTimeMillis() - 48L * 60 * 60 * 1000;
        for (File dir : dirs) {
            if (dir.lastModified() >= cutoff) continue;
            File[] children = dir.listFiles();
            if (children != null) for (File child : children) child.delete();
            dir.delete();
        }
    }

    private File output(String name) throws Exception {
        File dir = new File(new File(getCacheDir(), "shared"), UUID.randomUUID().toString());
        if (!dir.mkdirs()) throw new IllegalStateException();
        String clean = name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "-");
        if (clean.length() > 130) clean = clean.substring(0, 100) + clean.substring(clean.length()-15);
        return new File(dir, clean);
    }

    private void message(String text) { runOnUiThread(() -> Toast.makeText(this, text, Toast.LENGTH_LONG).show()); }

    private void saveToPicker(File file, String type) {
        if (pending != null) { message("یک ذخیره‌سازی دیگر در حال انجام است."); return; }
        pending = file;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(type);
        intent.putExtra(Intent.EXTRA_TITLE, file.getName());
        try { startActivityForResult(intent, 32); }
        catch (Exception e) { pending = null; message("انتخاب محل ذخیره ممکن نبود."); }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 31 && picker != null) {
            picker.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            picker = null;
        }
        if (request == 33 && result == RESULT_OK && data != null && data.getData() != null) {
            String name = ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME;
            String number = ContactsContract.CommonDataKinds.Phone.NUMBER;
            try (android.database.Cursor c = getContentResolver().query(data.getData(),new String[]{name,number},null,null,null)) {
                if (c != null && c.moveToFirst()) view.evaluateJavascript(
                    "receiveContact("+org.json.JSONObject.quote(c.getString(0))+","+org.json.JSONObject.quote(c.getString(1))+")",null);
            } catch (Exception e) { message("خواندن مخاطب انتخاب‌شده ممکن نبود."); }
        }
        if (request == 32 && pending != null) {
            File file = pending;
            pending = null;
            if (result != RESULT_OK || data == null || data.getData() == null) { file.delete(); return; }
            Uri dest = data.getData();
            io.execute(() -> {
                try (InputStream in = new java.io.FileInputStream(file); OutputStream out = getContentResolver().openOutputStream(dest,"wt")) {
                    if (out == null) throw new IllegalStateException();
                    byte[] buffer = new byte[32768];
                    for (int read; (read = in.read(buffer)) != -1;) out.write(buffer,0,read);
                    message("فایل ذخیره شد.");
                } catch (Exception e) { message("ذخیرهٔ فایل انجام نشد. فضای آزاد و دسترسی را بررسی کنید."); }
                finally { file.delete(); }
            });
        }
    }

    private Uri uri(File file) {
        return new Uri.Builder().scheme("content").authority("ir.sefareshyar.files")
            .appendPath(file.getParentFile().getName()).appendPath(file.getName()).build();
    }

    private File archivedPdf(String data, String id, String paper) throws Exception {
        if (!id.matches("[a-zA-Z0-9-]{8,80}")) throw new IllegalArgumentException();
        File archive = new File(getFilesDir(), "invoices");
        if (!archive.isDirectory() && !archive.mkdirs()) throw new IllegalStateException();
        File file = new File(archive, id + ".pdf");
        if (file.isFile() && file.length() > 0) return file;
        File temp = new File(archive, id + ".temp");
        try {
            InvoicePdf.write(data, paper, temp);
            if (!temp.renameTo(file)) throw new IllegalStateException();
            return file;
        } finally { temp.delete(); }
    }

    private void deliverPdf(File pdf,String name,String paper,String mode) throws Exception {
        if ("save".equals(mode)) runOnUiThread(() -> saveToPicker(pdf,"application/pdf"));
        else if ("print".equals(mode)) runOnUiThread(() -> print(pdf,name,paper));
        else {
            ArrayList<Uri> uris = "image".equals(mode) ? images(pdf,name) : new ArrayList<>();
            if ("image".equals(mode)) pdf.delete(); else uris.add(uri(pdf));
            runOnUiThread(() -> share(uris,"image".equals(mode)?"image/png":"application/pdf"));
        }
    }

    private void share(ArrayList<Uri> files, String type) {
        if (files.isEmpty()) return;
        Intent send = new Intent(files.size()==1 ? Intent.ACTION_SEND : Intent.ACTION_SEND_MULTIPLE);
        send.setType(type);
        if (files.size()==1) send.putExtra(Intent.EXTRA_STREAM, files.get(0));
        else send.putParcelableArrayListExtra(Intent.EXTRA_STREAM, files);
        ClipData clip = ClipData.newUri(getContentResolver(), "سند فاکتورچین", files.get(0));
        for (int i=1;i<files.size();i++) clip.addItem(new ClipData.Item(files.get(i)));
        send.setClipData(clip);
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try { startActivity(Intent.createChooser(send,"ارسال سند")); }
        catch (Exception e) { message("برنامه‌ای برای ارسال این نوع فایل پیدا نشد."); }
    }

    private ArrayList<Uri> images(File pdf, String name) throws Exception {
        ArrayList<Uri> uris = new ArrayList<>();
        try (ParcelFileDescriptor fd = ParcelFileDescriptor.open(pdf, ParcelFileDescriptor.MODE_READ_ONLY);
             PdfRenderer renderer = new PdfRenderer(fd)) {
            for (int i=0; i<renderer.getPageCount(); i++) {
                try (PdfRenderer.Page page = renderer.openPage(i)) {
                    Bitmap image = Bitmap.createBitmap(page.getWidth()*2,page.getHeight()*2,Bitmap.Config.ARGB_8888);
                    try {
                        image.eraseColor(Color.WHITE);
                        page.render(image,null,null,PdfRenderer.Page.RENDER_MODE_FOR_PRINT);
                        File target = output(name+"-"+(i+1)+".png");
                        try (FileOutputStream out = new FileOutputStream(target)) {
                            if (!image.compress(Bitmap.CompressFormat.PNG,100,out)) throw new IllegalStateException();
                        }
                        uris.add(uri(target));
                    } finally { image.recycle(); }
                }
            }
        }
        return uris;
    }

    final class Bridge {
        private AtomicFile store(String key) {
            if (!key.matches("sefareshyar-v1(-draft|-recovery)?")) throw new IllegalArgumentException();
            return new AtomicFile(new File(getFilesDir(),key+".json"));
        }

        @JavascriptInterface public synchronized String readState(String key) {
            try { return new String(store(key).readFully(),StandardCharsets.UTF_8); }
            catch (java.io.FileNotFoundException e) { return null; }
            catch (Exception e) { return ""; }
        }

        @JavascriptInterface public synchronized boolean writeState(String key, String data) {
            try {
                AtomicFile file = store(key);
                FileOutputStream out = file.startWrite();
                try { out.write(data.getBytes(StandardCharsets.UTF_8)); file.finishWrite(out); }
                catch (Exception e) { file.failWrite(out); return false; }
                return true;
            } catch (Exception e) { return false; }
        }

        @JavascriptInterface public void pickContact() {
            runOnUiThread(() -> {
                try { startActivityForResult(new Intent(Intent.ACTION_PICK,ContactsContract.CommonDataKinds.Phone.CONTENT_URI),33); }
                catch (Exception e) { message("انتخابگر مخاطب روی این دستگاه در دسترس نیست."); }
            });
        }

        @JavascriptInterface public void save(String name, String type, String data) {
            io.execute(() -> {
                try {
                    if (data.length() > 42_000_000) throw new IllegalArgumentException();
                    File file = output(name);
                    try (FileOutputStream out = new FileOutputStream(file)) { out.write(Base64.decode(data,Base64.DEFAULT)); }
                    runOnUiThread(() -> saveToPicker(file,type));
                } catch (Exception e) { message("ساخت فایل انجام نشد."); }
            });
        }

        @JavascriptInterface public void document(String data, String name, String paper, String mode) {
            io.execute(() -> {
                try {
                    File file = output(name+".pdf");
                    InvoicePdf.write(data, paper, file);
                    deliverPdf(file,name,paper,mode);
                } catch (Exception e) { message("خروجی سند ساخته نشد. فضای ذخیره‌سازی را بررسی کنید."); }
            });
        }

        @JavascriptInterface public void archiveDocument(String data,String id,String paper) {
            io.execute(() -> {
                try { archivedPdf(data,id,paper); message("فاکتور و PDF ذخیره شدند."); }
                catch (Exception e) { message("فاکتور ذخیره شد. برای ساخت دوباره PDF، فاکتور را باز کنید."); }
            });
        }

        @JavascriptInterface public void storedDocument(String data,String name,String paper,String mode,String id) {
            io.execute(() -> {
                try {
                    File file=output(name+".pdf");
                    java.nio.file.Files.copy(archivedPdf(data,id,paper).toPath(),file.toPath());
                    deliverPdf(file,name,paper,mode);
                } catch (Exception e) { message("باز کردن PDF ممکن نبود. فضای ذخیره‌سازی را بررسی کنید."); }
            });
        }
    }

    private void print(File file, String name, String paper) {
        PrintManager manager = (PrintManager)getSystemService(PRINT_SERVICE);
        PrintAttributes.MediaSize media="A5".equals(paper)?PrintAttributes.MediaSize.ISO_A5:PrintAttributes.MediaSize.ISO_A4;
        try (PdfRenderer renderer=new PdfRenderer(ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY));
             PdfRenderer.Page first=renderer.openPage(0)) {
            if(first.getWidth()>first.getHeight())media=media.asLandscape();
            PrintAttributes attributes=new PrintAttributes.Builder().setMediaSize(media).build();
            manager.print(name,new PdfPrintAdapter(file,name,io),attributes);
        }
        catch (Exception e) { message("سرویس چاپ در دسترس نیست."); }
    }
}
