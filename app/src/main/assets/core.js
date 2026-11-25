/* Pure domain and file-format helpers shared with the acceptance checks. */
const Core = (() => {
  const latin = value => String(value ?? '').replace(/[۰-۹٠-٩]/g, c => String(c.charCodeAt(0) % 16));
  const norm = value => latin(value).trim().toLowerCase().replace(/[يك]/g,c=>c==='ي'?'ی':'ک').replace(/[\s‌-]/g,'');
  const phone = value => latin(value).replace(/\D/g,'').replace(/^(?:0098|98)(?=9\d{9}$)/,'0');
  const day = iso => iso ? new Intl.DateTimeFormat('fa-IR-u-ca-persian',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z')) : '—';
  const isoAtIran = (date = new Date()) => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  const parts = new Intl.DateTimeFormat('en-u-ca-persian',{timeZone:'UTC',year:'numeric',month:'numeric',day:'numeric'});
  function date(value) {
    const input=latin(value).trim();
    if (!input) return '';
    const match=/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(input);
    if (!match) throw Error('تاریخ را به شکل ۱۴۰۵/۰۸/۲۶ وارد کنید.');
    const [year,month,dom]=match.slice(1).map(Number);
    if(year<1200||year>1600||month<1||month>12||dom<1||dom>31) throw Error('تاریخ معتبر نیست.');
    const start=Date.UTC(year+621,2,18);
    for(let i=0;i<370;i++){
      const current=new Date(start+i*86400000);
      const values=Object.fromEntries(parts.formatToParts(current).map(p=>[p.type,Number(p.value)]));
      if(values.year===year&&values.month===month&&values.day===dom) return current.toISOString().slice(0,10);
    }
    throw Error('تاریخ شمسی معتبر نیست.');
  }
  function editableDay(iso) {
    if(!iso) return '';
    const p=Object.fromEntries(parts.formatToParts(new Date(iso+'T12:00:00Z')).map(p=>[p.type,p.value]));
    return [p.year,p.month,p.day].join('/');
  }
  const clean = value => latin(value).trim().replace(/[٬,]/g,'').replace(/٫/g,'.');
  function amount(value, unit){
    const str=clean(value)||'0';
    if(unit==='تومان'){
      if(!/^\d+(?:\.\d)?$/.test(str)) throw Error('مبلغ به تومان باید نامنفی و با حداکثر یک رقم اعشار باشد.');
      return checked(fixed(str,1));
    }
    if(!/^\d+$/.test(str)) throw Error('مبلغ باید عدد صحیح و نامنفی باشد.');
    return checked(BigInt(str));
  }
  function checked(n){
    if(n>BigInt(Number.MAX_SAFE_INTEGER)||n<0n) throw Error('مبلغ خارج از محدوده است.');
    return Number(n);
  }
  function fixed(value, decimals){
    const str=clean(value);
    if(!new RegExp('^\\d+(?:\\.\\d{1,'+decimals+'})?$').test(str)) throw Error('عدد نامعتبر است.');
    const [whole,frac='']=str.split('.');
    return BigInt(whole+frac.padEnd(decimals,'0'));
  }
  function totals(order){
    let subtotal=0n;
    const lines=order.items.map(item=>{
      const qty=fixed(item.qty,3);
      if(qty<=0n) throw Error('تعداد باید بیشتر از صفر باشد.');
      const total=(qty*BigInt(item.price)+500n)/1000n;
      subtotal+=total;
      return checked(total);
    });
    const shipping=BigInt(order.shipping||0);
    const discount=order.discountMode==='percent' ? (()=>{const b=fixed(order.discountPercent||'0',2);if(b>10000n)throw Error('درصد تخفیف حداکثر ۱۰۰ است.');return (subtotal*b+5000n)/10000n;})() : BigInt(order.discount||0);
    if(discount>subtotal) throw Error('تخفیف از جمع اقلام بیشتر است.');
    const rate=fixed(order.taxRate||'0',2);
    if(rate>10000n)throw Error('درصد مالیات باید بین صفر و ۱۰۰ باشد.');
    const tax=((subtotal-discount)*rate+5000n)/10000n;
    return {lines,subtotal:checked(subtotal),discount:checked(discount),shipping:checked(shipping),tax:checked(tax),total:checked(subtotal-discount+shipping+tax)};
  }
  const paid = order => (order.payments||[]).filter(p=>!p.void).reduce((n,p)=>n+p.amount,0);
  function money(rial,unit){
    const n=BigInt(rial), scale=unit==='تومان'?10n:1n, fa=new Intl.NumberFormat('fa-IR');
    if(n<0n)return '−'+money(Number(-n),unit);
    return fa.format(n/scale)+(n%scale?'٫'+fa.format(n%scale):'')+' '+unit;
  }
  function snapshot(order,customer,shop,type,number,on,payment){
    const visible = (order.fields||[]).filter(f=>f.visible && f.value!=='').map(({label,value,type})=>({label,value:type==='date'?day(value):value}));
    return {type,number,on,orderId:order.id,customer:{name:customer.name,phone:shop.showPhone?customer.phone:'',address:shop.showAddress?order.address:''},shop:{name:shop.name,phone:shop.showPhone?shop.phone:'',address:shop.showAddress?shop.address:'',website:shop.website,unit:shop.unit,color:shop.color,logo:shop.logo,stamp:shop.stamp,bank:shop.showBank?shop.bank:'',terms:shop.showTerms?shop.terms:'',paper:shop.paper,layout:shop.layout,logoSide:shop.logoSide},items:order.items.map(({name,qty,price,unit,code,description})=>({name,qty,price,unit,code,description})),summary:totals(order),visible,taxRate:order.taxRate||'',validUntil:order.validUntil,payment:payment?{id:payment.id,amount:payment.amount,method:payment.method,on:payment.on,reference:payment.reference,balance:payment.balance}:null};
  }
  function backupShape(db) {
    if(!db||db.version!==1||!db.shop||!Number.isSafeInteger(db.seq)||db.seq<0) throw Error('نسخه یا سربرگ پشتیبان معتبر نیست.');
    for(const key of ['customers','orders','docs','templates','catalog']) {
      if(!Array.isArray(db[key])||db[key].some(v=>!v||typeof v.id!=='string')||new Set(db[key].map(v=>v.id)).size!==db[key].length) throw Error('داده‌های پشتیبان ناقص یا تکراری‌اند.');
    }
    const customers=new Set(db.customers.map(c=>c.id)), orders=new Set(db.orders.map(o=>o.id));
    const validFields=fields=>Array.isArray(fields)&&fields.every(f=>f&&typeof f.id==='string'&&typeof f.label==='string'&&['text','number','date','choice','boolean'].includes(f.type));
    const validItems=items=>Array.isArray(items)&&items.length>0&&items.every(i=>i&&typeof i.name==='string'&&typeof i.qty==='string'&&Number.isSafeInteger(i.price)&&i.price>=0);
    if(!['تومان','ریال'].includes(db.shop.unit)||!db.templates.some(t=>t.id===db.defaultTemplate)||db.templates.some(t=>typeof t.name!=='string'||!validFields(t.fields))||
      db.customers.some(c=>typeof c.name!=='string'||!Array.isArray(c.addresses)||c.addresses.some(a=>!a||typeof a.value!=='string'||typeof a.label!=='string'))||
      db.orders.some(o=>!customers.has(o.cid)||!validItems(o.items)||!Array.isArray(o.payments)||!validFields(o.fields))||
      db.docs.some(d=>!orders.has(d.orderId)||typeof d.customer?.name!=='string'||!d.shop||!d.summary||!validItems(d.items)||!Array.isArray(d.visible)))throw Error('ارتباط سوابق یا ساختار پشتیبان معتبر نیست.');
    if(new Set(db.docs.map(d=>d.number)).size!==db.docs.length||
      [...db.orders,...db.docs].some(v=>typeof v.number!=='string'||!/-\d+$/.test(v.number)||Number(v.number.split('-').pop())>db.seq))throw Error('شمارهٔ سوابق پشتیبان معتبر نیست.');
    for(const o of db.orders){const t=totals(o);if(paid(o)>t.total||o.payments.some(p=>!Number.isSafeInteger(p.amount)||p.amount<=0)) throw Error('مبالغ پشتیبان معتبر نیستند.');}
    return db;
  }
  return {latin,norm,phone,day,isoAtIran,date,editableDay,amount,totals,paid,money,snapshot,backupShape};
})();
if(typeof module!=='undefined') module.exports=Core;
