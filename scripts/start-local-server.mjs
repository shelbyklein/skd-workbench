import {startLocalServer} from './launcher-service.mjs';
try{await startLocalServer();}catch(e){console.error(e.message);process.exitCode=1;}
