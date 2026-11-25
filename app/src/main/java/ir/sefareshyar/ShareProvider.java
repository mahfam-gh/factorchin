package ir.sefareshyar;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.List;

public class ShareProvider extends ContentProvider {
    @Override public boolean onCreate() { return true; }

    private File resolve(Uri uri) throws FileNotFoundException {
        List<String> parts = uri.getPathSegments();
        if (parts.size() != 2 || !parts.get(0).matches("[0-9a-f-]{36}")) throw new FileNotFoundException();
        try {
            File root = new File(getContext().getCacheDir(), "shared").getCanonicalFile();
            File directory = new File(root, parts.get(0)).getCanonicalFile();
            File file = new File(directory, parts.get(1)).getCanonicalFile();
            if (!root.equals(directory.getParentFile()) || !directory.equals(file.getParentFile()) || !file.isFile()) {
                throw new FileNotFoundException();
            }
            return file;
        } catch (IOException e) { throw new FileNotFoundException(); }
    }

    @Override public String getType(Uri uri) {
        return uri.getLastPathSegment().endsWith(".png") ? "image/png" : "application/pdf";
    }

    @Override public Cursor query(Uri uri, String[] columns, String selection, String[] args, String sort) {
        if (columns == null) columns = new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor cursor = new MatrixCursor(columns);
        try {
            File file = resolve(uri);
            Object[] values = new Object[columns.length];
            for (int i = 0; i < columns.length; i++) {
                if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) values[i] = file.getName();
                if (OpenableColumns.SIZE.equals(columns[i])) values[i] = file.length();
            }
            cursor.addRow(values);
        } catch (FileNotFoundException ignored) {}
        return cursor;
    }

    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new FileNotFoundException();
        return ParcelFileDescriptor.open(resolve(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String selection, String[] args) { throw new UnsupportedOperationException(); }
}
