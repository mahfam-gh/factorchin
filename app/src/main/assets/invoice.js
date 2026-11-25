'use strict';

let billDraft=db.invoiceDraft||null, billGroup='همه', billSearch='';
const oldRender=render;
const invoiceName=d=>d.customer.name;
const numberText=n=>fmt(n);
const presetFor=id=>invoicePresets.find(x=>x.id===id)||invoicePresets[0];
const billCopy=v=>JSON.parse(JSON.stringify(v));
const amountInput=v=>typeof v==='string'?v:displayAmount(v,billDraft.unit);
const deliveryOptions=['پیک','پست','حضوری','باربری','سایر'];
const deliveryLabels=new Set(['روش تحویل','روش ارسال','نحوهٔ تحویل']);
function iranMobile(value){
 const raw=C.latin(value).trim();
 if(!raw)return '';
 if(!/^\+?[\d\s()-]+$/.test(raw))throw Error('شماره موبایل را فقط با رقم وارد کن.');
 const phone=C.phone(raw);
 if(!/^09\d{9}$/.test(phone))throw Error('شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.');
 return phone;
}
function billSaveDraft(){commit(n=>{n.invoiceDraft=billDraft?billCopy(billDraft):null;});}
function billGo(which,id=''){go(which,id);}
function choosePreset(id){
 const p=presetFor(id);
 if(billDraft?.preset===id){billGo('billEdit');return;}
 if(billDraft&&!confirm('قالب جدید جایگزین پیش‌نویس فعلی شود؟'))return;
 billDraft={id:uid(),preset:p.id,design:'formal',color:p.color,column:p.column,title:'فاکتور فروش',paper:'A4',unit:db.shop.unit||'تومان',
  seller:db.shop.name||'',sellerPhone:db.shop.phone||'',sellerAddress:db.shop.address||'',logo:db.shop.logo||'',customer:'',phone:'',address:'',
  items:[{name:p.items[0],qty:'1',price:'',unit:p.unit,code:'',description:''}],fields:p.fields.filter(label=>!deliveryLabels.has(label)).map(label=>({label,value:''})),
  delivery:'',deliveryOther:'',terms:'',discount:'',shipping:'',taxRate:''};
 safe(billSaveDraft);billGo('billEdit');
}
const colorSafe=c=>/^#[a-f0-9]{6}$/i.test(c)?c:'#106b58';
function thumbnail(p){
 return '<div class="template-paper studio-thumbnail" style="--ink:'+p.color+'" aria-hidden="true">'+
 '<div class="mini-studio-head"><strong>فاکتور فروش</strong><span class="mini-brand">نام فروشگاه</span></div><div class="mini-details"><span>فروشنده</span><span>خریدار</span></div>'+
 '<div class="mini-table"><b>'+esc(p.column)+'</b><b>تعداد</b><b>مبلغ</b>'+p.items.map(x=>'<span>'+esc(x)+'</span><span>۱</span><span>—</span>').join('')+'</div><div class="mini-total">جمع قابل پرداخت</div></div>';
}
function invoiceHome(){
 return '<section class="welcome"><div><h1>فاکتور جدید</h1><p>قالب شغلت را انتخاب کن و همان‌جا فاکتورت را بساز.</p></div>'+
 action('جست‌وجوی فاکتورها',"billGo('billArchive')",'plain-btn')+'</section>'+
 (billDraft?'<div class="continue-card"><span>پیش‌نویس '+esc(presetFor(billDraft.preset).name)+'</span>'+action('ادامهٔ پیش‌نویس',"billGo('billEdit')",'plain-btn')+'</div>':'')+
 '<div class="gallery-heading"><h2>قالب‌های آماده</h2><span>'+fmt(invoicePresets.length)+' قالب</span></div>'+
 '<div class="group-filters" aria-label="دسته‌بندی قالب‌ها">'+['همه','کالا','فنی','خدمات'].map(g=>'<button type="button" aria-pressed="'+(billGroup===g)+'" onclick="billCategory('+idjs(g)+')">'+g+'</button>').join('')+'</div>'+
 '<div class="preset-gallery">'+invoicePresets.filter(p=>billGroup==='همه'||p.group===billGroup).map(p=>'<button class="preset-card" type="button" onclick="choosePreset('+idjs(p.id)+')">'+thumbnail(p)+'<span class="preset-name">'+esc(p.name)+'</span></button>').join('')+'</div>';
}
function billCategory(group){billGroup=group;render();}
function billInputs(){
 const b=billDraft,p=presetFor(b.preset);
 return '<div class="editor-kicker">'+action('قالب‌ها',"billGo('home')",'plain-btn')+'<span>'+esc(p.name)+'</span></div><h1>ویرایش فاکتور</h1>'+
 form('finishBill','<div class="bill-columns"><div>'+
 '<section class="bill-panel">'+input('عنوان بالای سند','documentTitle',b.title||'فاکتور فروش','required maxlength="80" data-bill="title"')+'</section>'+
 '<section class="bill-panel"><h2>مشخصات فروشنده</h2>'+input('نام کسب‌وکار','seller',b.seller,'required data-bill="seller"')+
 '<div class="field-grid">'+input('تلفن فروشنده','sellerPhone',b.sellerPhone,'inputmode="tel" data-bill="sellerPhone"')+
 input('نشانی فروشنده','sellerAddress',b.sellerAddress,'data-bill="sellerAddress"')+'</div>'+
 '<div class="appearance"><label>رنگ فاکتور<input name="billColor" type="color" data-bill="color" value="'+colorSafe(b.color)+'"></label>'+
 '<label>لوگو<input name="billLogo" type="file" accept="image/png,image/jpeg,image/webp" onchange="uploadBillLogo(this)"></label>'+
 (b.logo?action('حذف لوگو',"billDraft.logo='';safe(billSaveDraft);render()",'plain-btn'):'')+'</div>'+
 '<div class="field-grid">'+select('کاغذ','paper',['A4','A5'],b.paper,'data-bill="paper"')+'</div></section>'+
 '<section class="bill-panel"><h2>مشخصات مشتری</h2>'+input('نام مشتری','customer',b.customer,'required data-bill="customer" list="bill-customers"')+
 '<datalist id="bill-customers">'+db.customers.filter(c=>!c.archived).map(c=>'<option value="'+esc(c.name)+'"></option>').join('')+'</datalist>'+
 '<div class="field-grid">'+input('موبایل مشتری','phone',b.phone,'inputmode="tel" autocomplete="tel" placeholder="۰۹۱۲۳۴۵۶۷۸۹" data-bill="phone" aria-describedby="phone-error"')+input('نشانی مشتری','address',b.address,'data-bill="address"')+'</div>'+
 '<p class="error" id="phone-error" aria-live="polite"></p>'+
 (window.Android?action('انتخاب از مخاطبان گوشی','Android.pickContact()','plain-btn'):'')+
 select('روش تحویل','delivery',[['','انتخاب روش تحویل'],...deliveryOptions],b.delivery||'','data-bill="delivery"')+
 '<div id="delivery-other" '+(b.delivery==='سایر'?'':'hidden')+'>'+input('روش تحویل دیگر','deliveryOther',b.deliveryOther,'data-bill="deliveryOther"')+'</div>'+
 b.fields.map((f,i)=>deliveryLabels.has(f.label)?'':input(f.label,'field-value',f.value,'data-custom="'+i+':value"')).join('')+'</section>'+
 '<section class="bill-panel"><h2>اقلام فاکتور</h2>'+
 b.items.map((i,k)=>'<div class="bill-item">'+input('شرح کالا یا خدمت','billName',i.name,'required data-item="'+k+':name"')+
 '<div class="item-grid">'+input('تعداد','billQty',i.qty,'required inputmode="decimal" data-item="'+k+':qty"')+
 input('واحد','billUnit',i.unit,'data-item="'+k+':unit"')+
 input('مبلغ','billPrice',amountInput(i.price),'required inputmode="numeric" data-item="'+k+':price"')+'</div>'+
 details('کد و توضیح تکمیلی',input('کد کالا','billCode',i.code,'data-item="'+k+':code"')+input('توضیح تکمیلی','billDescription',i.description,'data-item="'+k+':description"'))+
 '<div class="row spread"><small id="bill-line-'+k+'"></small>'+(b.items.length>1?action('حذف قلم','removeBillItem('+k+')','plain-btn'):'')+'</div></div>').join('')+
 action('افزودن قلم','addBillItem()','plain-btn')+
 '<div class="field-grid">'+select('واحد پول','unit',['تومان','ریال'],b.unit,'data-bill="unit"')+input('تخفیف','discount',b.discount,'inputmode="numeric" data-bill="discount"')+
 input('هزینهٔ ارسال','shipping',b.shipping,'inputmode="numeric" data-bill="shipping"')+input('مالیات (درصد، اختیاری)','taxRate',b.taxRate,'inputmode="decimal" data-bill="taxRate"')+'</div>'+
 '<label>توضیحات فاکتور<textarea data-bill="terms" placeholder="'+esc(p.terms)+'">'+esc(b.terms)+'</textarea></label></section>'+
 paymentTermsEditor()+'</div>'+
 '<aside class="bill-preview"><h2>پیش‌نمایش فاکتور</h2><div id="live-bill"></div></aside></div>'+
 '<div class="bill-save"><div><small>قابل پرداخت</small><strong id="bill-sum">—</strong></div>'+submit('ذخیرهٔ فاکتور و PDF')+'</div>');
}
function addBillItem(){billDraft.items.push({name:'',qty:'1',price:'',unit:presetFor(billDraft.preset).unit});safe(billSaveDraft);render();document.querySelector('[data-item="'+(billDraft.items.length-1)+':name"]').focus();}
function removeBillItem(k){billDraft.items.splice(k,1);safe(billSaveDraft);render();}
async function uploadBillLogo(el){
 const file=el.files[0];if(!file)return;
 if(file.size>350000||!/^image\/(png|jpeg|webp)$/.test(file.type)){notice('لوگوی PNG، JPEG یا WebP تا ۳۵۰ کیلوبایت انتخاب کن.');return;}
 const active=billDraft;
 try{
  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
  if(billDraft===active){billDraft.logo=data;billSaveDraft();render();}
 }catch(e){notice(e.message||'خواندن لوگو ممکن نبود.');}
}
function billEditEvent(e){
 const el=e.target, d=el.dataset;
 if(d.bill)billDraft[d.bill]=el.value;
 else if(d.item){const [i,k]=d.item.split(':');billDraft.items[i][k]=el.value;}
 else if(d.custom){const [i,k]=d.custom.split(':');billDraft.fields[i][k]=el.value;}
 else if(d.due!==undefined){billDraft.installmentDates=billDraft.installmentDates||[];billDraft.installmentDates[Number(d.due)]=el.value;}
 else return;
 if(d.bill==='customer'){
   const found=db.customers.find(c=>c.name===el.value&&!c.archived);
   if(found){billDraft.phone=found.phone||'';billDraft.address=found.addresses[0]?.value||'';el.form.elements.phone.value=billDraft.phone;el.form.elements.address.value=billDraft.address;}
 }
 if(d.bill==='delivery')document.querySelector('#delivery-other').hidden=el.value!=='سایر';
 if(d.bill==='paymentMode'){safe(billSaveDraft);render();return;}
 if(d.bill==='phone'||d.bill==='customer')showBillPhoneError();
 safe(billSaveDraft);updateBill();
}
function showBillPhoneError(){
 const phone=document.querySelector('[data-bill="phone"]'), error=document.querySelector('#phone-error');
 let message='';
 try{iranMobile(phone.value);}catch(e){message=e.message;}
 phone.setCustomValidity(message);phone.setAttribute('aria-invalid',String(!!message));error.textContent=message;
}
function makeBill(strict){
 const b=billDraft, num=v=>C.amount(v,b.unit);
 const items=b.items.map(i=>({name:i.name.trim(),qty:i.qty,unit:i.unit.trim(),price:num(i.price),code:(i.code||'').trim(),description:(i.description||'').trim()}));
 if(strict&&(!b.seller.trim()||!b.customer.trim()||items.some(i=>!i.name)||b.items.some(i=>!i.price.trim())))throw Error('نام فروشنده، مشتری، شرح و قیمت هر قلم را وارد کن.');
 if(strict&&b.delivery==='سایر'&&!b.deliveryOther?.trim())throw Error('روش تحویل را مشخص کن.');
 const delivery=deliveryOptions.includes(b.delivery)?(b.delivery==='سایر'?b.deliveryOther?.trim():b.delivery):'';
 const entries=b.fields.filter(f=>f.label.trim()&&f.value.trim()&&!deliveryLabels.has(f.label));
 if(delivery)entries.unshift({label:'روش تحویل',value:delivery});
 const fields=entries.map(f=>({id:uid(),label:f.label.trim(),value:f.value.trim(),type:'text',visible:true}));
 const o={id:b.id,cid:'',number:'',on:iranToday(),status:'ثبت‌شده',unit:b.unit,items,fields,shipping:num(b.shipping),discount:num(b.discount),taxRate:b.taxRate||'',payments:[],address:b.address.trim()};
 const shop={...db.shop,name:b.seller.trim(),phone:b.sellerPhone.trim(),address:b.sellerAddress.trim(),logo:b.logo,color:b.color,unit:b.unit,paper:b.paper,layout:'جدولی',terms:b.terms.trim(),showPhone:true,showAddress:true,showBank:false,showTerms:true};
 const c={name:b.customer.trim(),phone:strict?iranMobile(b.phone):C.phone(b.phone)};
 let summary;
 try{summary=C.totals(o);}catch(e){if(strict)throw e;return {error:e.message};}
 const plan=buildPaymentPlan(b,summary.total,strict);
 const title=(b.title||'فاکتور فروش').trim();
 if(strict&&!title)throw Error('عنوان سند را وارد کن.');
 o.paymentPlan=plan;
 const doc={...C.snapshot(o,c,shop,types[1],'پیش‌نمایش',o.on,null),displayTitle:title,paymentPlan:plan,design:'formal',tableRevision:2,preset:b.preset,column:b.column};
 return {doc,o,c,shop,summary};
}
function updateBill(){
 const target=document.querySelector('#live-bill'), sum=document.querySelector('#bill-sum');
 if(!target||!sum)return;
 try{
  const result=makeBill(false);
  if(result.error)throw Error(result.error);
  const {doc,summary}=result;
  target.innerHTML=billSheet(doc);
  sum.textContent=money(summary.total,doc.shop.unit);
  summary.lines.forEach((v,i)=>document.querySelector('#bill-line-'+i).textContent='جمع قلم '+money(v,doc.shop.unit));
 }catch(e){target.textContent=e.message;sum.textContent='—';}
}
function finishBill(){
 const {doc,o,c,shop}=makeBill(true);
 doc.id=uid();
 commit(n=>{
   const customer=n.customers.find(x=>!x.archived&&C.norm(x.name)===C.norm(c.name)&&(!c.phone||!x.phone||C.phone(x.phone)===c.phone));
   if(customer){
     o.cid=customer.id;
     if(c.phone&&!customer.phone)customer.phone=c.phone;
     if(o.address&&!customer.addresses.some(a=>a.value===o.address))customer.addresses.push({label:'نشانی فاکتور',value:o.address});
   }else{
     o.cid=uid();
     n.customers.push({...c,id:o.cid,created:o.on,addresses:o.address?[{label:'نشانی فاکتور',value:o.address}]:[]});
   }
   o.number='O-'+(++n.seq);doc.number=(n.shop.prefix||'SY')+'-'+(++n.seq);
   n.orders.push(o);n.docs.push(doc);n.invoiceDraft=null;
   Object.assign(n.shop,{name:shop.name,phone:shop.phone,address:shop.address,logo:shop.logo,unit:shop.unit});
 });
 billDraft=null;billGo('document',doc.id);
 if(window.Android)requestStoredPdf(doc);
}
function billSheet(d){
 if(d.design==='studio')return studioSheet(d);
 if(d.design==='formal')return formalSheet(d);
 const s=d.shop,t=d.summary, m=n=>money(n,s.unit);
 const logo=/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s.logo||'')?'<img src="'+s.logo+'" alt="لوگوی فروشنده">':'';
 const field=(a,b)=>b?'<p><small>'+esc(a)+'</small><br>'+esc(b)+'</p>':'';
 return '<article class="bill-sheet '+(['band','grid','edge','line'].includes(d.design)?d.design:'line')+'" style="--invoice-ink:'+colorSafe(s.color)+'">'+
 '<div class="bill-sheet-head"><div>'+logo+'<strong>'+esc(s.name||'نام کسب‌وکار')+'</strong>'+field('تلفن',s.phone)+field('نشانی',s.address)+'</div>'+
 '<div><h3>'+esc(d.type)+'</h3><span dir="auto">'+esc(d.number)+'</span><br><time>'+C.day(d.on)+'</time></div></div>'+
 '<div class="bill-party">'+field('مشتری',d.customer.name||'نام مشتری')+field('تلفن مشتری',d.customer.phone)+field('نشانی مشتری',d.customer.address)+d.visible.map(f=>field(f.label,f.value)).join('')+'</div>'+
 '<div class="tablewrap"><table><thead><tr><th>'+esc(d.column||'شرح')+'</th><th>تعداد</th><th>قیمت واحد</th><th>جمع</th></tr></thead><tbody>'+
 d.items.map((x,i)=>'<tr><td>'+esc(x.name)+'</td><td>'+esc(C.latin(x.qty).replace(/\d/g,k=>'۰۱۲۳۴۵۶۷۸۹'[k]))+' '+esc(x.unit)+'</td><td>'+m(x.price)+'</td><td>'+m(t.lines[i])+'</td></tr>').join('')+
 '</tbody></table></div><div class="bill-sheet-totals"><div><span>جمع اقلام</span><b>'+m(t.subtotal)+'</b></div>'+
 (t.discount?'<div><span>تخفیف</span><b>'+m(t.discount)+'</b></div>':'')+(t.shipping?'<div><span>ارسال</span><b>'+m(t.shipping)+'</b></div>':'')+
 '<div class="bill-due"><span>قابل پرداخت</span><b>'+m(t.total)+'</b></div></div>'+
 (s.terms?'<div class="bill-terms">'+field('یادداشت',s.terms)+'</div>':'')+'</article>';
}
function archiveMatches(){
 const q=C.norm(billSearch);
 return db.docs.slice().reverse().filter(d=>!q||C.norm(invoiceName(d)).includes(q)||C.norm(d.number).includes(q));
}
function archiveCards(){
 const docs=archiveMatches();
 return docs.length?docs.map(d=>'<button type="button" class="archive-row" onclick="billGo(\'document\','+idjs(d.id)+')"><span><strong>'+esc(invoiceName(d))+'</strong><small>'+esc(d.type)+' · '+esc(d.number)+' · '+C.day(d.on)+'</small></span><b>'+money(d.payment?.amount??d.summary.total,d.shop.unit)+'</b></button>').join(''):
 '<div class="archive-empty">'+(billSearch?'فاکتوری با این نام پیدا نشد.':'فاکتورهای ذخیره‌شده اینجا نمایش داده می‌شوند.')+'</div>';
}
function billFilter(v){billSearch=v;document.querySelector('#bill-results').innerHTML=archiveCards();}
function archiveScreen(){
 return '<div class="gallery-heading"><h1>فاکتورهای من</h1>'+action('فاکتور جدید',"billGo('home')",'primary')+'</div>'+
 input('جست‌وجو با نام مشتری یا شماره فاکتور','invoice-search',billSearch,'type="search" placeholder="مثلاً علی کریمی" oninput="billFilter(this.value)"')+
 '<div id="bill-results">'+archiveCards()+'</div>';
}
function requestStoredPdf(d){
 const params=invoicePdfData(d);
 Android.archiveDocument(JSON.stringify(params),d.id,d.shop.paper);
}
function billPdf(mode){
 const d=db.docs.find(x=>x.id===current);
 if(!window.Android){if(mode==='save'||mode==='print')window.print();else notice('برای ارسال، PDF را ذخیره و پیوست کن.');return;}
 const filename=(d.type+'-'+d.number).replace(/[\\/:*?"<>|]/g,'-');
 Android.storedDocument(JSON.stringify(invoicePdfData(d)),filename,d.shop.paper,mode,d.id);
}
function savedBill(){
 const d=db.docs.find(x=>x.id===current);
 return '<div class="tools saved-tools">'+row(action('فاکتورهای من',"billGo('billArchive')",'plain-btn'),
 action('ذخیرهٔ فایل PDF',"billPdf('save')",'primary'),action('ارسال PDF',"billPdf('share')",'plain-btn'),action('چاپ',"billPdf('print')",'plain-btn'))+
 row(action('فاکتور جدید از روی این فاکتور','repeatBill()','plain-btn'),d.design?'':action('بازگشت به سفارش',"go('order',"+idjs(d.orderId)+")",'plain-btn'))+billPayments(d)+'</div>'+
 '<div class="saved-bill">'+(d.design?billSheet(d):sheet(d))+'</div>';
}
function repeatBill(){
 const d=db.docs.find(x=>x.id===current&&x.type===types[1]);
 if(!d)return;
 if(billDraft&&!confirm('پیش‌نویس فعلی جایگزین شود؟'))return;
 const p=presetFor(d.preset), s=d.shop, profile=db.shop, c=d.customer;
 billDraft={id:uid(),preset:p.id,design:'formal',color:s.color||p.color,column:d.column||p.column,title:'فاکتور فروش',paper:s.paper||'A4',unit:s.unit,
  seller:profile.name||s.name,sellerPhone:profile.phone||'',sellerAddress:profile.address||'',logo:profile.logo||'',
  customer:c.name,phone:c.phone||'',address:c.address||'',
  items:d.items.map(i=>({name:i.name,qty:i.qty,unit:i.unit||'',price:displayAmount(i.price,s.unit),code:i.code||'',description:i.description||''})),
  fields:p.fields.filter(label=>!deliveryLabels.has(label)).map(label=>({label,value:''})),
  delivery:'',deliveryOther:'',terms:'',discount:'',shipping:'',taxRate:''};
 safe(billSaveDraft);billGo('billEdit');
}
function billPayments(d){
 const o=order(d.orderId);
 if(!o)return '';
 const unit=o.unit,m=n=>money(n,unit);
 const total=C.totals(o).total,paid=C.paid(o),left=total-paid;
 return '<section class="bill-payment"><h2>حساب این سفارش</h2><div class="payment-summary">'+
 '<div><small>مبلغ سفارش</small><strong>'+m(total)+'</strong></div>'+
 '<div><small>دریافت‌شده</small><strong>'+m(paid)+'</strong></div>'+
 '<div><small>مانده</small><strong data-balance>'+m(left)+'</strong></div></div>'+
 (left>0?details('ثبت پرداخت',form('saveBillPayment',
  input('مبلغ دریافتی ('+unit+')','amount','','required inputmode="decimal"')+
  select('روش پرداخت','method',['کارت','نقد','واریز','سایر'],'کارت')+
  submit('ذخیرهٔ پرداخت'))):'<p><strong>تسویه شد</strong></p>')+
 (o.payments.some(p=>!p.void)?details('پرداخت‌های ثبت‌شده',o.payments.filter(p=>!p.void).slice().reverse().map(p=>'<p>'+C.day(p.on)+' · '+esc(p.method)+' · '+m(p.amount)+'</p>').join('')+
 action('رسید یا اصلاح پرداخت',"go('order',"+idjs(o.id)+")",'plain-btn')):'')+'</section>';
}
function saveBillPayment(f){
 const d=db.docs.find(x=>x.id===current&&x.type===types[1]);
 if(!d)throw Error('فاکتور پیدا نشد.');
 recordPayment(d.orderId,f);
 render();notice('پرداخت ثبت شد.');
}

function persianWords(value){
 const small=['','یک','دو','سه','چهار','پنج','شش','هفت','هشت','نه','ده','یازده','دوازده','سیزده','چهارده','پانزده','شانزده','هفده','هجده','نوزده'];
 const tens=['','','بیست','سی','چهل','پنجاه','شصت','هفتاد','هشتاد','نود'];
 const hundreds=['','صد','دویست','سیصد','چهارصد','پانصد','ششصد','هفتصد','هشتصد','نهصد'];
 const scales=['','هزار','میلیون','میلیارد','تریلیون','کوادریلیون'];
 if(!value)return 'صفر';
 const groups=[];
 for(let scale=0;value;scale++){
   const n=Number(value%1000n);value/=1000n;
   if(!n)continue;
   const remainder=n%100;
   const parts=[hundreds[Math.floor(n/100)],...(remainder<20?[small[remainder]]:[tens[Math.floor(remainder/10)],small[remainder%10]])].filter(Boolean);
   groups.unshift(parts.join(' و ')+(scales[scale]?' '+scales[scale]:''));
 }
 return groups.join(' و ');
}
function payableWords(total,unit){
 const n=BigInt(total);
 if(unit==='ریال')return persianWords(n)+' ریال';
 if(n<10n&&n>0n)return persianWords(n)+' ریال';
 return persianWords(n/10n)+' تومان'+(n%10n?' و '+persianWords(n%10n)+' ریال':'');
}
function formalRows(d){
 const m=n=>money(n,d.shop.unit);
 if(d.tableRevision===2)return d.items.map((i,k)=>[fmt(k+1),i.code||'',[i.name,i.description].filter(Boolean).join(' · '),i.qty+' '+i.unit,m(i.price),m(d.summary.lines[k])]);
 return d.items.map((i,k)=>[fmt(k+1),i.code||'',i.name,i.qty+' '+i.unit,m(i.price),m(d.summary.lines[k]),i.description||'']);
}
function formalTotals(d){
 const t=d.summary,u=d.shop.unit,m=n=>money(n,u);
 return [
  ['جمع کل فاکتور',m(t.subtotal)],['تخفیف',m(t.discount)],
  ['مالیات بر ارزش افزوده'+(d.taxRate?' ('+fmt(Number(C.latin(d.taxRate).replace('٫','.')))+'٪)':''),m(t.tax||0)],
  ...(t.shipping?[['هزینهٔ ارسال',m(t.shipping)]]:[]),
  ['مبلغ قابل پرداخت',m(t.total)],['مبلغ قابل پرداخت به حروف',payableWords(t.total,u)]
 ];
}
const formalHeaders=['ردیف','کد کالا','نام کالا یا خدمت','تعداد','بهای واحد','مبلغ کل','شرح کالا'];
const currentFormalHeaders=['ردیف','کد کالا','شرح کالا','تعداد','مبلغ','مبلغ کل'];
function invoiceBarcode(number){
 const value=C.latin(number).match(/-(\d{1,15})$/)?.[1];
 if(!value)return [];
 // Code 39 digit and delimiter patterns.
 const patterns=[0x034,0x121,0x061,0x160,0x031,0x130,0x070,0x025,0x124,0x064];
 const chars=[0x094,...Array.from(value,d=>patterns[Number(d)]),0x094];
 return chars.flatMap((pattern,i)=>[
   ...Array.from({length:9},(_,k)=>pattern&(1<<(8-k))?3:1),
   ...(i<chars.length-1?[1]:[])
 ]);
}
function formalSheet(d){
 const s=d.shop,widths=invoiceBarcode(d.number);
 const logo=/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s.logo||'')?'<img src="'+s.logo+'" alt="لوگوی فروشگاه">':'';
 const line=(label,value)=>value?'<div><b>'+esc(label)+'</b> '+esc(value)+'</div>':'';
 const cells=(values,tag)=>values.map(v=>'<'+tag+'>'+esc(v)+'</'+tag+'>').join('');
 return '<article class="formal-sheet '+(d.tableRevision===2?'current-table':'')+'" style="--invoice-ink:'+colorSafe(s.color)+'">'+
 '<div class="formal-brand">'+logo+'<div><strong>'+esc(s.name||'نام فروشگاه')+'</strong>'+line('تلفن فروشگاه',s.phone)+line('نشانی فروشگاه',s.address)+'</div></div>'+
 '<h2>'+esc(d.displayTitle||d.type)+'</h2><div class="formal-parties"><div>'+
 line('صورتحساب آقای/خانم',d.customer.name||'نام مشتری')+line('تلفن',d.customer.phone)+line('آدرس',d.customer.address)+d.visible.map(f=>line(f.label,f.value)).join('')+
 '</div><div>'+line('تاریخ',C.editableDay(d.on).replace(/\d/g,k=>'۰۱۲۳۴۵۶۷۸۹'[k]))+line('شماره فاکتور',d.number)+line('واحد پول',s.unit)+'</div></div>'+
 '<div class="formal-middle"><div class="tablewrap"><table class="formal-items"><thead><tr>'+cells(d.tableRevision===2?currentFormalHeaders:formalHeaders,'th')+'</tr></thead><tbody>'+
 formalRows(d).map(v=>'<tr>'+cells(v,'td')+'</tr>').join('')+'</tbody></table></div>'+
 '<table class="formal-totals"><tbody>'+formalTotals(d).map(([key,val])=>'<tr><th>'+esc(key)+'</th><td>'+esc(val)+'</td></tr>').join('')+'</tbody></table></div>'+
 '<div class="formal-footer">'+paymentPlanHtml(d)+line('توضیحات',s.terms)+
 '<div class="formal-signatures"><div>امضای فروشنده</div><div>امضای خریدار</div></div>'+
 (widths.length?'<div class="formal-barcode" aria-hidden="true">'+widths.map((w,i)=>'<span class="'+(i%2?'gap':'bar')+'" style="flex:'+w+'"></span>').join('')+'</div>':'')+'</div></article>';
}
function invoicePdfData(d){
 const data={...pdfData(d),title:d.displayTitle||d.type,design:d.design,column:d.column};
 if(d.design==='studio'){
   return {...data,headers:studioHeaders,rows:studioRows(d).map(row=>[row[0],row.slice(1,3).filter(Boolean).join('\n'),...row.slice(3)]),
    buyer:[d.customer.name,d.customer.phone,d.customer.address].filter(Boolean),
    seller:[d.shop.name,d.shop.phone,d.shop.address].filter(Boolean),
    extras:d.visible.map(f=>f.label+' · '+f.value),meta:['شماره '+d.number,C.day(d.on),'واحد پول '+d.shop.unit],
    adjustments:studioAdjustments(d),balance:money(d.summary.total,d.shop.unit),words:payableWords(d.summary.total,d.shop.unit),note:d.shop.terms||''};
 }
 if(d.design!=='formal')return data;
 const labelled=(k,v)=>v?k+'  '+v:'';
 return {...data,tableRevision:d.tableRevision,headers:d.tableRevision===2?currentFormalHeaders:formalHeaders,rows:formalRows(d),formalTotals:formalTotals(d),barcode:invoiceBarcode(d.number),
  buyer:[labelled('صورتحساب آقای/خانم',d.customer.name),labelled('تلفن',d.customer.phone),labelled('آدرس',d.customer.address),...d.visible.map(f=>labelled(f.label,f.value))].filter(Boolean),
  meta:[labelled('تاریخ',C.day(d.on)),labelled('شماره فاکتور',d.number),labelled('واحد پول',d.shop.unit)],
  note:[paymentPlanLines(d).join('\n'),d.shop.terms||''].filter(Boolean).join('\n')};
}
const studioHeaders=['ردیف','کالا یا خدمت','مقدار','نرخ','مبلغ'];
function studioRows(d){
 const m=n=>money(n,d.shop.unit);
 return d.items.map((item,i)=>[fmt(i+1),item.name,[item.code?'کد '+item.code:'',item.description].filter(Boolean).join(' · '),
   item.qty+' '+item.unit,m(item.price),m(d.summary.lines[i])]);
}
function studioAdjustments(d){
 const t=d.summary,m=n=>money(n,d.shop.unit);
 return [['جمع اقلام',m(t.subtotal)],
   ...(t.discount?[['تخفیف','− '+m(t.discount)]]:[]),
   ...(t.shipping?[['ارسال',m(t.shipping)]]:[]),
   ...(t.tax?[['مالیات',m(t.tax)]]:[])];
}
function studioSheet(d){
 const s=d.shop,color=colorSafe(s.color);
 const logo=/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s.logo||'')?'<img src="'+s.logo+'" alt="لوگوی فروشگاه">':'';
 const contacts=(label,name,details)=>'<section><h3>'+label+'</h3><strong>'+esc(name)+'</strong>'+
  details.filter(Boolean).map(v=>'<span>'+esc(v)+'</span>').join('')+'</section>';
 const cell=v=>'<td>'+esc(v)+'</td>';
 const rows=studioRows(d).map(([index,name,description,...amounts])=>'<tr>'+cell(index)+'<td><b>'+esc(name)+'</b>'+
  (description?'<small>'+esc(description)+'</small>':'')+'</td>'+amounts.map(cell).join('')+'</tr>').join('');
 return '<article class="studio-sheet" style="--studio-color:'+color+'">'+
 '<div class="studio-mast"><div class="studio-brand">'+logo+'<strong>'+esc(s.name||'نام فروشگاه')+'</strong></div>'+
 '<div class="studio-title"><h2>فاکتور فروش</h2><span dir="auto">'+esc(d.number)+'</span><time>'+C.day(d.on)+'</time></div></div>'+
 '<div class="studio-contacts">'+contacts('فروشنده',s.name,[s.phone,s.address])+contacts('خریدار',d.customer.name||'نام مشتری',[d.customer.phone,d.customer.address])+'</div>'+
 (d.visible.length?'<dl class="studio-extras">'+d.visible.map(f=>'<div><dt>'+esc(f.label)+'</dt><dd>'+esc(f.value)+'</dd></div>').join('')+'</dl>':'')+
 '<table class="studio-items"><thead><tr>'+studioHeaders.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table>'+
 '<div class="studio-balance"><div class="studio-adjustments">'+studioAdjustments(d).map(([k,v])=>'<p><span>'+k+'</span><b>'+v+'</b></p>').join('')+'</div>'+
 '<div class="studio-due"><span>مبلغ قابل پرداخت</span><strong>'+money(d.summary.total,s.unit)+'</strong><small>'+payableWords(d.summary.total,s.unit)+'</small></div></div>'+
 (s.terms?'<section class="studio-note"><h3>توضیحات</h3><p>'+esc(s.terms)+'</p></section>':'')+
 '<div class="studio-sign"><span>تأیید فروشنده</span><span>تأیید خریدار</span></div></article>';
}
function simpleSettings(advanced){
 const original=document.createElement('template');
 original.innerHTML=settings();
 if(advanced){
   app.innerHTML='<h1>اکسل و پشتیبان‌گیری</h1>'+row(action('بازگشت به تنظیمات',"go('settings')",'plain-btn'));
   const other=document.createElement('details');
   other.innerHTML='<summary>تنظیمات تکمیلی</summary>';
   const primary=new Map([['اکسل مشتریان','فهرست مشتریان برای باز کردن در Excel.'],['پشتیبان‌گیری','ذخیرهٔ نسخهٔ پشتیبان یا انتقال داده‌ها به گوشی دیگر.']]);
   for(const section of Array.from(original.content.children).filter(e=>e.tagName==='DETAILS').slice(1)){
     const summary=section.querySelector('summary'), label=summary.textContent;
     if(primary.has(label)){
       summary.insertAdjacentHTML('afterend','<p class="settings-explanation">'+esc(primary.get(label))+'</p>');
       app.append(section);
     }else other.append(section);
   }
   app.append(other);
   return;
 }
 app.innerHTML='<h1>تنظیمات</h1>';
 const profile=Array.from(original.content.children).find(e=>e.tagName==='DETAILS');
 if(profile)app.append(profile);
 app.insertAdjacentHTML('beforeend','<div class="settings-menu">'+[
   ['دفتر مشتریان','مشخصات و سوابق مشتریان','customers'],
   ['سفارش‌ها','پیگیری سفارش و ثبت پرداخت','orders'],
   ['اکسل و پشتیبان‌گیری','خروجی فهرست مشتریان یا انتقال اطلاعات به گوشی دیگر','settingsOther'],
   ['راهنمای استفاده','ساخت فاکتور، تکرار خرید و ثبت پرداخت','help'],
   ['حریم خصوصی','نحوهٔ ذخیره، ارسال و پاک کردن اطلاعات','privacy']
 ].map(([name,desc,screen])=>'<button type="button" onclick="go('+idjs(screen)+')"><strong>'+esc(name)+'</strong><small>'+esc(desc)+'</small></button>').join('')+'</div>');
}
function privacyPage(){
 return '<h1>حریم خصوصی فاکتورچین</h1>'+row(action('بازگشت به تنظیمات',"go('settings')",'plain-btn'))+
 card('<h2>اطلاعات روی دستگاه</h2><p>اطلاعات فروشگاه، نام و شماره و نشانی مشتری، فاکتورها، پرداخت‌ها و پیش‌نویس‌ها در حافظهٔ خصوصی برنامه ذخیره می‌شوند. نام شخصی و موبایل پروفایل اختیاری‌اند و فقط برای نمایش پروفایل روی همین دستگاه استفاده می‌شوند. ورود آنلاین یا بازیابی سروری حساب وجود ندارد. برنامه تبلیغات و ابزار آمارگیری ندارد.</p>')+
 card('<h2>انتخاب و ارسال فایل</h2><p>برنامه اطلاعات یک مخاطب یا فایل را وقتی می‌خواند که خودتان آن را با انتخابگر گوشی مشخص کنید. PDF، اکسل و پشتیبان را با انتخاب خودتان ذخیره یا به برنامهٔ دیگری ارسال می‌کنید. برنامهٔ گیرنده یا محل ذخیره ممکن است قواعد خودش را داشته باشد.</p>')+
 card('<h2>راهنمای آنلاین</h2><p>این قابلیت اختیاری است و پس از تنظیم نشانی HTTPS کار می‌کند. پس از اطلاع‌رسانی و تأیید شما، متن سؤال به همان سرور می‌رود. پروندهٔ مشتری یا فاکتور به‌طور خودکار ارسال نمی‌شود. نشانی را در تنظیمات تکمیلی می‌توانید پاک کنید.</p>')+
 card('<h2>نگهداری و پاک‌کردن</h2><p>برای پاک کردن داده‌های داخل برنامه از App info ← Storage ← Clear data استفاده کنید. نسخه‌هایی که قبلاً در پوشه‌ها، پیام‌رسان‌ها یا محل دیگری ذخیره کرده‌اید، از همان محل مدیریت می‌شوند. ناشر: گروه فاکتورچی. برای پشتیبانی یا پرسش دربارهٔ حریم خصوصی به factorchin.app@gmail.com ایمیل بزنید.</p>');
}
render=function(){
 document.body.dataset.screen=page;
 if(page==='home'){app.innerHTML=invoiceHome();return;}
 if(page==='billArchive'){app.innerHTML=archiveScreen();return;}
 if(page==='privacy'){app.innerHTML=privacyPage();return;}
 if(page==='billEdit'){
   if(!billDraft){billGo('home');return;}
   app.innerHTML=billInputs();
   app.querySelector('form').addEventListener('input',billEditEvent);
   showBillPhoneError();updateBill();return;
 }
 if(page==='document'&&db.docs.find(x=>x.id===current)?.type===types[1]){app.innerHTML=savedBill();return;}
 if(page==='settings'||page==='settingsOther'){simpleSettings(page==='settingsOther');return;}
 oldRender();
};
render();

