package ir.sefareshyar;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextDirectionHeuristics;
import android.text.TextPaint;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;

final class InvoicePdf {
    private static final int MARGIN = 34;
    private final PdfDocument pdf = new PdfDocument();
    private final int width, height, inner;
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private PdfDocument.Page page;
    private Canvas canvas;
    private int pageNo, y, accent = Color.rgb(9,107,96);
    private String design = "";
    private boolean currentTable;

    private int onAccent() {
        double brightness = Color.red(accent)*.299 + Color.green(accent)*.587 + Color.blue(accent)*.114;
        return brightness > 155 ? Color.BLACK : Color.WHITE;
    }

    private InvoicePdf(String paper, boolean landscape) {
        int shortSide = "A5".equals(paper) ? 420 : 595;
        int longSide = "A5".equals(paper) ? 595 : 842;
        width = landscape ? longSide : shortSide;
        height = landscape ? shortSide : longSide;
        inner = width - 2*MARGIN;
    }

    static void write(String json, String paper, File output) throws Exception {
        JSONObject invoice = new JSONObject(json);
        InvoicePdf writer = new InvoicePdf(paper,"formal".equals(invoice.optString("design")));
        try {
            writer.draw(invoice);
            writer.endPage();
            try (FileOutputStream out = new FileOutputStream(output)) { writer.pdf.writeTo(out); }
        } finally {
            writer.endPage();
            writer.pdf.close();
        }
    }

    private void startPage() {
        if (page != null) endPage();
        page = pdf.startPage(new PdfDocument.PageInfo.Builder(width,height,++pageNo).create());
        canvas = page.getCanvas();
        canvas.drawColor(Color.WHITE);
        fill.setColor(accent);
        if ("studio".equals(design)) canvas.drawRect(width-MARGIN-68,16,width-MARGIN,20,fill);
        else if ("edge".equals(design)) canvas.drawRect(width-10,0,width,height,fill);
        else if ("formal".equals(design)) {
            canvas.drawRect(MARGIN-8,MARGIN-9,width-MARGIN+8,MARGIN-6,fill);
            fill.setColor(Color.BLACK);
            canvas.drawLine(MARGIN-8,MARGIN-6,MARGIN-8,height-MARGIN+8,fill);
            canvas.drawLine(width-MARGIN+8,MARGIN-6,width-MARGIN+8,height-MARGIN+8,fill);
            canvas.drawLine(MARGIN-8,height-MARGIN+8,width-MARGIN+8,height-MARGIN+8,fill);
        } else if (!design.isEmpty()) canvas.drawRect(0,0,width,"band".equals(design)?15:5,fill);
        y = MARGIN;
    }

    private void endPage() {
        if (page == null) return;
        TextPaint p = style(9,false,Color.DKGRAY);
        canvas.drawText(Integer.toString(pageNo),MARGIN,height-16,p);
        pdf.finishPage(page);
        page = null;
    }

    private TextPaint style(int size, boolean bold, int color) {
        TextPaint p = new TextPaint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
        p.setTypeface(Typeface.create("sans-serif",bold?Typeface.BOLD:Typeface.NORMAL));
        p.setTextSize(size);
        p.setColor(color);
        return p;
    }

    private StaticLayout layout(String text,int w,int size,boolean bold,int color) {
        return StaticLayout.Builder.obtain(text,0,text.length(),style(size,bold,color),w)
            .setTextDirection(TextDirectionHeuristics.RTL).setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .setIncludePad(false).setLineSpacing(2,1).build();
    }

    private void paint(StaticLayout text,int x,int top) {
        canvas.save();
        canvas.translate(x,top);
        text.draw(canvas);
        canvas.restore();
    }

    private void text(String value,int size,boolean bold,int color) {
        if (value.isEmpty()) return;
        StaticLayout layout = layout(value,inner,size,bold,color);
        for (int line=0;line<layout.getLineCount();line++) {
            int first = layout.getLineTop(line), lineHeight = layout.getLineBottom(line)-first;
            if (y+lineHeight > height-MARGIN) startPage();
            canvas.save();
            canvas.clipRect(MARGIN,y,MARGIN+inner,y+lineHeight);
            paint(layout,MARGIN,y-first);
            canvas.restore();
            y += lineHeight;
        }
        y += 6;
    }

    private void image(String data,boolean right) {
        if (!data.startsWith("data:image/") || !data.contains(";base64,")) return;
        try {
            byte[] bytes = Base64.decode(data.substring(data.indexOf(',')+1),Base64.DEFAULT);
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes,0,bytes.length,bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return;
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = Math.max(1,Math.max(bounds.outWidth,bounds.outHeight)/400);
            Bitmap b = BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);
            if (b == null) return;
            float scale = Math.min(100f/b.getWidth(),64f/b.getHeight());
            float w = b.getWidth()*scale, h = b.getHeight()*scale;
            if (y+h+6>height-MARGIN) startPage();
            float x = right ? width-MARGIN-w : MARGIN;
            fill.setFilterBitmap(true);
            canvas.drawBitmap(b,null,new RectF(x,y,x+w,y+h),fill);
            b.recycle();
            y += (int)Math.ceil(h)+8;
        } catch (IllegalArgumentException ignored) {}
    }

    private void lines(JSONArray lines) {
        for(int i=0;i<lines.length();i++) text(lines.optString(i),11,false,Color.BLACK);
    }

    private int[] columns() {
        if ("studio".equals(design)) {
            int index=inner*8/100, product=inner*36/100, qty=inner*14/100, rate=inner*20/100;
            return new int[]{index,product,qty,rate,inner-index-product-qty-rate};
        }
        if ("formal".equals(design)) {
            if(currentTable){
                int[] columns={inner*7/100,inner*12/100,inner*33/100,inner*12/100,inner*18/100,0};
                columns[5]=inner;
                for(int i=0;i<5;i++)columns[5]-=columns[i];
                return columns;
            }
            int[] columns={inner*7/100,inner*12/100,inner*25/100,inner*10/100,inner*14/100,inner*14/100,0};
            columns[6]=inner;
            for(int i=0;i<6;i++) columns[6]-=columns[i];
            return columns;
        }
        return new int[]{inner*38/100,inner*15/100,inner*23/100,inner-(inner*38/100+inner*15/100+inner*23/100)};
    }

    private void tableRow(JSONArray row,boolean title,JSONArray header, String label) {
        int[] widths = columns();
        StaticLayout[] cells = new StaticLayout[widths.length];
        int maxLines = 0;
        for (int c=0;c<widths.length;c++) {
            cells[c] = layout(row.optString(c),widths[c]-10,10,title,
                title&&!"line".equals(design)&&!"formal".equals(design)?onAccent():Color.BLACK);
            maxLines = Math.max(maxLines,cells[c].getLineCount());
        }
        int blockHeight = 10;
        for (StaticLayout cell : cells) blockHeight = Math.max(blockHeight,cell.getHeight()+10);
        if (!title && blockHeight <= height-2*MARGIN-70 && y+blockHeight > height-MARGIN) {
            continuation(header,label);
        }
        if (title && !"line".equals(design)) {
            fill.setColor("formal".equals(design)?Color.rgb(243,245,243):accent);
            canvas.drawRect(MARGIN,y,width-MARGIN,y+blockHeight,fill);
        } else if (title) {
            fill.setColor(accent);
            canvas.drawLine(MARGIN,y+blockHeight,width-MARGIN,y+blockHeight,fill);
        } else if ("grid".equals(design)) {
            fill.setColor(Color.rgb(242,246,244));
            canvas.drawRect(MARGIN,y,width-MARGIN,Math.min(height-MARGIN,y+blockHeight),fill);
        }
        int rowTop=y;
        for (int i=0;i<maxLines;i++) {
            int lineHeight = 0;
            for (StaticLayout cell : cells) if (i<cell.getLineCount()) lineHeight = Math.max(lineHeight,cell.getLineBottom(i)-cell.getLineTop(i));
            if (!title && y+lineHeight+6>height-MARGIN) {
                if("formal".equals(design) && y>rowTop) formalBorders(rowTop,y,widths);
                continuation(header,label);
                rowTop=y;
            }
            if (i==0) y+=5;
            int right = width-MARGIN;
            for (int c=0;c<cells.length;c++) {
                right -= widths[c];
                StaticLayout cell = cells[c];
                if (i>=cell.getLineCount()) continue;
                canvas.save();
                canvas.clipRect(right+4,y,right+widths[c]-4,y+lineHeight);
                paint(cell,right+5,y-cell.getLineTop(i));
                canvas.restore();
            }
            y+=lineHeight;
        }
        y+=5;
        if ("formal".equals(design)) formalBorders(rowTop,y,widths);
        else if (!title) {
            fill.setColor(Color.rgb(205,220,215));
            canvas.drawLine(MARGIN,y,width-MARGIN,y,fill);
        }
    }

    private void formalBorders(int top,int bottom,int[] widths) {
        fill.setColor(Color.BLACK);
        canvas.drawLine(MARGIN,top,width-MARGIN,top,fill);
        canvas.drawLine(MARGIN,bottom,width-MARGIN,bottom,fill);
        int x=width-MARGIN;
        canvas.drawLine(x,top,x,bottom,fill);
        for(int col:widths){x-=col;canvas.drawLine(x,top,x,bottom,fill);}
    }

    private void center(String value,int size,boolean bold,int x,int top,int available) {
        TextPaint text=style(size,bold,Color.BLACK);
        StaticLayout centered=StaticLayout.Builder.obtain(value,0,value.length(),text,available)
            .setTextDirection(TextDirectionHeuristics.RTL).setAlignment(Layout.Alignment.ALIGN_CENTER).build();
        paint(centered,x,top);
    }

    private int columnText(JSONArray values,int x,int w,int top) {
        for(int i=0;i<values.length();i++){
            String value=values.optString(i);
            if(value.isEmpty())continue;
            StaticLayout line=layout(value,w,10,false,Color.BLACK);
            if(top+line.getHeight()>height-MARGIN)break;
            paint(line,x,top);top+=line.getHeight()+3;
        }
        return top;
    }

    private void drawFormal(JSONObject obj) throws Exception {
        startPage();
        int top=y;
        image(obj.optString("logo"),!currentTable);
        int logoEnd=y;
        String store=obj.getString("shop");
        int offset=logoEnd>top?110:0;
        StaticLayout brand=layout(store,inner-offset,17,true,Color.BLACK);
        int brandX=MARGIN+(currentTable?offset:0);
        paint(brand,brandX,top);
        int storeEnd=columnText(obj.getJSONArray("shopLines"),brandX,inner-offset,top+brand.getHeight()+4);
        y=Math.max(logoEnd,storeEnd)+5;
        if(y+80>height-MARGIN)startPage();
        center(obj.getString("title"),21,true,MARGIN,y,inner);
        y+=34;
        int buyerWidth=inner*58/100;
        y=Math.max(columnText(obj.getJSONArray("buyer"),width-MARGIN-buyerWidth,buyerWidth,y),
            columnText(obj.getJSONArray("meta"),MARGIN,inner-buyerWidth-16,y))+14;
        JSONArray rows=obj.getJSONArray("rows"), header=obj.getJSONArray("headers");
        String label=obj.getString("title")+" · "+obj.getString("number");
        if(y+59>height-MARGIN)startPage();
        tableRow(header,true,header,label);
        for(int i=0;i<rows.length();i++)tableRow(rows.getJSONArray(i),false,header,label);
        JSONArray totals=obj.getJSONArray("formalTotals");
        y+=13;
        int tableWidth=inner*65/100, rightWidth=tableWidth*43/100, start=(width-tableWidth)/2;
        for(int i=0;i<totals.length();i++){
            JSONArray pair=totals.getJSONArray(i);
            StaticLayout key=layout(pair.getString(0),rightWidth-12,11,true,Color.BLACK);
            StaticLayout value=layout(pair.getString(1),tableWidth-rightWidth-12,11,false,Color.BLACK);
            int rowHeight=Math.max(key.getHeight(),value.getHeight())+11;
            if(y+rowHeight>height-MARGIN)startPage();
            fill.setColor(Color.rgb(243,245,243));
            canvas.drawRect(start+tableWidth-rightWidth,y,start+tableWidth,y+rowHeight,fill);
            fill.setColor(Color.BLACK);
            canvas.drawLine(start,y,start+tableWidth,y,fill);
            canvas.drawLine(start,y+rowHeight,start+tableWidth,y+rowHeight,fill);
            for(int edge:new int[]{start,start+tableWidth-rightWidth,start+tableWidth})canvas.drawLine(edge,y,edge,y+rowHeight,fill);
            paint(key,start+tableWidth-rightWidth+6,y+5);
            paint(value,start+6,y+5);
            y+=rowHeight;
        }
        y+=14;
        if(!obj.optString("note").isEmpty())text("توضیحات  "+obj.optString("note"),11,false,Color.BLACK);
        if(y+69>height-MARGIN)startPage();
        center("امضای فروشنده",11,true,width/2,y+8,inner/2);
        center("امضای خریدار",11,true,MARGIN,y+8,inner/2);
        y+=40;
        JSONArray barcode=obj.optJSONArray("barcode");
        if(barcode==null||barcode.length()==0)return;
        int modules=0;
        for(int i=0;i<barcode.length();i++)modules+=barcode.optInt(i);
        if(modules<=0)return;
        float size=Math.min(2f,(float)inner/modules);
        float x=(width-modules*size)/2;
        fill.setColor(Color.BLACK);
        for(int i=0;i<barcode.length();i++){
            float bar=barcode.optInt(i)*size;
            if(i%2==0)canvas.drawRect(x,y,x+bar,y+22,fill);
            x+=bar;
        }
    }

    private int contactGroup(String heading,JSONArray entries,int x,int available,int top,int ink) {
        paint(layout(heading,available,11,true,ink),x,top);
        return columnText(entries,x,available,top+19);
    }

    private void drawStudio(JSONObject obj) throws Exception {
        startPage();
        int ink=onAccent()==Color.BLACK?Color.DKGRAY:accent;
        image(obj.optString("logo"),true);
        text(obj.getString("title"),26,true,ink);
        JSONArray meta=obj.getJSONArray("meta");
        String label=meta.optString(0)+"  ·  "+meta.optString(1);
        text(label,11,false,Color.DKGRAY);
        text(meta.optString(2),9,false,Color.DKGRAY);
        int gap=20, half=(inner-gap)/2;
        int seller=contactGroup("فروشنده",obj.getJSONArray("seller"),width-MARGIN-half,half,y,ink);
        int buyer=contactGroup("خریدار",obj.getJSONArray("buyer"),MARGIN,half,y,ink);
        y=Math.max(seller,buyer)+12;
        lines(obj.getJSONArray("extras"));
        JSONArray rows=obj.getJSONArray("rows"), headers=obj.getJSONArray("headers");
        if(y+55>height-MARGIN)startPage();
        tableRow(headers,true,headers,label);
        for(int i=0;i<rows.length();i++)tableRow(rows.getJSONArray(i),false,headers,label);
        JSONArray adjustments=obj.getJSONArray("adjustments");
        if(y+130>height-MARGIN)startPage();
        y+=13;
        for(int i=0;i<adjustments.length();i++){
            JSONArray pair=adjustments.getJSONArray(i);
            text(pair.getString(0)+"  ·  "+pair.getString(1),11,false,Color.DKGRAY);
        }
        text("مبلغ قابل پرداخت",11,true,ink);
        text(obj.getString("balance"),19,true,ink);
        text(obj.getString("words"),10,false,Color.DKGRAY);
        if(!obj.optString("note").isEmpty()){
            y+=8;text("توضیحات",11,true,ink);text(obj.getString("note"),11,false,Color.BLACK);
        }
        if(y+58>height-MARGIN)startPage();
        y+=20;
        fill.setColor(Color.GRAY);
        canvas.drawLine(MARGIN+10,y,MARGIN+half-10,y,fill);
        canvas.drawLine(width-MARGIN-half+10,y,width-MARGIN-10,y,fill);
        center("تأیید فروشنده",10,true,width-MARGIN-half,y+5,half);
        center("تأیید خریدار",10,true,MARGIN,y+5,half);
    }

    private void continuation(JSONArray header,String label) {
        startPage();
        text(label,11,true,accent);
        tableRow(header,true,header,label);
    }

    private void draw(JSONObject obj) throws Exception {
        try { accent = Color.parseColor(obj.optString("color")); } catch (IllegalArgumentException ignored) {}
        design = obj.optString("design");
        currentTable=obj.optInt("tableRevision")==2;
        if("studio".equals(design)){drawStudio(obj);return;}
        if("formal".equals(design)){drawFormal(obj);return;}
        startPage();
        image(obj.optString("logo"),obj.optBoolean("logoRight"));
        int ink = onAccent()==Color.BLACK ? Color.DKGRAY : accent;
        text(obj.getString("shop"),20,true,ink);
        lines(obj.getJSONArray("shopLines"));
        String label = obj.getString("title")+" · "+obj.getString("number");
        text(label,17,true,ink);
        lines(obj.getJSONArray("body"));
        JSONArray rows = obj.getJSONArray("rows");
        JSONArray header = new JSONArray().put(obj.optString("column","شرح")).put("تعداد").put("قیمت واحد").put("جمع");
        if (rows.length()>0 && obj.optBoolean("table")) {
            if (y+60>height-MARGIN) startPage();
            tableRow(header,true,header,label);
            for (int i=0;i<rows.length();i++) tableRow(rows.getJSONArray(i),false,header,label);
        } else {
            for (int i=0;i<rows.length();i++) {
                JSONArray row=rows.getJSONArray(i);
                text(row.optString(0)+" · "+row.optString(1)+" × "+row.optString(2)+" · "+row.optString(3),11,false,Color.BLACK);
            }
        }
        if (y+110>height-MARGIN && obj.getJSONArray("summary").length()>0) startPage();
        y += 12;
        JSONArray summary=obj.getJSONArray("summary");
        for (int i=0;i<summary.length();i++) text(summary.optString(i),i==summary.length()-1?14:11,true,ink);
        lines(obj.getJSONArray("footer"));
        image(obj.optString("stamp"),false);
    }
}
