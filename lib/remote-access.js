import {readFileSync,statSync,writeFileSync,renameSync,rmSync} from 'node:fs';
import {createPublicKey,verify} from 'node:crypto';
import path from 'node:path';
import {assert} from './domain.js';

// Remote access is opt-in: without remote-access.json the server stays loopback-only.
// Cloudflare Access authenticates at the edge; every remote request must also carry
// its signed token, so a missing or misconfigured Access application still fails closed.
export const REMOTE_ACCESS_FILE='remote-access.json';
const LOOPBACK=/^(127\.0\.0\.1|localhost):\d+$/;

export function validateRemoteAccess(value){
 assert(value&&typeof value==='object'&&!Array.isArray(value)&&value.version===1,'Invalid remote access settings.');
 assert(Object.keys(value).every(k=>['version','host','teamDomain','audience','allowedEmails'].includes(k)),'Invalid remote access settings.');
 assert(typeof value.host==='string'&&/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value.host),'Remote host must be a lowercase domain name.');
 assert(typeof value.teamDomain==='string'&&/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(value.teamDomain),'Team domain must look like <team>.cloudflareaccess.com.');
 assert(typeof value.audience==='string'&&/^[a-f0-9]{64}$/.test(value.audience),'Audience must be the 64-character Access AUD tag.');
 assert(Array.isArray(value.allowedEmails)&&value.allowedEmails.length>=1&&value.allowedEmails.length<=20&&value.allowedEmails.every(e=>typeof e==='string'&&e.length<=254&&/^[^\s@A-Z]+@[^\s@A-Z]+\.[^\s@A-Z]+$/.test(e)),'Allowed emails must be 1–20 lowercase addresses.');
 return {version:1,host:value.host,teamDomain:value.teamDomain,audience:value.audience,allowedEmails:[...new Set(value.allowedEmails)]};
}

export function writeRemoteAccess(directory,value){
 const next=validateRemoteAccess(value),file=path.join(directory,REMOTE_ACCESS_FILE);
 writeFileSync(file+'.tmp',JSON.stringify(next,null,2),{mode:0o600});renameSync(file+'.tmp',file);return next;
}
export function removeRemoteAccess(directory){rmSync(path.join(directory,REMOTE_ACCESS_FILE),{force:true});}

async function fetchCerts(teamDomain){
 const response=await fetch(`https://${teamDomain}/cdn-cgi/access/certs`,{redirect:'error',signal:AbortSignal.timeout(5000)});
 assert(response.ok,'Could not load Cloudflare Access keys.',503);
 const text=await response.text();assert(text.length<=65536,'Cloudflare Access keys response is too large.',503);
 return JSON.parse(text);
}
const decode=part=>{assert(typeof part==='string'&&/^[A-Za-z0-9_-]+$/.test(part),'Invalid Cloudflare Access token.',403);return Buffer.from(part,'base64url');};

export class RemoteAccess {
 constructor(directory,{fetchKeys=fetchCerts,now=()=>Date.now(),refetchInterval=60000,keyLifetime=3600000}={}){
  Object.assign(this,{file:path.join(directory,REMOTE_ACCESS_FILE),fetchKeys,now,refetchInterval,keyLifetime});
  this.stamp=null;this.config=null;this.error=null;this.keys=null;this.loading=null;
 }
 // Re-read on change so enabling or disabling needs no restart.
 current(){
  let stamp=null;
  try{const s=statSync(this.file);stamp=`${s.mtimeMs}:${s.size}:${s.ino}`;}catch(e){if(e.code!=='ENOENT')throw e;}
  if(stamp!==this.stamp){
   this.stamp=stamp;this.config=null;this.error=null;this.keys=null;this.attemptedAt=undefined;
   if(stamp)try{this.config=validateRemoteAccess(JSON.parse(readFileSync(this.file,'utf8')));}catch(e){this.error=e;console.error(`Remote access disabled: ${this.file} is invalid (${e.message}).`);}
  }
  assert(!this.error,'Remote access settings are invalid. Fix them on this Mac.',503);
  return this.config;
 }
 isRemote(req){return !LOOPBACK.test(req.headers.host||'')||req.headers['cf-ray']!==undefined||req.headers['cf-connecting-ip']!==undefined||req.headers['cf-access-jwt-assertion']!==undefined;}
 // Throws a 403/503 Problem unless the request came through the configured host with a valid token.
 async admit(req,{upgrade=false}={}){
  const config=this.current(),host=req.headers.host||'',origin=req.headers.origin;
  assert(config&&host===config.host,'Local access only.',403);
  if(upgrade)assert(origin===`https://${config.host}`,'Remote origin required.',403);
  else assert(!origin||origin===`https://${config.host}`,'Cross-origin requests are not allowed.',403);
  return this.verify(req.headers['cf-access-jwt-assertion'],config);
 }
 // Unknown key IDs refetch at most once per interval, including after a failed fetch.
 async key(config,kid){
  const now=this.now(),known=this.keys&&now-this.keys.fetchedAt<=this.keyLifetime&&this.keys.byID.has(kid);
  if(!known&&(this.loading||!(now-(this.attemptedAt??-Infinity)<this.refetchInterval))){
   this.loading??=(async()=>{
    this.attemptedAt=this.now();
    try{
     const body=await this.fetchKeys(config.teamDomain),byID=new Map();
     for(const jwk of Array.isArray(body?.keys)?body.keys.slice(0,20):[])if(jwk?.kty==='RSA'&&typeof jwk.kid==='string')try{byID.set(jwk.kid,createPublicKey({key:jwk,format:'jwk'}));}catch{}
     this.keys={byID,fetchedAt:this.now()};
    }finally{this.loading=null;}
   })();
   try{await this.loading;}catch(e){console.error(`Cloudflare Access keys unavailable: ${e.message}`);assert(false,'Could not load Cloudflare Access keys. Try again shortly.',503);}
  }
  const key=this.keys?.byID.get(kid);assert(key,'Invalid Cloudflare Access token.',403);return key;
 }
 async verify(token,config=this.current()){
  assert(config,'Local access only.',403);
  assert(typeof token==='string'&&token.length>0,'Remote access requires Cloudflare Access.',403);
  assert(token.length<=8192,'Invalid Cloudflare Access token.',403);
  const parts=token.split('.');assert(parts.length===3,'Invalid Cloudflare Access token.',403);
  let header,claims;
  try{header=JSON.parse(decode(parts[0]).toString('utf8'));claims=JSON.parse(decode(parts[1]).toString('utf8'));}catch(e){assert(false,'Invalid Cloudflare Access token.',403);}
  assert(header?.alg==='RS256'&&typeof header.kid==='string','Invalid Cloudflare Access token.',403);
  const key=await this.key(config,header.kid);
  let signed=false;try{signed=verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,decode(parts[2]));}catch{}
  assert(signed,'Invalid Cloudflare Access token.',403);
  const now=this.now()/1000,audiences=Array.isArray(claims?.aud)?claims.aud:[claims?.aud];
  assert(audiences.includes(config.audience),'Cloudflare Access token is for another application.',403);
  assert(claims.iss===`https://${config.teamDomain}`,'Cloudflare Access token has the wrong issuer.',403);
  assert(Number.isFinite(claims.exp)&&claims.exp>now,'Cloudflare Access session expired. Reload to sign in again.',403);
  assert(claims.nbf===undefined||Number.isFinite(claims.nbf)&&claims.nbf<=now+60,'Cloudflare Access token is not valid yet.',403);
  const email=typeof claims.email==='string'?claims.email.toLowerCase():'';
  assert(config.allowedEmails.includes(email),'This account is not allowed to use this Workbench.',403);
  return {email};
 }
}
