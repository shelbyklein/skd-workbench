import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
const out=new URL('../public/icons/',import.meta.url);
mkdirSync(out,{recursive:true});
const source='data:image/png;base64,'+readFileSync(new URL('../img/logo.png',import.meta.url)).toString('base64');
copyFileSync(new URL('../img/bg-blue.png',import.meta.url),new URL('../public/sidebar-texture.png',import.meta.url));
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage();
 const result=await page.evaluate(async source=>{
  const image=new Image();image.src=source;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let left=image.width,top=image.height,right=0,bottom=0;
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(pixels[(y*image.width+x)*4+3]>8){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  const width=right-left+1,height=bottom-top+1;
  const crop=document.createElement('canvas');crop.width=width;crop.height=height;crop.getContext('2d').drawImage(image,left,top,width,height,0,0,width,height);
  const icons={};for(const [name,size] of [['icon-192.png',192],['icon-512.png',512],['maskable-512.png',512],['apple-touch-icon.png',180]]){
   const c=document.createElement('canvas');c.width=c.height=size;const context=c.getContext('2d');context.fillStyle='#16384e';context.fillRect(0,0,size,size);
   const scale=size*.78/Math.max(width,height),w=width*scale,h=height*scale;context.imageSmoothingQuality='high';context.drawImage(crop,(size-w)/2,(size-h)/2,w,h);icons[name]=c.toDataURL().split(',')[1];
  }
  return {width,height,left,top,png:crop.toDataURL().split(',')[1],icons};
 },source);
 writeFileSync(new URL('../public/icon.svg',import.meta.url),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${result.width} ${result.height}"><image width="${result.width}" height="${result.height}" href="data:image/png;base64,${result.png}"/></svg>\n`);
 for(const [name,data] of Object.entries(result.icons))writeFileSync(new URL(name,out),Buffer.from(data,'base64'));
 console.log(`Cropped logo to ${result.width} × ${result.height} at ${result.left}, ${result.top}; generated app icons and sidebar texture.`);
}finally{await browser.close();}
