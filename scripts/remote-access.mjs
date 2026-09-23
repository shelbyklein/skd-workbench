#!/usr/bin/env node
// Enables, disables or shows Cloudflare Access remote access for the data directory.
// The running server re-reads the file, so changes apply without a restart.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {RemoteAccess,writeRemoteAccess,removeRemoteAccess} from '../lib/remote-access.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const usage=`Usage:
  npm run remote-access -- --host workbench.example.com --team <team>.cloudflareaccess.com --aud <AUD tag> --email you@example.com
  npm run remote-access -- --status
  npm run remote-access -- --disable`;

export function run(args,{directory=process.env.FLOW_BENCH_DATA||path.join(root,'.data')}={}){
 const {values}=parseArgs({args,options:{host:{type:'string'},team:{type:'string'},aud:{type:'string'},email:{type:'string',multiple:true},status:{type:'boolean'},disable:{type:'boolean'}},strict:true});
 if(values.disable){removeRemoteAccess(directory);return 'Remote access disabled. Only this Mac can open the Workbench.';}
 if(values.status){const config=new RemoteAccess(directory).current();return config?`Remote access enabled for https://${config.host} (Cloudflare Access team ${config.teamDomain}; allowed: ${config.allowedEmails.join(', ')}).`:'Remote access disabled.';}
 if(!values.host||!values.team||!values.aud||!values.email)throw Error(usage);
 const config=writeRemoteAccess(directory,{version:1,host:values.host,teamDomain:values.team,audience:values.aud,allowedEmails:values.email.map(e=>e.toLowerCase())});
 return `Remote access enabled for https://${config.host}. Requests must carry a Cloudflare Access token for ${config.allowedEmails.join(', ')}.`;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(run(process.argv.slice(2)));}catch(e){console.error(e.message);process.exitCode=1;}
}
