// Rebuilds the lines a person submits in an interactive CLI from raw terminal keystrokes.
// Typing, backspace, Ctrl-U/Ctrl-C and bracketed pastes are exact. The CLI's own line editing
// (arrow keys, history recall, word jumps) is invisible here, so a line touched by any other
// escape sequence is dropped rather than recorded wrong.
const PASTE_START='\x1b[200~',PASTE_END='\x1b[201~',MAX=16384;
const complete=/^\x1b(?:\[[0-?]*[ -/]*[@-~]|O.|[^[O])/,partial=/^\x1b(?:\[[0-?]*[ -/]*|O)?$/;
export function createLineCollector(){
 let line='',edited=false,paste=false,pending='';
 const reset=()=>{line='';edited=false;};
 const add=text=>{line+=text;if(line.length>MAX){line='';edited=true;}};
 return {
  // Returns the lines completed by this chunk: trimmed, never empty.
  feed(data){
   const out=[],s=pending+data;pending='';
   for(let i=0;i<s.length;){
    if(paste){
     const end=s.indexOf(PASTE_END,i);
     // Hold back a possible split end marker until the next chunk.
     if(end<0){const keep=Math.max(i,s.length-PASTE_END.length+1);add(s.slice(i,keep));pending=s.slice(keep);break;}
     add(s.slice(i,end).replace(/\r\n?/g,'\n'));paste=false;i=end+PASTE_END.length;continue;
    }
    const c=s[i];
    if(c==='\x1b'){
     const rest=s.slice(i);
     if(rest.startsWith(PASTE_START)){paste=true;i+=PASTE_START.length;continue;}
     if(PASTE_START.startsWith(rest)||partial.test(rest)){pending=rest;break;}
     edited=true;i+=complete.exec(rest)?.[0].length||1;continue;
    }
    if(c==='\r'||c==='\n'){const text=line.trim();if(text&&!edited)out.push(text);reset();i++;continue;}
    if(c==='\x7f'||c==='\b'){line=Array.from(line).slice(0,-1).join('');i++;continue;}
    if(c==='\x15'||c==='\x03'){reset();i++;continue;}
    if(c>=' '||c==='\t')add(c);
    i++;
   }
   return out;
  }
 };
}
