'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const assets=path.join(__dirname,'../app/src/main/assets');
const allowed=new Set(fs.readdirSync(assets));
const server=http.createServer((req,res)=>{
 const name=req.url==='/'?'index.html':req.url.slice(1);
 if(!allowed.has(name)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',{'html':'text/html','css':'text/css','js':'application/javascript','ttf':'font/ttf','txt':'text/plain','svg':'image/svg+xml'}[name.split('.').at(-1)]);
 fs.createReadStream(path.join(assets,name)).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
   browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu','--no-sandbox']});
   const storeAssets=process.env.STORE_SCREENSHOTS;
   const capture=(name)=>storeAssets?page.screenshot({path:path.join(storeAssets,name+'.png')}):Promise.resolve();
   const viewport=storeAssets?{width:504,height:896}:{width:390,height:844};
   const context=await browser.newContext({viewport,deviceScaleFactor:storeAssets?2:1});
   await context.addInitScript(()=>{
     window.Android={
       readState:key=>localStorage.getItem(key),
       writeState:(key,value)=>{localStorage.setItem(key,value);return true;},
       archiveDocument:(payload,id,paper)=>localStorage.setItem('archive-'+id,JSON.stringify({payload:JSON.parse(payload),paper})),
       storedDocument:(payload,name,paper,mode,id)=>window.lastOutput={name,mode,id}
     };
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const btn=name=>page.getByRole('button',{name,exact:true}).click();
   const input=k=>page.locator('[name="'+k+'"]');
   await page.clock.install();
   await page.goto('http://127.0.0.1:'+server.address().port);
   assert.equal(await page.title(),'فاکتورچین');
   assert.equal(await page.locator('header .identity strong').innerText(),'فاکتورچین');
   await page.getByRole('heading',{name:'سلام، خوش اومدی!'}).waitFor();
   if(process.env.ACCEPTANCE_WELCOME)await page.screenshot({path:process.env.ACCEPTANCE_WELCOME});
   await page.clock.fastForward(2250);
   await page.getByRole('heading',{name:'قالب شغلت رو انتخاب کن'}).waitFor();
   await btn('بعدی');
   await page.getByRole('heading',{name:'ذخیره کن و دوباره پیداش کن'}).waitFor();
   await btn('رد کردن');
   assert.equal(await page.locator('html').getAttribute('data-theme'),'lilac');
   await page.evaluate(()=>document.fonts.ready);
   await capture('01-templates');
   await btn('تنظیمات');
   await page.locator('.settings-menu button').filter({hasText:'ظاهر و فونت'}).click();
   if(process.env.ACCEPTANCE_STYLE)await page.screenshot({path:process.env.ACCEPTANCE_STYLE,fullPage:true});
   await page.locator('[data-choice="theme-navy"]').click();
   await page.locator('[data-choice="font-estedad"]').click();
   await page.locator('[data-choice="scale-large"]').click();
   assert.equal(await page.locator('html').getAttribute('data-theme'),'navy');
   assert.equal(await page.locator('html').getAttribute('data-font'),'estedad');
   assert.equal(await page.locator('html').getAttribute('data-scale'),'large');
   assert.equal(await page.evaluate(async()=>{const faces=await document.fonts.load('700 16px Estedad','فاکتور');return faces.some(f=>f.status==='loaded');}),true);
   await page.reload();
   assert.equal(await page.locator('.intro-dialog').count(),0);
   assert.equal(await page.locator('html').getAttribute('data-theme'),'navy');
   await page.evaluate(()=>commit(n=>{n.shop.welcomeSeen=true;delete n.shop.welcomeRevision;}));
   await page.reload();
   await page.getByRole('heading',{name:'سلام، خوش اومدی!'}).waitFor();
   await btn('رد کردن');
   await page.reload();
   assert.equal(await page.locator('.intro-dialog').count(),0);
   if(storeAssets)await page.evaluate(()=>{commit(n=>{n.shop.ui={theme:'lilac',font:'vazir',scale:'normal'};});render();});
   assert.equal(await page.locator('.preset-card').count(),20);
   if(process.env.ACCEPTANCE_HOME) await page.screenshot({path:process.env.ACCEPTANCE_HOME,fullPage:false});
   await context.setOffline(true);
   await btn('فنی');
   assert.equal(await page.locator('.preset-card').count(),6);
   await btn('تعمیر موبایل و رایانه');
   assert.match(await page.locator('#app').innerText(),/سریال دستگاه/);
   await input('seller').fill('تعمیرات آزمایشی');
   await input('customer').fill('علي كريمي');
   await input('phone').fill('۰۹۱۲۳۴۵۶۷۸');
   assert.match(await page.locator('#phone-error').innerText(),/۱۱ رقم/);
   assert.equal(await input('phone').evaluate(el=>el.validity.valid),false);
   await input('phone').fill('۰۹۱۲۳۴۵۶۷۸۹۰');
   assert.equal(await input('phone').evaluate(el=>el.validity.valid),false);
   await input('phone').fill('۰۹۱۲۳۴۵۶۷۸۹');
   assert.equal(await input('phone').evaluate(el=>el.validity.valid),true);
   if(storeAssets)await input('phone').fill('');
   await input('delivery').selectOption('پیک');
   await input('field-value').nth(1).fill('MX-2001');
   await input('billQty').fill('۲٫۵');
   await input('billPrice').fill('۱٬۲۰۰٬۰۰۰');
   await input('billColor').fill('#8c302e');
   await input('billLogo').setInputFiles({name:'logo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jkwAAAABJRU5ErkJggg==','base64')});
   await page.locator('#live-bill img').waitFor();
   await btn('افزودن قلم');
   await input('billName').nth(1).fill('قطعه');
   await input('billPrice').nth(1).fill('۵۰۰۰۰۰');
   await input('discount').fill('۲۰۰۰۰۰');
   await input('shipping').fill('۱۰۰۰۰۰');
   assert.equal(await page.locator('#bill-sum').innerText(),'۳٬۴۰۰٬۰۰۰ تومان');
   await input('taxRate').fill('۱۰');
   assert.equal(await page.locator('#bill-sum').innerText(),'۳٬۷۳۰٬۰۰۰ تومان');
   await context.setOffline(false);
   await page.reload();await btn('ادامهٔ پیش‌نویس');
   assert.equal(await input('customer').inputValue(),'علي كريمي');
   assert.equal(await input('billColor').inputValue(),'#8c302e');
   await btn('ذخیرهٔ فاکتور و PDF');
   assert.match(await page.locator('.saved-bill').innerText(),/MX-2001/);
   if(storeAssets){
     await capture('02-invoice');
   }
   const archived=await page.evaluate(()=>JSON.parse(localStorage.getItem('archive-'+db.docs[0].id)));
   assert.equal(archived.payload.design,'studio');
   assert.equal(archived.payload.color,'#8c302e');
   assert.equal(archived.payload.rows.length,2);
   assert.match(archived.payload.balance,/۳٬۷۳۰٬۰۰۰/);
   assert.match(archived.payload.words,/سه میلیون و هفتصد و سی هزار/);
   assert.ok(archived.payload.extras.some(s=>s.includes('پیک')));
   assert.equal(archived.payload.rows[0].length,5);
   if(process.env.ACCEPTANCE_SAVED)await page.screenshot({path:process.env.ACCEPTANCE_SAVED,fullPage:true});
   await page.reload();
   await page.getByRole('navigation').getByRole('button',{name:'فاکتورهای من'}).click();
   await input('invoice-search').fill('علی کریمی');
   assert.equal(await page.locator('.archive-row').count(),1);
   await capture('03-archive');
   await input('invoice-search').fill('ناشناس');
   assert.equal(await page.locator('.archive-row').count(),0);
   await input('invoice-search').fill('کریمی');
   await page.locator('.archive-row').click();
   await btn('ذخیرهٔ فایل PDF');
   assert.equal(await page.evaluate(()=>window.lastOutput.mode),'save');
   await page.getByText('ثبت پرداخت',{exact:true}).click();
   await input('amount').fill('۳۷۳۰۰۰۱');
   await btn('ذخیرهٔ پرداخت');
   assert.match(await page.locator('.bill-payment .error').innerText(),/مانده/);
   await input('amount').fill('۵۰۰۰۰۰');
   await btn('ذخیرهٔ پرداخت');
   assert.equal(await page.locator('[data-balance]').innerText(),'۳٬۲۳۰٬۰۰۰ تومان');
   assert.equal(await page.evaluate(()=>db.orders[0].payments.length),1);
   await btn('فاکتور جدید از روی این فاکتور');
   assert.equal(await input('customer').inputValue(),'علي كريمي');
   assert.equal(await input('billName').count(),2);
   assert.equal(await input('billPrice').nth(1).inputValue(),'500000');
   assert.equal(await input('discount').inputValue(),'');
   await btn('ذخیرهٔ فاکتور و PDF');
   assert.equal(await page.locator('[data-balance]').innerText(),'۳٬۵۰۰٬۰۰۰ تومان');
   assert.equal(await page.evaluate(()=>db.orders[1].payments.length),0);
   assert.notEqual(await page.evaluate(()=>db.docs[0].number),await page.evaluate(()=>db.docs[1].number));
   await btn('تنظیمات');
   await page.locator('.settings-menu button').filter({hasText:'حریم خصوصی'}).click();
   await page.getByRole('heading',{name:'حریم خصوصی فاکتورچین'}).waitFor();
   await btn('تنظیمات');
   assert.equal(await page.getByText('اکسل مشتریان',{exact:true}).count(),0);
   await page.locator('.settings-menu button').filter({hasText:'اکسل و پشتیبان‌گیری'}).click();
   assert.equal(await page.getByText('اکسل مشتریان',{exact:true}).count(),1);
   await btn('تنظیمات');
   await page.locator('.settings-menu button').filter({hasText:'راهنمای استفاده'}).click();
   await input('help').fill('تکرار خرید');
   await page.getByText('تکرار خرید قبلی',{exact:true}).waitFor();
   assert.deepEqual(errors,[]);
   if(storeAssets){
     const icon=await page.evaluate(async()=>{
       const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
       const drawing=canvas.getContext('2d'), image=new Image();
       image.src='brand-logo.svg';
       await image.decode();
       drawing.drawImage(image,0,0,512,512);
       return canvas.toDataURL('image/png').split(',')[1];
     });
     fs.writeFileSync(path.join(storeAssets,'icon-512.png'),Buffer.from(icon,'base64'));
   }
   console.log('PASS: welcome, appearance, redesigned invoices, phone validation, exact totals, PDF bridge, archive search, payments, repeat purchase, privacy and help');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

