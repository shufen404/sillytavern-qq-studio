#!/usr/bin/env node
/** Cross-platform first-run launcher. No model calls, credentials, or OS changes. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url));
process.chdir(root);
if(Number(process.versions.node.split('.')[0])<20){console.error('QQ Studio requires Node.js 20 or newer. Install Node.js, then run this launcher again.');process.exit(1);}
const lock=fs.readFileSync(path.join(root,'package-lock.json'));
const hash=createHash('sha256').update(lock).digest('hex');
const stamp=path.join(root,'.studio-dependencies.sha256');
const ready=fs.existsSync(path.join(root,'node_modules/express/package.json'))&&fs.existsSync(stamp)&&fs.readFileSync(stamp,'utf8').trim()===hash;
if(!ready){
 console.log('First launch / dependency update: installing the locked application dependencies. Internet is required.');
 const npmArgs=['ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'];
 const install=process.platform==='win32'
   ? spawnSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c','npm.cmd '+npmArgs.join(' ')],{cwd:root,stdio:'inherit'})
   : spawnSync('npm',npmArgs,{cwd:root,stdio:'inherit'});
 if(install.error||install.status!==0){console.error('Dependency installation failed. Check Node.js/npm and network, then retry. Personal data was not reset.');process.exit(install.status||1);}
 fs.writeFileSync(stamp,hash+'\n');
}
console.log('\nSillyTavern QQ Studio | starting local server (see the listening address below)');
console.log('Your customized UI is enabled by default. Add your own model/API connection to start chatting.');
console.log('Keep this service window open. Closing it stops the server; it does NOT delete settings.\n');
const child=spawnSync(process.execPath,['server.js','--listen','false','--browserLaunchEnabled','true','--browserLaunchHostname','127.0.0.1',...process.argv.slice(2)],{cwd:root,stdio:'inherit'});
if(child.error)console.error(child.error.message);
if(child.status)console.error('Server stopped with an error. If port 8000 is in use, stop the other instance or use --port 8010.');
process.exit(child.status|| (child.error?1:0));
