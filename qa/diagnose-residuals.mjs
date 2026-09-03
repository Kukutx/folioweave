import { resolveChromePath } from "./chrome.mjs";
﻿import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const chrome = resolveChromePath();
const original = process.env.ORIGINAL_URL || 'http://127.0.0.1:4173';
const next = process.env.NEXT_URL || 'http://127.0.0.1:4181';
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
];
const selectors = [
  '.nav', '.nav-content', '.nav-logo-group', '.nav-links', '.mobile-menu-toggle',
  '.hero-section', '.hero-section > .container', '.hero-wrapper', '.hero-grid',
  '.hero-text-side', '.hero-title', '.hero-greeting', '.hero-main-text', '.hero-bio',
  '.hero-role-line', '.hero-summary', '.hero-image-side', '.card-polaroid', '.polaroid-img',
  '.profile-about-section', '.profile-about-section-inner', '.story-gallery', '.life-camera-section',
  '.night-section', '.blank-section', '.mountain-frame', '#work', '#photography', '.contact-section'
];

const fixedNow = Date.parse('2026-09-02T16:00:00.000Z');
const weather = JSON.stringify({ current: { temperature_2m: 24.2, weather_code: 3, is_day: 0 } });

async function setup(context) {
  await context.addInitScript(({ fixedNow }) => {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixedNow])); }
      static now() { return fixedNow; }
    }
    Object.setPrototypeOf(FixedDate, NativeDate);
    window.Date = FixedDate;
    let seed = 123456789;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }, { fixedNow });
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url.includes('api.open-meteo.com/v1/forecast')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: weather });
    }
    if (/\/api\/weather(?:\?|$)/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ temperature: 24.2, weatherCode: 3, isDay: false }) });
    }
    return route.continue();
  });
}

function round(n) { return Math.round(n * 1000) / 1000; }
async function snap(page) {
  return page.evaluate((selectors) => {
    const norm = s => (s || '').replace(/\s+/g, ' ').trim();
    const data = {};
    const fields = ['display','position','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','wordSpacing','textAlign','color','backgroundColor','marginTop','marginRight','marginBottom','marginLeft','paddingTop','paddingRight','paddingBottom','paddingLeft','gap','rowGap','columnGap','transform','width','height','minHeight','maxWidth','overflow','overflowX','overflowY','justifyContent','alignItems','flexDirection','order'];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) { data[selector] = null; continue; }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const style = {};
      for (const f of fields) style[f] = cs[f];
      data[selector] = {
        tag: el.tagName,
        text: norm(el.textContent).slice(0, 280),
        innerText: norm(el.innerText).slice(0, 280),
        childCount: el.children.length,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, bottom: r.bottom },
        style,
        html: selector === '.hero-title' ? el.outerHTML : undefined,
      };
    }
    return {
      data,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      bodyText: norm(document.body.innerText),
      imgSrcs: [...document.images].map(i => i.getAttribute('src') || ''),
      fonts: [...document.fonts].map(f => ({ family: f.family, style: f.style, weight: f.weight, status: f.status })),
      dpr: devicePixelRatio,
    };
  }, selectors);
}

function diffStyles(a,b) {
  const out = [];
  for (const selector of selectors) {
    const x=a?.data?.[selector], y=b?.data?.[selector];
    if (!x || !y) { if (x!==y) out.push({selector, missing:[!x,!y]}); continue; }
    const rectDiff = {};
    for (const k of ['x','y','width','height','top','bottom']) {
      const d = Math.abs(x.rect[k]-y.rect[k]); if (d > 0.25) rectDiff[k]=[round(x.rect[k]),round(y.rect[k]),round(d)];
    }
    const styleDiff={};
    for (const k of Object.keys(x.style)) if (x.style[k]!==y.style[k]) styleDiff[k]=[x.style[k],y.style[k]];
    if (Object.keys(rectDiff).length || Object.keys(styleDiff).length || x.text!==y.text || x.childCount!==y.childCount) {
      out.push({selector, rectDiff, styleDiff, text:[x.text,y.text], innerText:[x.innerText,y.innerText], childCount:[x.childCount,y.childCount]});
    }
  }
  return out;
}

async function imageDiff(aPath,bPath,diffPath) {
  const [ab,bb]=await Promise.all([fs.readFile(aPath),fs.readFile(bPath)]);
  const a=PNG.sync.read(ab), b=PNG.sync.read(bb);
  if (a.width!==b.width || a.height!==b.height) return {dimensions:[a.width,a.height,b.width,b.height]};
  const d=new PNG({width:a.width,height:a.height});
  const count=pixelmatch(a.data,b.data,d.data,a.width,a.height,{threshold:0.1,includeAA:false});
  await fs.writeFile(diffPath,PNG.sync.write(d));
  const rows=new Array(a.height).fill(0); let minX=a.width,minY=a.height,maxX=-1,maxY=-1;
  for(let y=0;y<a.height;y++) for(let x=0;x<a.width;x++) {
    const i=(y*a.width+x)*4;
    const changed = d.data[i]!==255 || d.data[i+1]!==255 || d.data[i+2]!==255;
    if(changed){rows[y]++; if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
  }
  const clusters=[]; let start=null,sum=0,peak=0;
  for(let y=0;y<=rows.length;y++){
    const active=y<rows.length && rows[y]>0;
    if(active && start===null){start=y;sum=0;peak=0;}
    if(active){sum+=rows[y];peak=Math.max(peak,rows[y]);}
    if(!active && start!==null){clusters.push({start,end:y-1,pixels:sum,peak});start=null;}
  }
  return {width:a.width,height:a.height,diffPixels:count,diffRatio:count/(a.width*a.height),bbox:maxX>=0?{minX,minY,maxX,maxY}:null,clusters:clusters.sort((x,y)=>y.pixels-x.pixels).slice(0,20)};
}

const browser=await chromium.launch({executablePath:chrome,headless:true});
const report=[];
await fs.mkdir('qa/residuals',{recursive:true});
for(const vp of viewports){
  const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:1,reducedMotion:'reduce',locale:'en-IN'});
  await setup(context);
  const [a,b]=await Promise.all([context.newPage(),context.newPage()]);
  await Promise.all([a.goto(original+'/',{waitUntil:'domcontentloaded'}),b.goto(next+'/',{waitUntil:'domcontentloaded'})]);
  await Promise.all([a.waitForTimeout(3400),b.waitForTimeout(3400)]);
  for(const page of [a,b]){
    await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
  }
  await Promise.all([a.waitForTimeout(150),b.waitForTimeout(150)]);
  const [sa,sb]=await Promise.all([snap(a),snap(b)]);
  const pa=path.resolve(`qa/residuals/${vp.name}-home-original.png`), pb=path.resolve(`qa/residuals/${vp.name}-home-next.png`), pd=path.resolve(`qa/residuals/${vp.name}-home-diff.png`);
  const fullPage = vp.name === 'desktop';
  await Promise.all([a.screenshot({path:pa,fullPage,animations:'disabled'}),b.screenshot({path:pb,fullPage,animations:'disabled'})]);
  const diff=await imageDiff(pa,pb,pd);
  const item={viewport:vp, original:{scrollHeight:sa.scrollHeight,imgCount:sa.imgSrcs.length,fonts:sa.fonts}, next:{scrollHeight:sb.scrollHeight,imgCount:sb.imgSrcs.length,fonts:sb.fonts}, elementDiffs:diffStyles(sa,sb), diff};
  report.push(item);
  console.log(`\n${vp.name}: h=${sa.scrollHeight}/${sb.scrollHeight} img=${sa.imgSrcs.length}/${sb.imgSrcs.length} diff=${diff.diffRatio?.toFixed(6)} elements=${item.elementDiffs.length}`);
  console.log(item.elementDiffs.map(x=>({s:x.selector,r:x.rectDiff,st:Object.keys(x.styleDiff||{}),text:x.text?.[0]===x.text?.[1]})));
  console.log('clusters',diff.clusters?.slice(0,8));
  await context.close();
}
await browser.close();
await fs.writeFile('qa/residuals/report.json',JSON.stringify(report,null,2));
