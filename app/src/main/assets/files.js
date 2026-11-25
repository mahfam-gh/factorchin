'use strict';
const enc=new TextEncoder();
const xml=v=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const crcTable=Uint32Array.from({length:256},(_,i)=>{for(let n=0;n<8;n++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i;});
function zip(files){
 const local=[],central=[];let offset=0,total=0,count=0;
 for(const [name,text] of Object.entries(files)){
   const a=enc.encode(name),data=enc.encode(text);let crc=0xffffffff;
   for(const b of data)crc=crcTable[(crc^b)&255]^(crc>>>8);
   crc=(crc^0xffffffff)>>>0;
   const h=new Uint8Array(30+a.length),c=new Uint8Array(46+a.length),v=new DataView(h.buffer),d=new DataView(c.buffer);
   v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);
   v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,a.length,true);h.set(a,30);
   d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(14,33,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,a.length,true);d.setUint32(42,offset,true);c.set(a,46);
   local.push(h,data);central.push(c);offset+=h.length+data.length;total+=c.length;count++;
 }
 const end=new Uint8Array(22), e=new DataView(end.buffer);
 e.setUint32(0,0x06054b50,true);e.setUint16(8,count,true);e.setUint16(10,count,true);e.setUint32(12,total,true);e.setUint32(16,offset,true);
 const result=new Uint8Array(offset+total+22);let pos=0;
 for(const block of [...local,...central,end]){result.set(block,pos);pos+=block.length;}
 return result;
}
function workbook(sheets){
 const doc='http://schemas.openxmlformats.org/officeDocument/2006/relationships', rel='http://schemas.openxmlformats.org/package/2006/relationships', main='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const files={
 '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>',
 '_rels/.rels':'<Relationships xmlns="'+rel+'"><Relationship Id="rId1" Type="'+doc+'/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':'<workbook xmlns="'+main+'" xmlns:r="'+doc+'"><sheets>'+sheets.map(([name],i)=>'<sheet name="'+xml(name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>',
 'xl/_rels/workbook.xml.rels':'<Relationships xmlns="'+rel+'">'+sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+doc+'/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'</Relationships>'
 };
 sheets.forEach(([,rows],i)=>{
   files['xl/worksheets/sheet'+(i+1)+'.xml']='<worksheet xmlns="'+main+'"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews><sheetData>'+rows.map(r=>'<row>'+r.map(c=>typeof c==='number'?'<c><v>'+c+'</v></c>':'<c t="inlineStr"><is><t xml:space="preserve">'+xml(c)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';
 });
 return zip(files);
}
function bytes64(array){
 let data='';for(let i=0;i<array.length;i+=8192)data+=String.fromCharCode(...array.subarray(i,i+8192));return btoa(data);
}
const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function saveFile(name,mime,bytes){
 if(window.Android)return Android.save(name,mime,bytes64(bytes));
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:mime}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
const xlsx='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function exportAll(f){
 const cols=[['نام','name'],['شخص رابط','contact'],['برچسب','tag'],['ثبت','created']];
 if(f.elements.phone.checked)cols.push(['تلفن','phone'],['تلفن دوم','phone2']);
 if(f.elements.address.checked)cols.push(['نشانی','address']);
 if(f.elements.location.checked)cols.push(['استان','province'],['شهر','city'],['محله','district'],['کد پستی','postal']);
 const rows=[cols.map(x=>x[0]),...db.customers.map(c=>cols.map(([,k])=>k==='address'?c.addresses.map(a=>a.label+' · '+a.value).join(' | '):k==='created'?Core.day(c[k]):c[k]||''))];
 saveFile('مشتریان.xlsx',xlsx,workbook([['مشتریان',rows]]));
}
function exportCustomer(id){
 safe(()=>{
  const c=customer(id),os=db.orders.filter(o=>o.cid===id);
  const meta=[['عنوان','مقدار'],['نام',c.name],['موبایل',c.phone],['تولد',Core.day(c.birthday)],['کد پستی',c.postal],...customerFields.filter(([,k])=>k!=='postal').map(([l,k])=>[l,c[k]]),...c.addresses.map(a=>[a.label,a.value]),['مانده (ریال)',os.filter(o=>o.status!=='لغوشده').reduce((s,o)=>s+Core.totals(o).total-Core.paid(o),0)]];
  const orders=[['شماره','ثبت','تحویل','وضعیت','جمع (ریال)','مانده (ریال)'],...os.map(o=>{const t=Core.totals(o).total;return [o.number,Core.day(o.on),Core.day(o.due),o.status,t,t-Core.paid(o)];})];
  const docs=[['شماره','نوع','تاریخ','مبلغ (ریال)'],...db.docs.filter(d=>os.some(o=>o.id===d.orderId)).map(d=>[d.number,d.type,Core.day(d.on),d.payment?.amount??d.summary.total])];
  const payments=[['سفارش','تاریخ','مبلغ (ریال)','روش','پیگیری','ابطال'],...os.flatMap(o=>o.payments.map(p=>[o.number,Core.day(p.on),p.amount,p.method,p.reference,p.void?'بله':'خیر']))];
  saveFile('پرونده-'+c.name.replace(/[\\/:*?"<>|]/g,'-')+'.xlsx',xlsx,workbook([['مشخصات',meta],['سفارش‌ها',orders],['اسناد',docs],['پرداخت‌ها',payments]]));
 });
}
async function backupKey(password,salt){
 if(!crypto.subtle)throw Error('رمزنگاری در این محیط در دسترس نیست.');
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function packBackup(data,password){
 const json=JSON.stringify(data);
 if(!password)return enc.encode(JSON.stringify({format:'sefareshyar-1',data}));
 const salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
 const sealed=await crypto.subtle.encrypt({name:'AES-GCM',iv},await backupKey(password,salt),enc.encode(json));
 return enc.encode(JSON.stringify({format:'sefareshyar-1',salt:bytes64(salt),iv:bytes64(iv),cipher:bytes64(new Uint8Array(sealed))}));
}
async function unpackBackup(text,password){
 let envelope;
 try{envelope=JSON.parse(text);}catch{throw Error('فایل پشتیبان خوانده نشد.');}
 if(envelope?.format!=='sefareshyar-1')throw Error('نسخهٔ فایل پشتیبان پشتیبانی نمی‌شود.');
 if(envelope.cipher){
   try{
     const salt=un64(envelope.salt),iv=un64(envelope.iv);
     if(salt.length!==16||iv.length!==12||!password)throw Error();
     const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv},await backupKey(password,salt),un64(envelope.cipher));
     envelope.data=JSON.parse(new TextDecoder().decode(clear));
   }catch{throw Error('گذرواژه اشتباه است یا فایل آسیب دیده است.');}
 }
 return Core.backupShape(envelope.data);
}
async function exportBackup(f){
 const pass=String(new FormData(f).get('password')||'');
 saveFile('فاکتورچین-'+iranToday()+'.sybackup','application/json',await packBackup(db,pass));
}
async function checkRestore(f){
 stagedBackup=null;
 const file=f.elements.file.files[0];
 if(!file||file.size>30*1024*1024)throw Error('فایل مناسب و کوچک‌تر از ۳۰ مگابایت انتخاب کنید.');
 stagedBackup=await unpackBackup(await file.text(),String(new FormData(f).get('password')||''));
 const n=stagedBackup;
 document.querySelector('#restore-info').innerHTML=card(fmt(n.customers.length)+' مشتری، '+fmt(n.orders.length)+' سفارش، '+fmt(n.docs.length)+' سند'+row(action('جایگزینی داده‌ها','restoreBackup()','danger')));
}
async function restoreBackup(){
 const n=stagedBackup;
 if(!n||!confirm('داده‌های فعلی و پیش‌نویس جایگزین شوند؟ نسخهٔ ایمنی در حافظهٔ داخلی برنامه نگه داشته می‌شود.'))return;
 try{
   state.set(key+'-recovery',JSON.stringify({format:'sefareshyar-1',data:{...db,draft}}));
   const restored={...n,draft:null};
   state.set(key,JSON.stringify(restored));
   db=restored;draft=null;if(typeof billDraft!=='undefined')billDraft=db.invoiceDraft||null;stagedBackup=null;go('home');notice('بازیابی انجام شد.');
 }catch{notice('جایگزینی انجام نشد. فضای ذخیره‌سازی را بررسی کنید.');}
}
if(typeof module!=='undefined')module.exports={workbook,packBackup,unpackBackup};
