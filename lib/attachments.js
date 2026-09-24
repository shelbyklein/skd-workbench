// Files pasted or attached in a conversation's message box. Each is saved under the data folder and
// the message carries its absolute path, so the agent CLI can read it (images included).
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Problem} from './domain.js';

export const attachmentLimit=20*1024*1024;
export const safeAttachmentName=name=>{
 const base=path.basename(String(name||'')).replace(/[^\w.\- ]+/g,'_').replace(/^[.\s]+/,'').trim().slice(0,120);
 return base||'attachment';
};
export class Attachments{
 constructor(directory){this.directory=path.join(directory,'attachments');}
 save(name,bytes){
  if(!bytes.length)throw new Problem('The file is empty.');
  if(bytes.length>attachmentLimit)throw new Problem('Attachments are limited to 20 MiB.',413);
  const folder=path.join(this.directory,randomUUID()),file=path.join(folder,safeAttachmentName(name));
  mkdirSync(folder,{recursive:true,mode:0o700});writeFileSync(file,bytes,{mode:0o600});
  return {name:path.basename(file),path:file,size:bytes.length};
 }
}
