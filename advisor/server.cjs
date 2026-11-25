'use strict';
const http=require('node:http'), https=require('node:https'), fs=require('node:fs');
const {norm}=require('../app/src/main/assets/core.js');
const topics=[
 [['فاکتور','سریع','صدور','پیش‌نمایش'],'در «قالب‌ها»، قالب شغلتان را باز کنید. نام مشتری و فروشگاه و اقلام را وارد کنید. پایین صفحه «ذخیرهٔ فاکتور و PDF» را بزنید.'],
 [['تکرار','تکراری','قبلی','دفعه','مجدداً'],'فاکتور فروش قبلی را در «فاکتورهای من» پیدا کنید و «فاکتور جدید از روی این فاکتور» را بزنید. مشتری و اقلام آماده‌اند. قیمت امروز را بررسی و پیش‌نویس را ذخیره کنید.'],
 [['لوگو','مهر','امضا','سربرگ','برند'],'تنظیمات ← پروفایل و ظاهر سند. لوگو یا مهر را در قالب PNG، JPEG یا WebP تا ۳۵۰ کیلوبایت انتخاب و تنظیمات را ذخیره کنید. سندهای قبلی سربرگ زمان صدور را حفظ می‌کنند.'],
 [['بیعانه','پرداخت','رسید','مانده','تسویه'],'فاکتور فروش را باز کنید. در «ثبت پرداخت» مبلغ و روش را وارد کنید. مانده همان‌جا به‌روز می‌شود. برای رسید، «پرداخت‌های ثبت‌شده» و سپس «رسید یا اصلاح پرداخت» را باز کنید.'],
 [['فیلد','سریال','قالب','داخلی','اختصاصی'],'در سفارش «افزودن فیلد» را باز کنید. نوع و دامنه را تعیین کنید. برای استفادهٔ دوباره «در این قالب ذخیره شود» را انتخاب کنید. گزینهٔ «نمایش در سند مشتری» تعیین می‌کند فیلد در خروجی دیده شود.'],
 [['ارسال','اشتراک','پی‌دی‌اف','pdf','تصویر','چاپ','واتس','بله','ایتا'],'فاکتور فروش را باز کنید و «ارسال PDF» را بزنید. برنامه و گیرنده را در انتخابگر اندروید انتخاب کنید. می‌توانید «ذخیرهٔ فایل PDF» را بزنید و فایل را دستی پیوست کنید.'],
 [['پشتیبان','بازیابی','انتقال','رمز','گذرواژه'],'در تنظیمات «اکسل و پشتیبان‌گیری» را باز کنید و در صورت نیاز گذرواژه بدهید. روی گوشی مقصد فایل را از همان بخش انتخاب کنید، شمار داده‌ها را ببینید و جایگزینی را تأیید کنید.'],
 [['اکسل','xlsx','صفر','ستون'],'در تنظیمات «اکسل مشتریان» را باز کنید و ستون‌های تلفن، نشانی و موقعیت را انتخاب کنید. برای سوابق یک مشتری، «اکسل پرونده» را از پروندهٔ همان مشتری بزنید.']
];
function answer(q){
 const input=norm(q);
 const options=topics.map(([words,text])=>[words.reduce((score,w)=>score+(input.includes(norm(w))?1:0),0),text]).sort((a,b)=>b[0]-a[0]);
 return options[0][0]?options[0][1]:'برای پیدا کردن راهنما موضوعی از این موارد را در پرسش بنویسید: فاکتور سریع، لوگو، بیعانه، فیلد اختصاصی، ارسال سند، پشتیبان‌گیری یا اکسل.';
}
const allowed=new Set((process.env.ADVISOR_ORIGINS||'https://sefareshyar.local').split(',').map(v=>v.trim()));
function handler(req,res){
 const origin=req.headers.origin;
 const headers={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(allowed.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS'});
 const send=(code,payload)=>{res.writeHead(code,headers);res.end(payload===undefined?'':JSON.stringify(payload));};
 if(req.url!=='/advisor')return send(404,{error:'not_found'});
 if(origin&&!allowed.has(origin))return send(403,{error:'origin'});
 if(req.method==='OPTIONS')return send(204);
 if(req.method!=='POST')return send(405,{error:'method'});
 let length=0, chunks=[];
 req.on('data',chunk=>{
   length+=chunk.length;
   if(length<=8192)chunks.push(chunk);
   else chunks=[];
 });
 req.on('end',()=>{
   if(length>8192)return send(413,{error:'size'});
   try{
     const {question}=JSON.parse(Buffer.concat(chunks).toString('utf8'));
     if(typeof question!=='string'||!question.trim()||question.length>1200)return send(400,{error:'question'});
     return send(200,{answer:answer(question)});
   }catch{return send(400,{error:'json'});}
 });
}
if(require.main===module){
 const {ADVISOR_CERT,ADVISOR_KEY,ADVISOR_PORT,ADVISOR_BIND}=process.env;
 if(Boolean(ADVISOR_CERT)!==Boolean(ADVISOR_KEY))throw Error('Provide both ADVISOR_CERT and ADVISOR_KEY');
 const server=ADVISOR_CERT?https.createServer({cert:fs.readFileSync(ADVISOR_CERT),key:fs.readFileSync(ADVISOR_KEY)},handler):http.createServer(handler);
 server.requestTimeout=15000;
 server.listen(Number(ADVISOR_PORT||8787),ADVISOR_BIND||'127.0.0.1',()=>console.log('Advisor listening on '+server.address().port));
}
module.exports={answer,handler};
