// node-pty's packaged Unix helper needs its executable bit on fresh installs.
import {chmodSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url),root=path.dirname(require.resolve('node-pty/package.json'));
if(process.platform!=='win32')for(const rel of [`prebuilds/${process.platform}-${process.arch}/spawn-helper`,'build/Release/spawn-helper']){const file=path.join(root,rel);if(existsSync(file))chmodSync(file,0o755);}
