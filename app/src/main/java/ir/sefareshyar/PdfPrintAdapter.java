package ir.sefareshyar;

import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.graphics.pdf.PdfRenderer;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;
import java.util.concurrent.Executor;

final class PdfPrintAdapter extends PrintDocumentAdapter {
    private final File file;
    private final String title;
    private final Executor executor;

    PdfPrintAdapter(File file,String title,Executor executor) {
        this.file=file;
        this.title=title;
        this.executor=executor;
    }

    @Override public void onLayout(PrintAttributes old,PrintAttributes next,CancellationSignal signal,LayoutResultCallback cb,android.os.Bundle extra) {
        if (signal.isCanceled()) { cb.onLayoutCancelled(); return; }
        try (PdfRenderer renderer=new PdfRenderer(ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY))) {
            cb.onLayoutFinished(new PrintDocumentInfo.Builder(title+".pdf").setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                .setPageCount(renderer.getPageCount()).build(),!next.equals(old));
        } catch (Exception e) { cb.onLayoutFailed("خواندن سند ممکن نبود."); }
    }

    @Override public void onWrite(PageRange[] pages,ParcelFileDescriptor destination,CancellationSignal signal,WriteResultCallback cb) {
        executor.execute(() -> {
            try (FileInputStream in=new FileInputStream(file);OutputStream out=new ParcelFileDescriptor.AutoCloseOutputStream(destination)) {
                byte[] bytes=new byte[32768];
                for (int n; !signal.isCanceled() && (n=in.read(bytes))!=-1;) out.write(bytes,0,n);
                if (signal.isCanceled()) cb.onWriteCancelled();
                else cb.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
            } catch (Exception e) { cb.onWriteFailed("نوشتن سند چاپ ممکن نبود."); }
        });
    }
}
