'use strict';
const workspaceRender=render;
let setupValues=null;
function newInvoice(){
 if(billDraft){
   const next=draftForBusiness(db.shop.businessPreset||'retail');
   commit(n=>n.invoiceDraft=next);billDraft=next;
   billGo('billEdit');return;
 }
 choosePreset(db.shop.businessPreset||'retail');
}
function draftForBusiness(id){
 if(!billDraft||billDraft.preset===id)return billDraft;
 const next=billCopy(billDraft),before=presetFor(next.preset),after=presetFor(id);
 next.preset=after.id;next.column=after.column;
 next.fields=after.fields.filter(label=>!deliveryLabels.has(label)).map(label=>({label,value:next.fields.find(f=>f.label===label)?.value||''}));
 next.items=next.items.map(item=>!item.price&&before.items.includes(item.name)?{...item,name:after.items[0],unit:after.unit}:item);
 return next;
}
function setupPage(){
 const shop={...db.shop,...setupValues},registration={...(db.registration||{}),...setupValues};
 return '<div class="registration-brand"><img src="brand-mascot.png" alt="نشان فاکتورچین"><h1>به فاکتورچین خوش آمدی</h1><p>هر فاکتور، یک خیال آسوده</p></div>'+
 '<div class="setup-intro"><h2>شروع کار</h2><p>نام کسب‌وکارت را بنویس تا روی فاکتورها نمایش داده شود.</p></div>'+form('finishSetup',
 details('پروفایل شخصی (اختیاری)',input('نام و نام خانوادگی (اختیاری)','fullName',registration.fullName,'autocomplete="name" maxlength="100"')+
 input('موبایل خودت (اختیاری)','mobile',registration.mobile,'autocomplete="tel" inputmode="tel" placeholder="۰۹۱۲۳۴۵۶۷۸۹" aria-describedby="registration-phone-error" oninput="validateRegistrationPhone(this)"')+
 '<p class="error" id="registration-phone-error" aria-live="polite"></p><p><small>این مشخصات فقط برای نمایش پروفایل روی همین گوشی ذخیره می‌شوند و روی فاکتور مشتری چاپ نمی‌شوند. ورود آنلاین یا تأیید پیامکی وجود ندارد.</small></p>')+
 card(input('نام فروشگاه یا کسب‌وکار','name',shop.name,'required autocomplete="organization"')+
 select('نوع فعالیت','businessPreset',invoicePresets.map(p=>[p.id,p.name]),shop.businessPreset||'retail')+
 select('واحد پول','unit',['تومان','ریال'],shop.unit||'تومان')+
 input('تلفن فروشگاه (اختیاری)','phone',shop.phone,'inputmode="tel"')+
 area('نشانی فروشگاه (اختیاری)','address',shop.address)+
 '<p>لوگو و رنگ فاکتور را از «تنظیمات» یا هنگام ساخت فاکتور انتخاب کن.</p>'+
 row(action('مطالعهٔ حریم خصوصی',"go('privacy')",'plain-btn'))+
 '<label><input name="acceptPrivacy" type="checkbox" required> حریم خصوصی و نگهداری اطلاعات روی گوشی را مطالعه کردم.</label>'+
 submit('شروع استفاده از فاکتورچین')));
}
function validateRegistrationPhone(input){
 let message='';
 try{iranMobile(input.value);}catch(e){message=e.message;}
 input.setCustomValidity(message);
 input.setAttribute('aria-invalid',String(!!message));
 document.querySelector('#registration-phone-error').textContent=message;
}
function finishSetup(f){
 const name=val(f,'name');if(!name)throw Error('نام کسب‌وکار را وارد کن.');
 const fullName=val(f,'fullName'),mobile=iranMobile(val(f,'mobile'));
 if(!f.elements.acceptPrivacy.checked)throw Error('مطالعهٔ حریم خصوصی را تأیید کن.');
 commit(n=>{
  Object.assign(n.shop,{name,phone:val(f,'phone'),address:val(f,'address'),unit:val(f,'unit'),businessPreset:val(f,'businessPreset'),setupComplete:true});
  n.registration={completed:true,fullName,mobile,createdAt:n.registration?.createdAt||new Date().toISOString(),privacyAcceptedAt:new Date().toISOString()};
 });
 setupValues=null;
 go('home');
}
function dashboard(){
 const sales=db.docs.filter(d=>d.type===types[1]),today=iranToday();
 const openOrders=db.orders.filter(o=>o.status!=='لغوشده');
 const balance=openOrders.reduce((n,o)=>n+C.totals(o).total-C.paid(o),0);
 return '<section class="welcome"><div><h1>'+esc(db.shop.name)+'</h1><p>'+C.day(today)+'</p></div>'+action('فاکتور جدید','newInvoice()','plain-btn')+'</section>'+
 '<div class="grid">'+tile('فاکتورهای امروز',fmt(sales.filter(d=>d.on===today).length))+tile('ماندهٔ دریافتنی',money(balance))+'</div>'+
 '<div class="dashboard-search">'+input('جست‌وجوی مشتری یا شماره فاکتور','quickSearch','','type="search" placeholder="نام مشتری را بنویس" oninput="homeSearch(this.value)"')+'</div>'+
 '<div class="gallery-heading"><h2>آخرین فاکتورها</h2>'+action('همهٔ فاکتورها',"go('billArchive')",'plain-btn')+'</div>'+
 '<div id="dashboard-results">'+dashboardResults('')+'</div>'+
 (billDraft?row(action('ادامهٔ پیش‌نویس',"go('billEdit')",'primary')):'');
}
function dashboardResults(query){
 const q=C.norm(query);
 return db.docs.filter(d=>d.type===types[1]&&(!q||C.norm(d.customer.name+' '+d.number).includes(q))).slice().reverse().slice(0,8).map(d=>
 '<button class="archive-row" onclick="go(\'document\','+idjs(d.id)+')"><span><strong>'+esc(d.customer.name)+'</strong><small>'+esc(d.number)+' · '+C.day(d.on)+'</small></span><b>'+money(d.summary.total,d.shop.unit)+'</b></button>').join('')||
 card('برای شروع، «فاکتور جدید» را بزن.');
}
function homeSearch(q){document.querySelector('#dashboard-results').innerHTML=dashboardResults(q);}
function openMenu(){
 const dialog=document.createElement('dialog');dialog.className='workspace-menu';
 dialog.innerHTML='<div class="menu-brand"><img src="brand-mascot.png" alt="نشان فاکتورچین"><h2>فاکتورچین</h2><p>هر فاکتور، یک خیال آسوده</p>'+
 (db.registration?.fullName?'<small>'+esc(db.registration.fullName)+'</small>':'')+'</div>'+[
 ['خانه','home'],['فاکتورها','billArchive'],['مشتریان','customers'],['کالا و خدمات','inventory'],['گزارش فروش و دریافتی','reports'],
 ['انتخاب شغل','business'],['پشتیبان‌گیری و اکسل','settingsOther'],['تنظیمات','settings'],['راهنمای استفاده','help']
 ].map(([label,screen])=>action(label,"this.closest('dialog').close();this.closest('dialog').remove();go("+idjs(screen)+")")).join('')+
 action('بستن',"this.closest('dialog').close();this.closest('dialog').remove()",'plain-btn');
 dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
}
function businessPage(){
 return '<h1>نوع فعالیت</h1><p>شغل پیش‌فرض، اقلام و اطلاعات پیشنهادی فاکتورهای تازه را مشخص می‌کند.</p>'+
 form('saveBusiness',select('نوع فعالیت','businessPreset',invoicePresets.map(p=>[p.id,p.name]),db.shop.businessPreset||'retail')+submit('ذخیرهٔ فعالیت'));
}
function saveBusiness(f){
 const id=val(f,'businessPreset'),next=draftForBusiness(id);
 commit(n=>{n.shop.businessPreset=id;n.invoiceDraft=next;});
 billDraft=next;go('home');
}
function inventoryPage(){
 return '<h1>کالا و خدمات</h1><p>قیمت ذخیره‌شده هنگام انتخاب قلم به فاکتور می‌آید.</p>'+
 db.catalog.map(c=>card('<h2>'+esc(c.name)+'</h2><p>'+esc(c.code||'')+' · '+money(c.price)+'</p>'+
 row(action('ویرایش','editCatalog('+idjs(c.id)+')'),action('حذف','removeCatalog('+idjs(c.id)+')','danger')))).join('')+
 '<div class="bill-panel" id="catalog-form">'+catalogForm()+'</div>';
}
let reportPeriod='month',reportFrom='',reportTo='';
function reportRange(){
 const today=iranToday();
 if(reportPeriod==='all')return {from:'',to:today};
 if(reportPeriod==='custom')return {from:reportFrom,to:reportTo};
 const count=reportPeriod==='today'?1:reportPeriod==='week'?7:30;
 const start=new Date(today+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-count+1);
 return {from:start.toISOString().slice(0,10),to:today};
}
function changeReportPeriod(value){reportPeriod=value;render();}
function saveReportRange(f){
 const from=C.date(val(f,'from')),to=C.date(val(f,'to'));
 if(!from||!to||from>to)throw Error('تاریخ شروع و پایان معتبر وارد کن. پایان باید بعد از شروع باشد.');
 reportFrom=from;reportTo=to;render();
}
function reportData(range){
 const inRange=on=>on&&(!range.from||on>=range.from)&&(!range.to||on<=range.to);
 const ids=new Set(db.docs.filter(d=>d.type===types[1]).map(d=>d.orderId));
 const sales=db.orders.filter(o=>ids.has(o.id)&&o.status!=='لغوشده');
 const selected=sales.filter(o=>inRange(o.on));
 return {
  selected,
  total:selected.reduce((sum,o)=>sum+C.totals(o).total,0),
  outstanding:selected.reduce((sum,o)=>sum+C.totals(o).total-C.paid(o),0),
  receipts:sales.flatMap(o=>o.payments.filter(p=>!p.void&&inRange(p.on))).reduce((sum,p)=>sum+p.amount,0)
 };
}
function reportPage(){
 const range=reportRange(),r=reportData(range);
 const rangeForm=reportPeriod==='custom'?form('saveReportRange','<div class="field-grid">'+input('از تاریخ شمسی','from',C.editableDay(reportFrom),'placeholder="۱۴۰۵/۰۹/۰۱"')+input('تا تاریخ شمسی','to',C.editableDay(reportTo))+'</div>'+submit('نمایش گزارش')):'';
 if(reportPeriod==='custom'&&(!reportFrom||!reportTo))return '<h1>فروش و پول دریافتی</h1>'+
 select('بازهٔ گزارش','period',[['today','امروز'],['week','۷ روز اخیر'],['month','۳۰ روز اخیر'],['all','از ابتدا'],['custom','انتخاب تاریخ']],reportPeriod,'onchange="changeReportPeriod(this.value)"')+
 rangeForm+'<p>تاریخ شروع و پایان را وارد کن و «نمایش گزارش» را بزن.</p>';
 return '<h1>فروش و پول دریافتی</h1>'+
 select('بازهٔ گزارش','period',[['today','امروز'],['week','۷ روز اخیر'],['month','۳۰ روز اخیر'],['all','از ابتدا'],['custom','انتخاب تاریخ']],reportPeriod,'onchange="changeReportPeriod(this.value)"')+
 rangeForm+
 '<p>'+ (range.from?C.day(range.from):'از اولین فاکتور')+' تا '+C.day(range.to)+'</p>'+
 '<div class="grid">'+tile('فروش این بازه',money(r.total))+tile('پول دریافت‌شده در این بازه',money(r.receipts))+tile('ماندهٔ فاکتورهای این بازه',money(r.outstanding))+'</div>'+
 card('<p><b>فروش:</b> جمع مبلغ فاکتورهای فروش ثبت‌شده در این تاریخ‌ها.</p><p><b>پول دریافتی:</b> پرداخت‌هایی که تاریخ دریافتشان در همین بازه است؛ حتی برای فاکتور قدیمی.</p><p><b>مانده:</b> مبلغی که از فاکتورهای صادرشده در این بازه هنوز دریافت نکرده‌ای.</p>')+
 '<h2>فاکتورهای این بازه ('+fmt(r.selected.length)+')</h2>'+
 (r.selected.map(o=>card('<strong>'+esc(customer(o.cid)?.name)+'</strong><p>'+esc(o.number)+' · '+C.day(o.on)+' · '+money(C.totals(o).total,o.unit)+'</p>')).join('')||card('در این بازه فاکتور فروشی ثبت نشده است.'));
}
function editorCatalog(){
 return '<section class="bill-panel"><h2>انتخاب از کالا و خدمات</h2>'+
 select('قلم ذخیره‌شده','saved-product',[['','انتخاب کن'],...db.catalog.map(c=>[c.id,c.name+' · '+money(c.price)])],'','onchange="pickSavedProduct(this.value)"')+'</section>';
}
function pickSavedProduct(id){
 const c=db.catalog.find(c=>c.id===id);if(!c)return;
 const item={name:c.name,qty:'1',price:displayAmount(c.price,billDraft.unit),code:c.code||'',unit:c.unit||'',description:''};
 const index=billDraft.items.findIndex(i=>!i.price&&!i.name);
 if(index>=0)billDraft.items[index]=item;else billDraft.items.push(item);
 billSaveDraft();render();
}
render=function(){
 if((!db.shop.setupComplete||!(db.registration?.completed||db.registration?.mobile))&&!['setup','privacy','help'].includes(page))page='setup';
 if(page==='setup'){
  applyAppearance();document.body.dataset.screen=page;app.innerHTML=setupPage();
  app.querySelector('form').addEventListener('input',event=>{
   setupValues=Object.fromEntries(new FormData(event.currentTarget).entries());
  });
 }
 else if(page==='home'){applyAppearance();document.body.dataset.screen=page;app.innerHTML=dashboard();}
 else if(page==='inventory'){app.innerHTML=inventoryPage();}
 else if(page==='reports'){app.innerHTML=reportPage();}
 else if(page==='business'){app.innerHTML=businessPage();}
 else {
   workspaceRender();
   if(page==='billEdit'&&db.catalog.length)app.querySelector('.bill-columns>div').insertAdjacentHTML('afterbegin',editorCatalog());
 }
 const header=document.querySelector('header');
 if(!header.querySelector('.menu-trigger'))header.insertAdjacentHTML('afterbegin','<button class="menu-trigger" aria-label="باز کردن منو" onclick="openMenu()">☰</button>');
 header.querySelector('.menu-trigger').hidden=page==='setup';
 document.querySelector('nav').innerHTML=action('خانه',"go('home')")+action('فاکتورها',"go('billArchive')")+action('مشتریان',"go('customers')");
};
helpTopics.unshift(
 ['شروع کار','در اولین ورود نام کسب‌وکار را برای سربرگ فاکتور وارد کن. نام شخصی و موبایل در بخش بازشدنی پروفایل اختیاری‌اند. اطلاعات روی همین گوشی ذخیره می‌شوند. برای انتقال به گوشی جدید از پشتیبان استفاده کن.'],
 ['عنوان و شرایط پرداخت','عنوان بالای سند در فرم فاکتور قابل ویرایش است. نوع پرداخت را نقدی، چکی یا اقساطی انتخاب کن. برای اقساط تعداد، پیش‌پرداخت توافق‌شده و سررسیدها را وارد کن. این توافق، پول دریافتی را ثبت نمی‌کند؛ برای دریافت واقعی از ثبت پرداخت استفاده کن.'],
 ['انتخاب مخاطب گوشی','در مشخصات مشتری فاکتور، «انتخاب از مخاطبان گوشی» را بزن و شمارهٔ موردنظر را در انتخابگر گوشی انتخاب کن. نام و شماره وارد فرم می‌شوند.'],
 ['گزارش فروش','در منو «گزارش فروش و دریافتی» را باز کن و امروز، هفت روز، سی روز یا تاریخ دلخواه را انتخاب کن. فروش بر اساس تاریخ فاکتور و پول دریافتی بر اساس تاریخ دریافت محاسبه می‌شوند.'],
 ['شروع کار و پروفایل','در اولین ورود نام کسب‌وکار، شغل و واحد پول را مشخص کن. لوگو را از تنظیمات اضافه کن.'],
 ['خانه و منو','خانه برای ساخت فاکتور و جست‌وجوی سریع است. از دکمهٔ منو، کالا و خدمات، گزارش، پشتیبان و تنظیمات را باز کن.'],
 ['کالاهای ذخیره‌شده','از منو «کالا و خدمات» قلم و قیمت را ذخیره کن. در فاکتور از فهرست انتخابش کن و قیمت همان فاکتور را ویرایش کن.']
);

function paymentTermsEditor(){
 const b=billDraft,mode=b.paymentMode||'نقدی',count=b.installmentCount||2;
 const dates=b.installmentDates||[];
 return '<section class="bill-panel"><h2>شرایط پرداخت</h2>'+
 select('نوع پرداخت','paymentMode',['نقدی','چکی','اقساطی'],mode,'data-bill="paymentMode"')+
 '<p><small>این بخش توافق پرداخت را ثبت می‌کند. وجه دریافت‌شده را بعداً از «ثبت پرداخت» وارد کن.</small></p>'+
 (mode==='چکی'?input('تاریخ سررسید چک (شمسی)','checkDue',b.checkDue,'data-bill="checkDue" placeholder="۱۴۰۵/۰۹/۳۰"')+
 input('شماره یا شناسه چک (اختیاری)','checkNumber',b.checkNumber,'data-bill="checkNumber"')+
 input('بانک (اختیاری)','checkBank',b.checkBank,'data-bill="checkBank"'):'')+
 (mode==='اقساطی'?select('تعداد اقساط','installmentCount',Array.from({length:60},(_,i)=>[String(i+1),fmt(i+1)]),String(count),'onchange="setInstallmentCount(this.value)"')+
 input('پیش‌پرداخت توافق‌شده ('+b.unit+')','planAdvance',b.planAdvance,'inputmode="decimal" data-bill="planAdvance"')+
 '<p>باقی مبلغ بین اقساط تقسیم می‌شود. سررسید هر قسط را وارد کن.</p>'+
 Array.from({length:count},(_,i)=>input('سررسید قسط '+fmt(i+1)+' (شمسی)','due'+i,dates[i]||'','data-due="'+i+'" placeholder="۱۴۰۵/۰۹/۳۰"')).join(''):'')+'</section>';
}
function setInstallmentCount(value){
 const n=Number(value);
 if(!Number.isInteger(n)||n<1||n>60)return;
 billDraft.installmentCount=n;
 billDraft.installmentDates=Array.from({length:n},(_,i)=>billDraft.installmentDates?.[i]||'');
 safe(billSaveDraft);render();
}
function buildPaymentPlan(b,total,strict){
 const mode=b.paymentMode||'نقدی';
 if(mode==='نقدی')return {mode};
 if(mode==='چکی'){
  const due=C.date(b.checkDue||'');
  if(strict&&!due)throw Error('تاریخ سررسید چک را وارد کن.');
  return {mode,due,number:(b.checkNumber||'').trim(),bank:(b.checkBank||'').trim(),amount:total};
 }
 const count=Number(b.installmentCount||2),advance=C.amount(b.planAdvance||'',b.unit);
 if(!Number.isInteger(count)||count<1||count>60)throw Error('تعداد اقساط باید بین ۱ تا ۶۰ باشد.');
 if(advance>=total&&strict)throw Error('برای پرداخت اقساطی، پیش‌پرداخت باید کمتر از جمع فاکتور باشد.');
 if(advance>total)throw Error('پیش‌پرداخت از جمع فاکتور بیشتر است.');
 const left=total-advance,base=Math.floor(left/count);
 if(strict&&base<1)throw Error('مبلغ فاکتور برای این تعداد قسط کافی نیست.');
 let last='';
 const installments=Array.from({length:count},(_,i)=>{
  const on=C.date(b.installmentDates?.[i]||'');
  if(strict&&!on)throw Error('سررسید قسط '+fmt(i+1)+' را وارد کن.');
  if(on&&last&&on<=last)throw Error('سررسید اقساط باید به ترتیب و متفاوت باشند.');
  if(on)last=on;
  return {on,amount:base+(i===count-1?left-base*count:0)};
 });
 return {mode,advance,installments};
}
function paymentPlanLines(d){
 const p=d.paymentPlan,m=n=>money(n,d.shop.unit);
 if(!p)return [];
 if(p.mode==='نقدی')return ['شرایط پرداخت: نقدی'];
 if(p.mode==='چکی')return ['شرایط پرداخت: چکی','مبلغ چک: '+m(p.amount),'سررسید: '+C.day(p.due),
 p.number?'شناسه چک: '+p.number:'',p.bank?'بانک: '+p.bank:''].filter(Boolean);
 return ['شرایط پرداخت: اقساطی','پیش‌پرداخت توافق‌شده: '+m(p.advance),
 ...p.installments.map((v,i)=>'قسط '+fmt(i+1)+' · '+C.day(v.on)+' · '+m(v.amount))];
}
function paymentPlanHtml(d){
 const lines=paymentPlanLines(d);if(!lines.length)return '';
 return '<section class="payment-plan"><h3>شرایط پرداخت</h3>'+lines.map(v=>'<p>'+esc(v)+'</p>').join('')+'</section>';
}
render();

