'use strict';

const appearanceOptions=[
 {id:'lilac',name:'آبی و یاسی',colors:['#444fc0','#7950bf','#eeeafe']},
 {id:'jade',name:'سبزآبی گرم',colors:['#126858','#1d8d74','#dff3ee']},
 {id:'navy',name:'سرمه‌ای و طلایی',colors:['#24365e','#975d29','#fff0d9']}
];
const fontOptions=[
 {id:'vazir',name:'وزیرمتن'},
 {id:'estedad',name:'استعداد'}
];
const textScales=[['normal','معمولی'],['large','درشت'],['larger','درشت‌تر']];
const appearanceRender=render;
function currentAppearance(){
 const ui=db.shop.ui||{};
 return {
  theme:appearanceOptions.some(x=>x.id===ui.theme)?ui.theme:'lilac',
  font:fontOptions.some(x=>x.id===ui.font)?ui.font:'vazir',
  scale:textScales.some(([id])=>id===ui.scale)?ui.scale:'normal'
 };
}
function applyAppearance(){
 const {theme,font,scale}=currentAppearance();
 Object.assign(document.documentElement.dataset,{theme,font,scale});
}
function updateAppearance(key,value){
 safe(()=>{
  commit(n=>n.shop.ui={...(n.shop.ui||{}),[key]:value});
  render();
  document.querySelector('[data-choice="'+key+'-'+value+'"]')?.focus({preventScroll:true});
 });
}
function appearanceScreen(){
 const a=currentAppearance();
 const option=(key,id,content,selected,cls='')=>'<button type="button" class="appearance-choice '+cls+'" data-choice="'+key+'-'+id+
 '" aria-pressed="'+String(selected)+'" onclick="updateAppearance(\''+key+'\',\''+id+'\')">'+content+'</button>';
 return '<div class="editor-kicker">'+action('بازگشت به تنظیمات',"go('settings')",'plain-btn')+'</div><h1>ظاهر و فونت</h1>'+
 '<section class="appearance-panel"><h2>رنگ برنامه</h2><div class="theme-choices">'+appearanceOptions.map(t=>option('theme',t.id,
 '<div class="theme-swatch" aria-hidden="true" style="--swatch-a:'+t.colors[0]+';--swatch-b:'+t.colors[1]+';--swatch-c:'+t.colors[2]+
 '"><span></span><span></span><span></span></div><strong>'+t.name+'</strong>',a.theme===t.id,'theme-choice')).join('')+'</div></section>'+
 '<section class="appearance-panel"><h2>فونت نوشته‌ها</h2><div class="font-choices">'+fontOptions.map(f=>option('font',f.id,
 '<strong>'+f.name+'</strong><span class="font-example" data-example-font="'+f.id+'">فاکتور فروش<br>مبلغ قابل پرداخت ۲۵۰٬۰۰۰ تومان</span>',a.font===f.id)).join('')+'</div></section>'+
 '<section class="appearance-panel"><h2>اندازهٔ نوشته‌ها</h2><div class="scale-choices">'+textScales.map(([id,label])=>option('scale',id,label,a.scale===id)).join('')+'</div></section>';
}
const welcomeSteps=[
 ['سلام، خوش اومدی!','با فاکتورچین، فاکتور فروشگاهت توی چند قدم آماده می‌شود.','سلام'],
 ['قالب شغلت رو انتخاب کن','نام مشتری و اقلام رو بنویس. جمع فاکتور خودکار حساب می‌شود.','قالب'],
 ['ذخیره کن و دوباره پیداش کن','PDF رو ذخیره کن. بعداً فاکتور با نام مشتری پیدا می‌شود.','PDF']
];
const welcomeRevision=2;
let welcomeTimer, welcomeDialog=null, welcomeStep=0, welcomeOpener=null;
function closeWelcome(){
 if(!welcomeDialog)return;
 clearTimeout(welcomeTimer);
 const modal=welcomeDialog;
 welcomeDialog=null;
 if(modal.open&&typeof modal.close==='function')modal.close();
 modal.remove();
 safe(()=>commit(n=>{n.shop.welcomeSeen=true;n.shop.welcomeRevision=welcomeRevision;}));
 welcomeOpener?.focus?.({preventScroll:true});
}
function showWelcomeStep(index){
 clearTimeout(welcomeTimer);welcomeStep=index;
 const [title,copy,mark]=welcomeSteps[index];
 const final=index===welcomeSteps.length-1;
 welcomeDialog.innerHTML='<div class="welcome-art" aria-hidden="true"><div>'+(index===0?'<span class="welcome-brand"></span>':'<span>'+mark+'</span>')+'</div></div>'+
 '<h1 id="intro-title">'+title+'</h1><p>'+copy+'</p>'+
 '<div class="intro-progress" aria-label="گام '+fmt(index+1)+' از '+fmt(welcomeSteps.length)+'">'+welcomeSteps.map((_,i)=>'<span class="'+(i===index?'active':'')+'"></span>').join('')+'</div>'+
 '<div class="intro-actions">'+action(final?'ورود به برنامه':'بعدی',final?'closeWelcome()':'nextWelcome()','primary')+action('رد کردن','closeWelcome()','intro-skip')+'</div>';
 if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  welcomeTimer=setTimeout(final?closeWelcome:nextWelcome,index===0?2200:2450);
 }
}
function nextWelcome(){if(welcomeDialog&&welcomeStep<welcomeSteps.length-1)showWelcomeStep(welcomeStep+1);}
function openWelcome(){
 if(welcomeDialog)return;
 welcomeOpener=document.activeElement;
 const modal=document.createElement('dialog');
 modal.className='intro-dialog';modal.setAttribute('aria-labelledby','intro-title');
 modal.addEventListener('cancel',event=>{event.preventDefault();closeWelcome();});
 welcomeDialog=modal;document.body.append(modal);
 showWelcomeStep(0);
 if(typeof modal.showModal==='function')modal.showModal();else modal.setAttribute('open','');
}
render=function(){
 applyAppearance();
 if(page==='appearance'){
  document.body.dataset.screen=page;
  app.innerHTML=appearanceScreen();return;
 }
 appearanceRender();
 if(page==='settings'){
  const menu=app.querySelector('.settings-menu');
  const tile='<button type="button" onclick="go(\'appearance\')"><strong>ظاهر و فونت</strong><small>رنگ برنامه، فونت و اندازهٔ نوشته‌ها</small></button>';
  menu?.insertAdjacentHTML('afterbegin',tile);
 }
 if(page==='help')app.querySelector('h1')?.insertAdjacentHTML('afterend',row(action('دیدن دوبارهٔ معرفی کوتاه','openWelcome()','plain-btn')));
};
render();
if(Number(db.shop.welcomeRevision||0)<welcomeRevision)openWelcome();

