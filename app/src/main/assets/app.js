'use strict';
const C=Core, app=document.querySelector('#app'), key='sefareshyar-v1';
const uid=()=>crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iranToday=()=>C.isoAtIran();
const statuses=['پیش‌نویس','ثبت‌شده','در حال انجام','آماده','تحویل‌شده','لغوشده'];
const types=['پیش‌فاکتور','فاکتور فروش','رسید پرداخت'];
const defaults={
 'فروش کالا':['روش ارسال'], 'خدمات':['نوع خدمت','تاریخ مراجعه','محل انجام کار','اجرت'],
 'تعمیرات':['دستگاه','مدل','سریال','شرح مشکل','قطعات','موعد تحویل'],
 'عمده‌فروشی':['تعداد کارتن/بسته','تعداد در بسته','نرخ عمده','نشانی انبار'],
 'سفارش سفارشی':['رنگ','اندازه','مشخصات','موعد تحویل']
};
const fresh=()=>({version:1,seq:0,shop:{name:'',unit:'تومان',paper:'A4',layout:'جدولی',color:'#096b60',logoSide:'چپ',prefix:'SY',showPhone:true,showAddress:true,showTerms:true,showBank:false},customers:[],orders:[],docs:[],catalog:[],templates:Object.entries(defaults).map(([name,labels],i)=>({id:'template-'+i,name,version:1,fields:labels.map(label=>({id:uid(),label,type:label.startsWith('تاریخ')||label.startsWith('موعد')?'date':'text',visible:false,required:false}))})),defaultTemplate:'template-0'});
const state={
 get:k=>window.Android?Android.readState(k):localStorage.getItem(k),
 set(k,value){if(window.Android){if(!Android.writeState(k,value))throw Error('نوشتن در حافظهٔ داخلی ممکن نبود.');}else localStorage.setItem(k,value);}
};
let db=JSON.parse(state.get(key)??'null')||fresh();
let draft=db.draft??null;
let page='home', current='', filter='', timer, stagedBackup=null;
const clone=v=>JSON.parse(JSON.stringify(v));
function commit(edit){const next={...clone(db),draft:clone(draft)};const result=edit(next);state.set(key,JSON.stringify(next));db=next;return result;}
function saveDraft(){try{commit(()=>{});}catch(e){notice(e.message);}}
function notice(message){const el=document.querySelector('#notice');el.textContent=message;clearTimeout(timer);timer=setTimeout(()=>el.textContent='',3800);}
function safe(fn){try{return fn();}catch(e){notice(e.message);}}
function go(next,id=''){page=next;current=id;filter='';render();window.scrollTo(0,0);}
const customer=id=>db.customers.find(c=>c.id===id);
const order=id=>db.orders.find(o=>o.id===id);
const template=id=>db.templates.find(t=>t.id===id)||db.templates[0];
const money=(n,u=db.shop.unit)=>C.money(n,u);
const fmt=n=>new Intl.NumberFormat('fa-IR').format(n);
const idjs=id=>esc(JSON.stringify(id));
const action=(label,code,cls='')=>'<button class="'+cls+'" type="button" onclick="'+code+'">'+esc(label)+'</button>';
const row=(...s)=>'<div class="row">'+s.join('')+'</div>';
const card=s=>'<div class="card">'+s+'</div>';
const details=(title,body)=>'<details><summary>'+esc(title)+'</summary>'+body+'</details>';
const val=(f,n)=>String(new FormData(f).get(n)||'').trim();
const opts=(values,selected)=>values.map(v=>{const [id,label]=Array.isArray(v)?v:[v,v];return '<option value="'+esc(id)+'" '+(id===selected?'selected':'')+'>'+esc(label)+'</option>';}).join('');
const input=(label,name,value='',extra='')=>'<label>'+esc(label)+'<input name="'+name+'" value="'+esc(value)+'" '+extra+'></label>';
const area=(label,name,value='')=>'<label>'+esc(label)+'<textarea name="'+name+'">'+esc(value)+'</textarea></label>';
const select=(label,name,values,selected,extra='')=>'<label>'+esc(label)+'<select name="'+name+'" '+extra+'>'+opts(values,selected)+'</select></label>';
const check=(label,name,value)=>'<label><input type="checkbox" name="'+name+'" '+(value?'checked':'')+'> '+esc(label)+'</label>';
const submit=label=>'<button class="primary">'+esc(label)+'</button><p class="error" role="alert"></p>';
const form=(handler,body)=>'<form onsubmit="handle(event,'+handler+')">'+body+'</form>';
async function handle(event,handler){event.preventDefault();const f=event.currentTarget,b=f.querySelector('button.primary'),err=f.querySelector('.error');if(b?.disabled)return;if(err)err.textContent='';if(b)b.disabled=true;try{await handler(f);}catch(e){if(err)err.textContent=e.message;else notice(e.message);}finally{if(b)b.disabled=false;}}
const tile=(label,n)=>card('<small>'+label+'</small><span class="metric">'+n+'</span>');
function home(){
 const active=db.orders.filter(o=>statuses.slice(1,4).includes(o.status)), today=iranToday();
 const balance=db.orders.filter(o=>o.status!=='لغوشده').reduce((n,o)=>n+C.totals(o).total-C.paid(o),0);
 return '<div class="hero card"><h1>مدیریت سفارش‌ها</h1><p>'+C.day(today)+'</p>'+row(action('فاکتور سریع',"startOrder('',true)"),action('سفارش جدید',"startOrder()"))+'</div>'+
 '<div class="grid">'+tile('سفارش باز',fmt(active.length))+tile('تحویل امروز',fmt(active.filter(o=>o.due===today).length))+tile('عقب‌افتاده',fmt(active.filter(o=>o.due&&o.due<today).length))+tile('ماندهٔ دریافتنی',money(balance))+'</div>'+
 row(draft?action('ادامهٔ پیش‌نویس',"go('editor')"):'',action('مشاور آنلاین',"go('help')"));
}
function searchBox(text){return input(text,'search',filter,'type="search" oninput="runSearch(this.value)"');}
function runSearch(value){filter=value;const target=document.querySelector('#results');if(target)target.innerHTML=listResults();}
function listPage(title,button,placeholder){return '<h1>'+title+'</h1>'+row(button)+searchBox(placeholder)+'<div class="list" id="results">'+listResults()+'</div>';}
function orderCard(o){const total=C.totals(o).total;return card('<h3>'+esc(customer(o.cid)?.name)+' · '+esc(o.number)+'</h3><small>'+esc(o.status)+' | تحویل '+C.day(o.due)+'</small><p>مانده '+money(total-C.paid(o),o.unit)+'</p>'+action('باز کردن',"go('order',"+idjs(o.id)+")"));}
function listResults(){
 const q=C.norm(filter);
 if(page==='customers'){
   const rows=db.customers.filter(c=>!c.archived&&(!q||C.norm(c.name).includes(q)||[c.phone,c.phone2].some(p=>C.phone(p).includes(C.phone(filter))&&C.phone(filter))));
   return rows.map(c=>card('<h3>'+esc(c.name)+'</h3><small>'+esc(c.phone)+'</small>'+row(action('پرونده',"go('customer',"+idjs(c.id)+")")))).join('')||card('مشتری پیدا نشد. برای شروع «مشتری جدید» را بزنید.');
 }
 if(page==='orders')return db.orders.filter(o=>(!q||C.norm([customer(o.cid)?.name,o.number,o.status,C.editableDay(o.due),C.day(o.due)].join(' ')).includes(q))).slice().reverse().map(orderCard).join('')||card('سفارشی پیدا نشد. برای شروع «سفارش جدید» را بزنید.');
 return db.docs.filter(d=>!q||C.norm([d.type,d.number,d.customer.name,C.editableDay(d.on),C.day(d.on)].join(' ')).includes(q)).slice().reverse().map(d=>card('<h3>'+esc(d.type)+' '+esc(d.number)+'</h3><p>'+esc(d.customer.name)+' · '+C.day(d.on)+'</p>'+action('نمایش سند',"go('document',"+idjs(d.id)+")"))).join('')||card('سندی پیدا نشد. از صفحهٔ سفارش سند صادر کنید.');
}
const customerFields=[['شخص رابط','contact'],['تلفن دوم','phone2'],['استان','province'],['شهر','city'],['محله','district'],['کد پستی','postal'],['برچسب','tag'],['فیلد اختصاصی','extra']];
function customerForm(){
 const c=customer(current)||{addresses:[]};
 const addresses=[...c.addresses,{label:'',value:''}];
 return '<h1>مشخصات مشتری</h1>'+form('saveCustomer',
 input('نام مشتری','name',c.name,'required')+input('موبایل','phone',c.phone,'inputmode="tel"')+
 (window.Android?action('انتخاب از مخاطبان گوشی','Android.pickContact()'):'')+
 details('اطلاعات تکمیلی',customerFields.map(([label,k])=>input(label,k,c[k])).join('')+input('تاریخ تولد شمسی','birthday',C.editableDay(c.birthday))+area('یادداشت داخلی','note',c.note))+
 addresses.map((a,i)=>details('نشانی '+fmt(i+1),input('برچسب نشانی','l'+i,a.label)+area('نشانی','a'+i,a.value))).join('')+submit('ذخیرهٔ مشتری'));
}
function saveCustomer(f){
 const old=customer(current), phone=iranMobile(val(f,'phone')), name=val(f,'name');
 if(!name)throw Error('نام مشتری را وارد کنید.');
 const match=db.customers.find(c=>c.id!==old?.id&&phone&&C.phone(c.phone)===phone);
 if(match&&!confirm('این شماره برای «'+match.name+'» ثبت شده است. پرونده‌ای جدا ذخیره شود؟')){go('customer',match.id);return;}
 const c={...old,id:old?.id||uid(),created:old?.created||iranToday(),name,phone,note:val(f,'note'),birthday:C.date(val(f,'birthday')),addresses:[]};
 for(const [,k] of customerFields)c[k]=k==='phone2'&&val(f,k).replace(/\D/g,'').startsWith('09')?iranMobile(val(f,k)):val(f,k);
 for(let i=0;i<(old?.addresses.length||0)+1;i++){const value=val(f,'a'+i);if(value)c.addresses.push({label:val(f,'l'+i)||'نشانی '+fmt(i+1),value});}
 commit(n=>{n.customers=n.customers.filter(v=>v.id!==c.id).concat(c);});go('customer',c.id);
}
function receiveContact(name,phone){
 if(page==='billEdit'&&billDraft){
   billDraft.customer=name||billDraft.customer;billDraft.phone=C.phone(phone);
   billSaveDraft();render();return;
 }
 if(page!=='customerEdit')return;
 const f=app.querySelector('form');f.elements.name.value=name||f.elements.name.value;f.elements.phone.value=C.phone(phone);
}
function customerPage(){
 const c=customer(current), orders=db.orders.filter(o=>o.cid===c.id);
 const due=orders.filter(o=>o.status!=='لغوشده').reduce((n,o)=>n+C.totals(o).total-C.paid(o),0);
 return '<h1>'+esc(c.name)+'</h1>'+card('<p>'+esc(c.phone)+' '+esc(c.city)+'</p><p>ثبت '+C.day(c.created)+' · آخرین خرید '+C.day(orders.map(o=>o.on).sort().at(-1))+'</p><p>مانده '+money(due)+'</p>'+
 row(action('سفارش جدید','startOrder('+idjs(c.id)+')'),action('ویرایش',"go('customerEdit',"+idjs(c.id)+")"),action('اکسل پرونده','exportCustomer('+idjs(c.id)+')'),action(c.archived?'بازگردانی':'بایگانی','archiveCustomer('+idjs(c.id)+')')))+
 '<h2>سفارش‌ها</h2>'+orders.slice().reverse().map(orderCard).join('')+'<h2>اسناد</h2>'+
 db.docs.filter(d=>orders.some(o=>o.id===d.orderId)).map(d=>card(action(d.type+' '+d.number,"go('document',"+idjs(d.id)+")"))).join('')+
 '<h2>پرداخت‌ها</h2>'+orders.flatMap(o=>o.payments.map(p=>card(esc(o.number)+' · '+C.day(p.on)+' · '+money(p.amount,o.unit)+(p.void?' · باطل‌شده':'')))).join('');
}
function archiveCustomer(id){safe(()=>{commit(n=>{const c=n.customers.find(v=>v.id===id);c.archived=!c.archived;});render();});}
const blankItem=()=>({name:'',qty:'1',price:0,code:'',unit:''});
function startOrder(cid='',quick=false,copy='',edit=''){
 if(draft&&!confirm('پیش‌نویس فعلی جایگزین شود؟')){go('editor');return;}
 const source=order(edit||copy), t=template(source?.tid||db.defaultTemplate);
 draft={id:edit||uid(),cid:cid||source?.cid||'',newName:'',lookup:'',quick,unit:source?.unit||db.shop.unit,tid:t.id,templateVersion:edit?source.templateVersion:t.version,
 requirePhone:edit?source.requirePhone:!!t.requirePhone,requireAddress:edit?source.requireAddress:!!t.requireAddress,
 items:source?clone(source.items):[blankItem()],fields:source?source.fields.map(f=>({...f,value:f.type==='date'?C.editableDay(f.value):f.value})):t.fields.map(f=>({...f,value:''})),address:source?.address||'',due:edit?C.editableDay(source.due):'',validUntil:edit?C.editableDay(source.validUntil):'',note:source?.note||'',shipping:source?.shipping||0,discount:source?.discount||0,discountMode:source?.discountMode||'amount',discountPercent:source?.discountPercent||''};
 saveDraft();go('editor');
}
function changeDraft(k,v){draft[k]=v;saveDraft();}
function changeCustomer(id){draft.cid=id;draft.address='';saveDraft();render();}
function changeLookup(value){changeDraft('lookup',value);renderCustomerOpts();}
function renderCustomerOpts(){
 const q=C.norm(draft.lookup), el=document.querySelector('#customer-options');
 if(el)el.innerHTML=opts([['','مشتری جدید / انتخاب نشده'],...db.customers.filter(c=>c.id===draft.cid||(!c.archived&&(!q||C.norm(c.name).includes(q)||(C.phone(q)&&C.phone(c.phone).includes(C.phone(q)))))).map(c=>[c.id,c.name+(c.phone?' · '+c.phone:'')])],draft.cid);
}
function setTemplate(id){
 const t=template(id);
 draft.tid=t.id;draft.templateVersion=t.version;draft.requirePhone=!!t.requirePhone;draft.requireAddress=!!t.requireAddress;
 draft.fields=t.fields.map(f=>({...f,value:draft.fields.find(existing=>existing.id===f.id)?.value||''}));
 saveDraft();render();
}
function updateItem(i,k,value){draft.items[i][k]=value;saveDraft();draftSummary();}
function addItem(){draft.items.push(blankItem());saveDraft();render();}
function removeItem(i){draft.items.splice(i,1);saveDraft();render();}
const displayAmount=(n,u)=>typeof n==='string'?n:String(u==='تومان'?n/10:n);
function itemEditor(item,i){
 const update=k=>'oninput="updateItem('+i+',\''+k+'\',this.value)"';
 return card('<h3>قلم '+fmt(i+1)+'</h3>'+
 (db.catalog.length?select('انتخاب از فهرست','catalog',[['','انتخاب کنید'],...db.catalog.map(c=>[c.id,c.name])],'','onchange="catalogPick('+i+',this.value)"'):'')+
 input('نام کالا یا خدمت','item-name',item.name,update('name')+' required')+input('تعداد','quantity',item.qty,update('qty')+' inputmode="decimal" required')+input('قیمت واحد ('+draft.unit+')','price',displayAmount(item.price,draft.unit),update('price')+' inputmode="numeric" required')+
 details('کد و واحد',input('کد','code',item.code,update('code'))+input('واحد','unit',item.unit,update('unit')))+
 (draft.items.length>1?action('حذف قلم','removeItem('+i+')','danger'):''));
}
function catalogPick(i,id){const c=db.catalog.find(x=>x.id===id);if(c){draft.items[i]={...draft.items[i],name:c.name,price:c.price,code:c.code,unit:c.unit};saveDraft();render();}}
const fieldKinds=[['text','متن'],['number','عدد'],['date','تاریخ'],['choice','فهرست گزینه‌ها'],['boolean','بله/خیر']];
function fieldEditor(f,i){
 const attrs='oninput="editField('+i+',this.value)" '+(f.required?'required':'');
 if(f.type==='choice'||f.type==='boolean')return select(f.label,'custom',[['','انتخاب کنید'],...(f.type==='boolean'?['بله','خیر']:f.options||[])],f.value,attrs);
 return input(f.label+(f.visible?' (در سند)':''),'custom',f.value,attrs+(f.type==='number'?' inputmode="decimal"':'')+(f.type==='date'?' placeholder="۱۴۰۵/۰۸/۲۶"':''));
}
function editField(i,value){draft.fields[i].value=value;saveDraft();}
function editor(){
 if(!draft)return card('پیش‌نویسی وجود ندارد.');
 const c=customer(draft.cid), u=draft.unit, update=k=>'oninput="changeDraft(\''+k+'\',this.value);draftSummary()"';
 const related=order(draft.id);
 return '<h1>'+(draft.quick?'فاکتور سریع':related?'ویرایش سفارش':'سفارش جدید')+'</h1>'+form('saveOrder',
 card(input('جست‌وجوی مشتری با نام یا تلفن','lookup',draft.lookup,'oninput="changeLookup(this.value)"')+
 '<label>مشتری<select id="customer-options" onchange="changeCustomer(this.value)"></select></label>'+
 (c?select('نشانی تحویل','address',[['','انتخاب کنید'],...c.addresses.map(a=>[a.value,a.label+' · '+a.value]),...(draft.address&&!c.addresses.some(a=>a.value===draft.address)?[[draft.address,draft.address]]:[])],draft.address,update('address')):input('نام مشتری جدید','newName',draft.newName,update('newName')+' required')))+
 draft.items.map(itemEditor).join('')+row(action('افزودن قلم','addItem()'))+
 details('تخفیف، ارسال و تاریخ',select('نوع تخفیف','discountMode',[['amount','مبلغ'],['percent','درصد']],draft.discountMode,'onchange="changeDraft(\'discountMode\',this.value);render()"')+
 (draft.discountMode==='percent'?input('درصد تخفیف','discountPercent',draft.discountPercent,update('discountPercent')+' inputmode="decimal"'):input('مبلغ تخفیف','discount',displayAmount(draft.discount,u),update('discount')+' inputmode="numeric"'))+
 input('هزینهٔ ارسال','shipping',displayAmount(draft.shipping,u),update('shipping')+' inputmode="numeric"')+
 input('تحویل شمسی','due',draft.due,update('due')+' placeholder="۱۴۰۵/۰۸/۲۶"')+input('اعتبار پیش‌فاکتور شمسی','validUntil',draft.validUntil,update('validUntil'))+
 '<label>یادداشت داخلی<textarea oninput="changeDraft(\'note\',this.value)">'+esc(draft.note)+'</textarea></label>')+
 details('قالب و فیلدهای سفارش',select('فرم ثبت','template',db.templates.map(t=>[t.id,t.name]),draft.tid,'onchange="setTemplate(this.value)"')+
 draft.fields.map(fieldEditor).join('')+row(action('افزودن فیلد',"document.querySelector('#fieldForm').open=true")))+
 '<div class="card" id="draft-total" aria-live="polite"></div>'+submit(draft.quick?'پیش‌نمایش فاکتور':'ثبت سفارش'))+
 '<details id="fieldForm"><summary>افزودن فیلد</summary>'+form('addField',input('عنوان فیلد','label','','required')+select('نوع فیلد','kind',fieldKinds,'text')+input('گزینه‌ها (با ویرگول)','options')+
 select('دامنه','scope',[['one','فقط همین سفارش'],['template','در این قالب ذخیره شود']],'one')+check('اجباری','required',false)+check('نمایش در سند مشتری','visible',false)+submit('افزودن'))+'</details>'+
 row(action('راهنما',"go('help')"),action('حذف پیش‌نویس',"if(confirm('پیش‌نویس حذف شود؟')){draft=null;saveDraft();go('home')}","danger"));
}
function addField(f){
 const label=val(f,'label'),type=val(f,'kind'), options=val(f,'options').split(/[,،]/).map(v=>v.trim()).filter(Boolean);
 if(!label||type==='choice'&&!options.length)throw Error('عنوان و گزینه‌های لازم را وارد کنید.');
 const field={id:uid(),label,type,options,required:f.elements.required.checked,visible:f.elements.visible.checked};
 if(val(f,'scope')==='template'){draft.templateVersion=commit(n=>{const t=n.templates.find(t=>t.id===draft.tid);t.fields.push(field);return ++t.version;});}
 draft.fields.push({...field,value:''});saveDraft();render();
}
function buildOrder(){
 const previous=order(draft.id), u=draft.unit;
 const amount=v=>typeof v==='number'?v:C.amount(v,u);
 return {id:draft.id,cid:draft.cid,number:previous?.number||'',on:previous?.on||iranToday(),status:previous?.status||'ثبت‌شده',unit:u,tid:draft.tid,templateVersion:draft.templateVersion,requirePhone:draft.requirePhone,requireAddress:draft.requireAddress,note:draft.note,address:draft.address,
 due:C.date(draft.due),validUntil:C.date(draft.validUntil),shipping:amount(draft.shipping),discount:amount(draft.discount),discountMode:draft.discountMode,discountPercent:draft.discountPercent,taxRate:previous?.taxRate||'',
 items:draft.items.map(x=>({...x,name:x.name.trim(),price:amount(x.price)})),payments:previous?.payments||[],fields:draft.fields.map(f=>{
   if(f.required&&!f.value.trim())throw Error('فیلد «'+f.label+'» را پر کنید.');
   if(f.type==='number'&&f.value&&!/^-?\d+([.٫]\d+)?$/.test(C.latin(f.value)))throw Error('عدد فیلد «'+f.label+'» معتبر نیست.');
   return {...f,value:f.type==='date'?C.date(f.value):f.value};
 })};
}
function draftSummary(){const el=document.querySelector('#draft-total');if(!el)return;try{const o=buildOrder(),t=C.totals(o);el.textContent='جمع اقلام '+money(t.subtotal,o.unit)+' · قابل پرداخت '+money(t.total,o.unit);}catch(e){el.textContent=e.message;}}
function saveOrder(){
 const o=buildOrder(), total=C.totals(o).total, quick=draft.quick, existing=order(o.id);
 if(o.items.some(x=>!x.name))throw Error('نام هر قلم الزامی است.');
 if(total<C.paid(o))throw Error('جمع سفارش از پرداخت‌های تأییدشده کمتر است.');
 if(existing&&db.docs.some(d=>d.orderId===o.id)&&!confirm('ویرایش سفارش ذخیره شود؟ برای تغییر سند صادرشده، نسخهٔ جدید صادر کنید.'))return;
 commit(n=>{
   if(!o.cid){
     const name=draft.newName.trim();if(!name)throw Error('نام مشتری را وارد کنید.');
     const cid=uid();n.customers.push({id:cid,name,phone:'',addresses:[],created:iranToday()});o.cid=cid;
   }
   o.number=o.number||'O-'+(++n.seq);
   if(existing)n.orders=n.orders.map(x=>x.id===o.id?o:x);else n.orders.push(o);
   n.draft=null;
 });
 draft=null;if(quick)invoicePreview(o.id);else go('order',o.id);
}
function orderPage(){
 const o=order(current), c=customer(o.cid), t=C.totals(o), paid=C.paid(o), balance=t.total-paid;
 return '<h1>سفارش '+esc(o.number)+'</h1>'+card('<h2>'+esc(c.name)+'</h2><p>تحویل '+C.day(o.due)+' · '+esc(o.address)+'</p>'+
 select('وضعیت سفارش','status',statuses,o.status,'onchange="setStatus(this.value)"')+
 '<p>جمع '+money(t.total,o.unit)+' · پرداخت '+money(paid,o.unit)+' · مانده '+money(balance,o.unit)+'</p><p>'+(!balance?'تسویه‌شده':paid?'بخشی پرداخت شده':'پرداخت نشده')+'</p>'+
 row(action('پیش‌نمایش فاکتور',"invoicePreview(current)",'primary'),action('ویرایش سفارش',"startOrder('',false,'',current)"),action('کپی سفارش',"startOrder('',false,current)")))+
 card(o.items.map((x,i)=>'<p>'+esc(x.name)+' · '+esc(x.qty)+' '+esc(x.unit)+' · '+money(t.lines[i],o.unit)+'</p>').join(''))+
 details('ثبت پرداخت',form('savePayment',input('مبلغ ('+o.unit+')','amount','','required inputmode="numeric"')+input('تاریخ شمسی','on',C.editableDay(iranToday()))+
 select('روش','method',['کارت','نقد','واریز','سایر'],'کارت')+input('پیگیری','reference')+area('توضیح داخلی','note')+submit('ثبت پرداخت')))+
 o.payments.slice().reverse().map(p=>card('<p>'+C.day(p.on)+' · '+money(p.amount,o.unit)+' · '+esc(p.method)+(p.void?' · باطل‌شده':'')+'</p>'+
 row(p.void?'':action('رسید','receipt('+idjs(p.id)+')'),p.void?'':action('ابطال پرداخت','voidPayment('+idjs(p.id)+')','danger')))).join('')+
 db.docs.filter(d=>d.orderId===o.id).map(d=>card(action(d.type+' '+d.number,"go('document',"+idjs(d.id)+")"))).join('');
}
function setStatus(status){safe(()=>{commit(n=>n.orders.find(o=>o.id===current).status=status);render();});}
function recordPayment(orderId,f){
 const o=order(orderId), amount=C.amount(val(f,'amount'),o.unit), on=C.date(val(f,'on'))||iranToday();
 const balance=C.totals(o).total-C.paid(o)-amount;
 if(amount<=0||balance<0)throw Error('مبلغ پرداخت باید بزرگ‌تر از صفر و حداکثر برابر مانده باشد.');
 commit(n=>n.orders.find(x=>x.id===o.id).payments.push({id:uid(),amount,on,balance,method:val(f,'method'),reference:val(f,'reference'),note:val(f,'note')}));
}
function savePayment(f){
 recordPayment(current,f);
 render();
}
function voidPayment(id){
 if(!confirm('پرداخت با ثبت سابقه باطل شود؟'))return;
 safe(()=>{commit(n=>{const p=n.orders.find(o=>o.id===current).payments.find(p=>p.id===id);p.void=true;p.voidOn=iranToday();n.docs.filter(d=>d.payment?.id===id).forEach(d=>d.voidOn=p.voidOn);});render();});
}
let previewType=types[1], receiptId='';
function invoicePreview(id){previewType=types[1];receiptId='';go('preview',id);}
function receipt(id){
 const d=db.docs.find(d=>d.payment?.id===id);
 if(d){go('document',d.id);return;}
 previewType=types[2];receiptId=id;go('preview',current);
}
function buildSnapshot(o,type,num,shop=db.shop,payment){
 return C.snapshot(o,customer(o.cid),{...shop,unit:o.unit},type,num,iranToday(),payment);
}
function sheet(d){
 const s=d.shop,t=d.summary,p=d.payment, m=n=>money(n,s.unit);
 const meta=(title,value)=>value?'<div><strong>'+title+'</strong> '+esc(value)+'</div>':'';
 const img=(src,label)=>/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src||'')?'<img src="'+src+'" alt="'+label+'">':'';
 const logo=img(s.logo,'لوگو'), head='<div><h2>'+esc(s.name||'نام کسب‌وکار')+'</h2>'+meta('تلفن',s.phone)+meta('نشانی',s.address)+meta('وب‌سایت',s.website)+'</div>';
 const rows=d.items.map((i,k)=>'<tr><td>'+esc(i.name)+(i.code?' · '+esc(i.code):'')+'</td><td>'+esc(i.qty)+' '+esc(i.unit)+'</td><td>'+m(i.price)+'</td><td>'+m(t.lines[k])+'</td></tr>').join('');
 return '<article class="sheet"><div class="head" style="color:'+(/^#[0-9a-f]{6}$/i.test(s.color)?s.color:'#096b60')+'">'+(s.logoSide==='راست'?logo+head:head+logo)+'</div><hr><h1>'+esc(d.type)+'</h1>'+
 meta('شماره',d.number)+meta('تاریخ',C.day(d.on))+meta('واحد پول',s.unit)+meta('مشتری',d.customer.name)+meta('تلفن مشتری',d.customer.phone)+meta('نشانی تحویل',d.customer.address)+
 (d.type===types[0]&&d.validUntil?meta('اعتبار تا',C.day(d.validUntil)):'')+(d.voidOn?meta('تاریخ ابطال',C.day(d.voidOn)):'')+
 (p?'<section>'+meta('مبلغ دریافت‌شده',m(p.amount))+meta('روش',p.method)+meta('تاریخ پرداخت',C.day(p.on))+meta('پیگیری',p.reference)+meta('مانده پس از پرداخت',m(p.balance))+'</section>':
 '<section class="tablewrap">'+(s.layout==='ساده'?d.items.map((i,k)=>'<p>'+esc(i.name)+' · '+esc(i.qty)+' '+esc(i.unit)+' × '+m(i.price)+' · '+m(t.lines[k])+'</p>').join(''):'<table><thead><tr><th>شرح</th><th>تعداد</th><th>قیمت واحد</th><th>جمع</th></tr></thead><tbody>'+rows+'</tbody></table>')+'</section>'+
 '<section class="total">'+meta('جمع اقلام',m(t.subtotal))+meta('تخفیف',m(t.discount))+meta('ارسال',m(t.shipping))+meta('قابل پرداخت',m(t.total))+'</section>')+
 d.visible.map(f=>meta(esc(f.label),f.value)).join('')+meta('واریز',s.bank)+meta('شرایط',s.terms)+img(s.stamp,'مهر یا امضا')+'</article>';
}
function preview(){
 const o=order(current), p=previewType===types[2]?o.payments.find(x=>x.id===receiptId):null;
 const d=buildSnapshot(o,previewType,'پیش‌نمایش',db.shop,p);
 return '<div class="tools">'+form('issue',
 (p?'':select('نوع سند','type',types.slice(0,2),previewType,'onchange="previewType=this.value;render()"'))+
 (!db.shop.name?input('نام کسب‌وکار','shop','','required'):'')+
 select('طرح سند','layout',['جدولی','ساده'],db.shop.layout,'onchange="refreshSheet(this.form)"')+
 select('اندازهٔ کاغذ','paper',['A4','A5'],db.shop.paper,'onchange="refreshSheet(this.form)"')+submit('صدور سند'))+
 row(action('بازگشت به سفارش',"go('order',current)"),action('راهنما',"go('help')"))+'</div><div id="preview-sheet">'+sheet(d)+'</div>';
}
function refreshSheet(f){
 const o=order(current), p=previewType===types[2]?o.payments.find(x=>x.id===receiptId):null;
 document.querySelector('#preview-sheet').innerHTML=sheet(buildSnapshot(o,previewType,'پیش‌نمایش',{...db.shop,layout:val(f,'layout'),paper:val(f,'paper')},p));
}
function issue(f){
 const o=order(current),c=customer(o.cid),type=previewType,p=type===types[2]?o.payments.find(x=>x.id===receiptId&&!x.void):null;
 if(type===types[2]&&!p)throw Error('پرداخت معتبر پیدا نشد.');
 if((db.shop.requirePhone||o.requirePhone)&&!c.phone)throw Error('برای این سند تلفن مشتری را در پرونده وارد کنید.');
 if((db.shop.requireAddress||o.requireAddress)&&!o.address)throw Error('برای این سند نشانی تحویل را وارد کنید.');
 const id=commit(n=>{
   if(!n.shop.name)n.shop.name=val(f,'shop');
   if(!n.shop.name)throw Error('نام کسب‌وکار را وارد کنید.');
   const prefix=n.shop.prefix||'SY';
   const number=prefix+'-'+(++n.seq);
   const d=buildSnapshot(o,type,number,{...n.shop,layout:val(f,'layout'),paper:val(f,'paper')},p);
   d.id=uid();n.docs.push(d);return d.id;
 });
 previewType=types[1];receiptId='';go('document',id);
}
function documentPage(){
 const d=db.docs.find(d=>d.id===current);
 return '<div class="tools">'+row(action('ذخیرهٔ PDF',"outputDoc('save')",'primary'),action('ارسال فاکتور',"outputDoc('share')"),action('ارسال تصویر',"outputDoc('image')"),action('چاپ',"outputDoc('print')"),action('بازگشت به سفارش',"go('order',"+idjs(d.orderId)+")"))+'</div>'+sheet(d);
}
function outputDoc(mode){
 const d=db.docs.find(x=>x.id===current);
 if(window.Android){
   const filename=(d.type+'-'+d.number).replace(/[\\/:*?"<>|]/g,'-');
   Android.document(JSON.stringify(pdfData(d)),filename,d.shop.paper,mode);
 }else if(mode==='print'||mode==='save'){window.print();}else{notice('ارسال مستقیم در نسخهٔ اندروید در دسترس است. در مرورگر PDF را ذخیره و پیوست کنید.');}
}
function pdfData(d){
 const s=d.shop,t=d.summary,p=d.payment,m=n=>money(n,s.unit);
 const field=(label,value)=>value?label+'  '+value:'';
 return {title:d.type,number:d.number,shop:s.name,logo:s.logo,stamp:s.stamp,color:s.color,logoRight:s.logoSide==='راست',table:s.layout==='جدولی',
 shopLines:[field('تلفن',s.phone),field('نشانی',s.address),field('وب‌سایت',s.website)],
 body:[field('تاریخ',C.day(d.on)),field('واحد پول',s.unit),field('مشتری',d.customer.name),field('تلفن مشتری',d.customer.phone),field('نشانی تحویل',d.customer.address),
 field('اعتبار تا',d.type===types[0]&&d.validUntil?C.day(d.validUntil):''),field('تاریخ ابطال',d.voidOn?C.day(d.voidOn):''),
 ...(p?[field('مبلغ دریافت‌شده',m(p.amount)),field('روش',p.method),field('تاریخ پرداخت',C.day(p.on)),field('پیگیری',p.reference),field('مانده پس از پرداخت',m(p.balance))]:[])],
 rows:p?[]:d.items.map((i,k)=>[i.name+(i.code?' · '+i.code:''),i.qty+' '+i.unit,m(i.price),m(t.lines[k])]),
 summary:p?[]:[field('جمع اقلام',m(t.subtotal)),field('تخفیف',m(t.discount)),field('ارسال',m(t.shipping)),field('قابل پرداخت',m(t.total))],
 footer:[...d.visible.map(f=>field(f.label,f.value)),field('واریز',s.bank),field('شرایط',s.terms)]};
}
function settings(){
 const s=db.shop;
 return '<h1>تنظیمات</h1>'+details('پروفایل و ظاهر سند',form('saveShop',
 input('نام کسب‌وکار','name',s.name)+input('تلفن','phone',s.phone)+area('نشانی','address',s.address)+input('وب‌سایت','website',s.website)+area('اطلاعات واریز','bank',s.bank)+area('شرایط پرداخت و ارسال','terms',s.terms)+
 select('واحد پول','unit',['تومان','ریال'],s.unit)+input('پیشوند شمارهٔ سند','prefix',s.prefix,'maxlength="20"')+input('رنگ برند','color',s.color,'type="color"')+
 select('اندازهٔ کاغذ','paper',['A4','A5'],s.paper)+select('طرح سند','layout',['جدولی','ساده'],s.layout)+select('جای لوگو','logoSide',['راست','چپ'],s.logoSide)+
 '<label>لوگو<input name="logo" type="file" accept="image/png,image/jpeg,image/webp"></label><label>مهر یا امضا<input name="stamp" type="file" accept="image/png,image/jpeg,image/webp"></label>'+
 check('حذف تصویر لوگو','removeLogo',false)+check('حذف تصویر مهر','removeStamp',false)+
 ['showPhone','showAddress','showBank','showTerms','requirePhone','requireAddress'].map((k,i)=>check(['چاپ تلفن','چاپ نشانی','چاپ اطلاعات واریز','چاپ شرایط','تلفن مشتری اجباری','نشانی سفارش اجباری'][i],k,s[k])).join('')+submit('ذخیرهٔ تنظیمات')))+
 details('فهرست کالا و خدمت',db.catalog.map(c=>card(esc(c.name)+' · '+money(c.price)+row(action('ویرایش','editCatalog('+idjs(c.id)+')'),action('حذف','removeCatalog('+idjs(c.id)+')','danger')))).join('')+
 '<div id="catalog-form">'+catalogForm()+'</div>')+
 details('قالب‌ها',db.templates.map(t=>card(esc(t.name)+' · نسخهٔ '+fmt(t.version)+row(action('کپی','copyTemplate('+idjs(t.id)+')'),action('ویرایش',"go('templateEdit',"+idjs(t.id)+")"),db.defaultTemplate===t.id?'پیش‌فرض':action('پیش‌فرض','defaultTemplate('+idjs(t.id)+')')))).join(''))+
 details('اکسل مشتریان',form('exportAll',check('تلفن','phone',true)+check('نشانی','address',true)+check('شهر و کد پستی','location',true)+submit('ذخیرهٔ فایل اکسل')))+
 details('پشتیبان‌گیری',form('exportBackup',input('گذرواژهٔ اختیاری','password','','type="password" autocomplete="new-password"')+submit('ذخیرهٔ پشتیبان'))+
 form('checkRestore','<label>فایل پشتیبان<input type="file" name="file" accept=".sybackup,application/json" required></label>'+input('گذرواژهٔ فایل','password','','type="password"')+submit('بررسی فایل بازیابی'))+'<div id="restore-info"></div>')+
 details('راهنمای آنلاین',form('setEndpoint',input('نشانی HTTPS سرویس','endpoint',s.endpoint,'type="url"')+submit('ذخیرهٔ نشانی سرویس')))+
 details('دادهٔ نمونه',db.demo?'<p>با حذف نمونه، همهٔ سفارش‌ها و اسناد متصل به مشتری نمونه هم حذف می‌شوند.</p>'+action('حذف نمونه','removeDemo()','danger'):action('ساخت دادهٔ نمونه','installDemo()'))+
 details('مشتریان بایگانی‌شده',db.customers.filter(c=>c.archived).map(c=>row(action(c.name,"go('customer',"+idjs(c.id)+")"))).join('')||'<p>موردی وجود ندارد.</p>');
}
function installDemo(){
 safe(()=>{
   if(db.demo)return;
   commit(n=>{
     const id=uid(), on=iranToday();
     n.customers.push({id,name:'مشتری آزمایشی',phone:'',addresses:[{label:'انبار نمونه',value:'نشانی آزمایشی'}],created:on});
     n.orders.push({id:uid(),cid:id,number:'O-'+(++n.seq),on,status:'در حال انجام',unit:'تومان',tid:'template-0',templateVersion:1,address:'نشانی آزمایشی',items:[{name:'محصول نمونه',qty:'2',price:40_000_000,unit:'عدد',code:'A93'}],payments:[{id:uid(),amount:30_000_000,on,method:'واریز',balance:50_000_000}],fields:[]});
     n.demo=id;
   });
   render();notice('مشتری و سفارش نمونه اضافه شدند.');
 });
}
function removeDemo(){
 if(!db.demo||!confirm('مشتری نمونه و همهٔ سفارش‌ها و اسناد مرتبط حذف شوند؟'))return;
 safe(()=>{
   if(draft?.cid===db.demo){draft=null;}
   commit(n=>{
     const ids=new Set(n.orders.filter(o=>o.cid===n.demo).map(o=>o.id));
     n.docs=n.docs.filter(d=>!ids.has(d.orderId));n.orders=n.orders.filter(o=>!ids.has(o.id));n.customers=n.customers.filter(c=>c.id!==n.demo);
     delete n.demo;
   });
   render();notice('نمونه حذف شد.');
 });
}
async function saveShop(f){
 const patch={};
 for(const k of ['name','phone','address','website','bank','terms','unit','prefix','color','paper','layout','logoSide'])patch[k]=val(f,k);
 for(const k of ['showPhone','showAddress','showBank','showTerms','requirePhone','requireAddress'])patch[k]=f.elements[k].checked;
 for(const id of ['logo','stamp']){
   const file=f.elements[id].files[0];
   if(file){
     if(file.size>350000||!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('تصویر PNG، JPEG یا WebP تا ۳۵۰ کیلوبایت انتخاب کنید.');
     patch[id]=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});
   }else if(f.elements[id==='logo'?'removeLogo':'removeStamp'].checked)patch[id]='';
 }
 commit(n=>Object.assign(n.shop,patch));notice('تنظیمات ذخیره شد.');
}
function catalogForm(c={}){return form('saveCatalog','<input type="hidden" name="id" value="'+esc(c.id)+'">'+input('نام کالا یا خدمت','name',c.name,'required')+input('کد','code',c.code)+input('واحد','unit',c.unit)+input('قیمت پیشنهادی ('+db.shop.unit+')','price',c.price===undefined?'':displayAmount(c.price,db.shop.unit))+submit('ذخیره در فهرست'));}
function editCatalog(id){document.querySelector('#catalog-form').innerHTML=catalogForm(db.catalog.find(c=>c.id===id));}
function removeCatalog(id){if(confirm('قلم از فهرست حذف شود؟'))safe(()=>{commit(n=>n.catalog=n.catalog.filter(c=>c.id!==id));render();});}
function saveCatalog(f){
 const name=val(f,'name');if(!name)throw Error('نام کالا یا خدمت را وارد کنید.');
 const c={id:val(f,'id')||uid(),name,code:val(f,'code'),unit:val(f,'unit'),price:C.amount(val(f,'price'),db.shop.unit)};
 commit(n=>{n.catalog=n.catalog.filter(x=>x.id!==c.id).concat(c);});render();notice('قلم ذخیره شد.');
}
function defaultTemplate(id){safe(()=>{commit(n=>n.defaultTemplate=id);render();});}
function copyTemplate(id){safe(()=>{const t=clone(template(id));const name=prompt('نام قالب جدید',t.name+' — کپی');if(name?.trim()){t.name=name.trim();t.id=uid();t.version=1;commit(n=>n.templates.push(t));render();}});}
function templateEditor(){
 const t=template(current), fields=t.fields.concat({label:'',type:'text',options:[]});
 return '<h1>ویرایش قالب</h1>'+form('saveTemplate',
 input('نام قالب','name',t.name,'required')+check('تلفن مشتری هنگام صدور اجباری است','requirePhone',t.requirePhone)+check('نشانی تحویل هنگام صدور اجباری است','requireAddress',t.requireAddress)+fields.map((f,i)=>details(f.label||'فیلد تازه',
 input('عنوان','label'+i,f.label)+select('نوع','type'+i,fieldKinds,f.type)+input('گزینه‌ها، جداشده با ویرگول','options'+i,(f.options||[]).join('، '))+
 check('اجباری','required'+i,f.required)+check('نمایش در سند مشتری','visible'+i,f.visible)+(f.id?check('حذف از قالب','remove'+i,false):''))).join('')+submit('ذخیرهٔ نسخهٔ جدید'));
}
function saveTemplate(f){
 const t=template(current), name=val(f,'name');
 if(!name)throw Error('نام قالب لازم است.');
 const fields=t.fields.concat({}).flatMap((old,i)=>{
   if(f.elements['remove'+i]?.checked)return [];
   const label=val(f,'label'+i),type=val(f,'type'+i),options=val(f,'options'+i).split(/[,،]/).map(v=>v.trim()).filter(Boolean);
   if(!label){if(old.id)throw Error('عنوان فیلد را بنویسید یا حذف آن را علامت بزنید.');return [];}
   if(type==='choice'&&!options.length)throw Error('گزینه‌های «'+label+'» را بنویسید.');
   return [{id:old.id||uid(),label,type,options,required:f.elements['required'+i].checked,visible:f.elements['visible'+i].checked}];
 });
 const requirePhone=f.elements.requirePhone.checked,requireAddress=f.elements.requireAddress.checked;
 commit(n=>{const found=n.templates.find(x=>x.id===t.id);Object.assign(found,{name,fields,requirePhone,requireAddress,version:t.version+1});});go('settings');
}
const helpTopics=[
 ['ساخت اولین فاکتور','در «قالب‌ها»، قالب شغلتان را انتخاب کنید. نام فروشگاه، نام مشتری و اقلام را وارد کنید و پایین صفحه «ذخیرهٔ فاکتور و PDF» را بزنید.'],
 ['تکرار خرید قبلی','در «فاکتورهای من» نام مشتری را جست‌وجو کنید. فاکتور فروش قبلی را باز کنید و «فاکتور جدید از روی این فاکتور» را بزنید. مشتری و اقلام آماده‌اند. تعداد و قیمت‌ها را مرور و ذخیره کنید. شماره، تاریخ و حساب پرداخت تازه هستند.'],
 ['ثبت پرداخت و دیدن مانده','فاکتور فروش را باز کنید و از «ثبت پرداخت» مبلغ و روش را وارد کنید. مبلغ دریافت‌شده و مانده همان‌جا نمایش داده می‌شوند. رسید و اصلاح از «پرداخت‌های ثبت‌شده» در دسترس است.'],
 ['اکسل و پشتیبان‌گیری','در تنظیمات، «اکسل و پشتیبان‌گیری» را باز کنید. اکسل برای گرفتن فهرست مشتریان است و پشتیبان برای انتقال داده‌ها به گوشی دیگر یا برگرداندن آن‌ها.'],
 ['لوگو و مهر','در تنظیمات، «پروفایل و ظاهر سند» را باز کنید. لوگو را انتخاب و تنظیمات را ذخیره کنید.'],
 ['بیعانه و رسید','سفارش را باز کنید و بیعانه را از بخش «ثبت پرداخت» وارد کنید. «رسید» را کنار پرداخت بزنید و سند را صادر کنید.'],
 ['فیلد اختصاصی','در سفارش «افزودن فیلد» را باز کنید. نوع فیلد، دامنه و نمایش در سند را تعیین کنید.'],
 ['ارسال فاکتور','فاکتور فروش را باز کنید و «ارسال PDF» را بزنید. برنامه و گیرنده را انتخاب کنید. برای داشتن نسخهٔ جداگانه، «ذخیرهٔ فایل PDF» را بزنید.']
];
function helpPage(){
 return '<h1>راهنمای استفاده</h1>'+
 input('جست‌وجوی راهنما','help','','type="search" oninput="helpSearch(this.value)"')+'<div id="topics">'+topicList('')+'</div>'+
 (db.shop.endpoint?details('مشاور آنلاین',form('askAdvisor',area('سؤال دربارهٔ کار با فاکتورچین','question')+'<p>متن سؤال برای پاسخ به سرویس آنلاین فرستاده می‌شود.</p>'+submit('ارسال سؤال')+'<p id="answer" role="status"></p>')):'');
}
function topicList(q){return helpTopics.filter(t=>C.norm(t.join(' ')).includes(C.norm(q))).map(([title,body])=>details(title,'<p>'+esc(body)+'</p>')).join('')||card('موضوعی پیدا نشد.');}
function helpSearch(q){document.querySelector('#topics').innerHTML=topicList(q);}
function setEndpoint(f){
 const endpoint=val(f,'endpoint');
 const url=endpoint?advisorEndpoint(endpoint):null;
 commit(n=>{n.shop.endpoint=url?.href||'';n.shop.advisorConsent='';});notice('نشانی ذخیره شد.');
}
function advisorEndpoint(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.hostname==='sefareshyar.local')
   throw Error('نشانی معتبر HTTPS بدون اطلاعات ورود وارد کنید.');
 return url;
}
async function askAdvisor(f){
 const question=val(f,'question'), answer=f.querySelector('#answer');
 if(!question||question.length>1200)throw Error('سؤال را حداکثر در ۱۲۰۰ نویسه وارد کنید.');
 const url=advisorEndpoint(db.shop.endpoint);
 if(db.shop.advisorConsent!==url.href){
   if(!confirm('متن سؤال برای '+url.host+' فرستاده می‌شود. اطلاعات مشتری یا اطلاعات بانکی را در سؤال ننویسید. ارسال شود؟'))return;
   commit(n=>n.shop.advisorConsent=url.href);
 }
 answer.textContent='در حال ارسال…';
 try{
   const response=await fetch(url.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question}),redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error();
   const payload=await response.json();
   if(typeof payload.answer!=='string'||!payload.answer.trim())throw Error();
   answer.textContent=payload.answer;
 }catch{answer.textContent='';throw Error('پاسخ دریافت نشد. اتصال و نشانی سرویس را بررسی کنید و دوباره تلاش کنید.');}
}
function render(){
 const pages={home,customers:()=>listPage('مشتریان',action('مشتری جدید',"go('customerEdit')",'primary'),'نام یا تلفن'),orders:()=>listPage('سفارش‌ها',action('سفارش جدید','startOrder()','primary'),'نام، شماره، تاریخ تحویل یا وضعیت'),docs:()=>listPage('فاکتورها','','نوع، شماره، تاریخ یا مشتری'),customer:customerPage,customerEdit:customerForm,editor,order:orderPage,preview,document:documentPage,settings,templateEdit:templateEditor,help:helpPage};
 app.innerHTML=pages[page]();
 if(page==='editor'&&draft){renderCustomerOpts();draftSummary();}
}
render();
