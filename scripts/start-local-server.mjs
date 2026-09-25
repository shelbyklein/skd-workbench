import {startLocalServer,openWorkbench} from './launcher-service.mjs';
// --open (the Launcher opened directly): start the server if needed, then open the Workbench window.
// Without it (skd-workbench://start from an already open window): only start the server.
try{await startLocalServer();if(process.argv.includes('--open'))openWorkbench();}catch(e){console.error(e.message);process.exitCode=1;}
