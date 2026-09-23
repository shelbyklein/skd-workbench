import {generateKeyPairSync,sign} from 'node:crypto';

// A fixture Cloudflare Access team: one RSA signing key, its JWKS and a token signer.
export const remoteConfig={version:1,host:'workbench.example.com',teamDomain:'fixture-team.cloudflareaccess.com',audience:'a'.repeat(64),allowedEmails:['owner@example.com']};
export function accessFixture({kid='fixture-key'}={}){
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const jwks={keys:[{...publicKey.export({format:'jwk'}),kid,alg:'RS256',use:'sig'}]};
 const fetches=[];
 const token=(claims={},header={})=>{
  const now=Math.floor(Date.now()/1000);
  const part=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const body=part({alg:'RS256',kid,typ:'JWT',...header})+'.'+part({aud:[remoteConfig.audience],iss:`https://${remoteConfig.teamDomain}`,email:remoteConfig.allowedEmails[0],iat:now,nbf:now,exp:now+600,...claims});
  return body+'.'+sign('RSA-SHA256',Buffer.from(body),privateKey).toString('base64url');
 };
 return {jwks,token,fetches,fetchKeys:async team=>{fetches.push(team);return jwks;}};
}
