import {Marked} from './vendor/marked.js';
import DOMPurify from './vendor/dompurify.js';

const markdown=new Marked({gfm:true,breaks:false});
const allowedTags=['a','blockquote','br','code','del','em','h1','h2','h3','h4','h5','h6','hr','input','li','ol','p','pre','s','strong','table','tbody','td','th','thead','tr','ul'];
const allowedAttributes=['checked','class','disabled','href','rel','start','target','title','type'];

DOMPurify.addHook('afterSanitizeAttributes',node=>{
 if(node.nodeName==='A'&&node.hasAttribute('href')){node.setAttribute('target','_blank');node.setAttribute('rel','noopener noreferrer');}
 if(node.nodeName==='INPUT'){node.setAttribute('type','checkbox');node.setAttribute('disabled','');}
});

export function renderMarkdown(source,fallback=''){
 const text=String(source??'').trim()?String(source):fallback;
 return DOMPurify.sanitize(markdown.parse(text),{ALLOWED_TAGS:allowedTags,ALLOWED_ATTR:allowedAttributes,ALLOW_DATA_ATTR:false,SANITIZE_NAMED_PROPS:true});
}
