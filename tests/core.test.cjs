'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const C=require('../app/src/main/assets/core.js');
const {workbook,packBackup,unpackBackup}=require('../app/src/main/assets/files.js');
global.Core=C;
const {handler}=require('../advisor/server.cjs');
const base={version:1,shop:{name:'نمونه',unit:'تومان'},seq:0,customers:[],orders:[],docs:[],catalog:[],templates:[{id:'t',name:'فروش',fields:[]}],defaultTemplate:'t'};
test('Persian dates, text normalization and phone prefixes',()=>{
 assert.equal(C.date('۱۴۰۵/۰۸/۲۶'),'2026-11-17');
 assert.equal(C.date('١٤٠٣/١٢/٣٠'),'2025-03-20');
 assert.throws(()=>C.date('۱۴۰۲/۱۲/۳۰'));
 assert.throws(()=>C.date('۱۴۰۵/۰۷/۳۱'));
 assert.equal(C.phone('+۹۸ ۹۱۲ ۳۴۵ ۶۷۸۹'),'09123456789');
 assert.equal(C.norm('علي كريمي'),'علیکریمی');
});
test('Rial arithmetic, fractional quantity, discount and balance',()=>{
 const order={items:[{qty:'۲٫۵',price:C.amount('۳٬۲۰۰٬۰۰۰','تومان')}],payments:[{amount:C.amount('٣٠٠٠٠٠٠','تومان')}]};
 const t=C.totals(order);
 assert.equal(t.total-C.paid(order),50_000_000);
 assert.equal(C.totals({items:[{qty:'1.5',price:1}]}).total,2);
 assert.equal(C.totals({...order,discountMode:'percent',discountPercent:'12.5'}).total,70_000_000);
 assert.throws(()=>C.totals({...order,discount:80_000_001}));
 assert.throws(()=>C.amount('-500','ریال'));
});
test('Issued documents retain visible snapshots and omit note and private fields',()=>{
 const customer={name:'خریدار',phone:'0912'}, shop={name:'فروشگاه',unit:'تومان',showPhone:false,showAddress:false,logo:'first'};
 const o={id:'o',items:[{name:'کالا',price:10,qty:'1',note:'PRIVATE_ITEM'}],address:'SECRET_ADDRESS',note:'PRIVATE_NOTE',fields:[{label:'داخلی',value:'PRIVATE_FIELD',visible:false},{label:'سریال',value:'AB-1',visible:true}]};
 const doc=C.snapshot(o,customer,shop,'فاکتور فروش','SY-1','2026-11-17');
 o.items[0].price=20; shop.logo='changed'; customer.name='جدید';
 assert.equal(doc.items[0].price,10);
 assert.equal(doc.shop.logo,'first');
 assert.equal(doc.customer.name,'خریدار');
 assert.equal(doc.visible[0].value,'AB-1');
 assert.doesNotMatch(JSON.stringify(doc),/PRIVATE|SECRET|0912/);
});
test('XLSX archive contains real inline string cells',()=>{
 const b=Buffer.from(workbook([['مشتریان',[['09123456789','=1+1','<ایران>']]]]));
 assert.equal(b.readUInt32LE(0),0x04034b50);
 assert.match(b.toString('utf8'),/t="inlineStr"[^]*09123456789[^]*=1\+1[^]*&lt;ایران&gt;/);
 assert.doesNotMatch(b.toString(),/<f>/);
});
test('Plain and encrypted backups, wrong password and malformed records',async()=>{
 const plain=await packBackup(base,'');
 assert.deepEqual(await unpackBackup(Buffer.from(plain).toString(),''),base);
 const file=Buffer.from(await packBackup(base,'passphrase')).toString();
 assert.doesNotMatch(file,/نمونه/);
 assert.deepEqual(await unpackBackup(file,'passphrase'),base);
 await assert.rejects(unpackBackup(file,'wrong'));
 await assert.rejects(unpackBackup('{"format":"sefareshyar-1","data":{"version":1}}',''));
});
test('Advisor HTTP contract, validation and CORS',async()=>{
 const s=http.createServer(handler);
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 try{
   const url='http://127.0.0.1:'+s.address().port+'/advisor';
   const ask=async (body,origin='https://sefareshyar.local')=>fetch(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
   const r=await ask({question:'چطور بیعانه ثبت کنم؟'});
   assert.equal(r.status,200);
   assert.equal(r.headers.get('access-control-allow-origin'),'https://sefareshyar.local');
   assert.match((await r.json()).answer,/ثبت پرداخت/);
   assert.equal((await ask({question:''})).status,400);
   assert.equal((await ask({question:'فاکتور'},'https://different.invalid')).status,403);
 }finally{s.close();}
});
