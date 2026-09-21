import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const svg=readFileSync(new URL('../public/icon.svg',import.meta.url),'utf8');
const out=new URL('../public/icons/',import.meta.url);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
try{
 for(const [name,size,maskable] of [['icon-192.png',192,false],['icon-512.png',512,false],['maskable-512.png',512,true],['apple-touch-icon.png',180,true]]){
  const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
  await page.setContent(`<html><body style="margin:0;width:${size}px;height:${size}px">${maskable?svg.replace('rx="16"','rx="0"'):svg}</body></html>`);
  await page.locator('svg').screenshot({path:new URL(name,out).pathname,omitBackground:true});await page.close();
 }
}finally{await browser.close();}
