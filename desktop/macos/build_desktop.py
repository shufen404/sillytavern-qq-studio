#!/usr/bin/env python3
"""Build a local macOS ARM64 .app. No user data or credentials are bundled."""
import argparse,json,plistlib,shutil,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--engine',type=Path,required=True);p.add_argument('--dependencies',type=Path,required=True);p.add_argument('--runtime',type=Path,required=True);p.add_argument('--binary',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--icon',type=Path);p.add_argument('--test-data',type=Path);a=p.parse_args()
if a.output.exists():raise SystemExit('Refusing to overwrite an existing .app: '+str(a.output))
resources=a.output/'Contents/Resources';macos=a.output/'Contents/MacOS';macos.mkdir(parents=True);resources.mkdir(parents=True)
shutil.copy2(a.binary,macos/'QQStudio');(macos/'QQStudio').chmod(0o755)
engine=resources/'Engine';engine.mkdir()
skip={'.git','node_modules','data','backups','runtime','config.yaml','.DS_Store','.studio-dependencies.sha256','.studio-ui-backups'}
for src in a.engine.iterdir():
 if src.name in skip or src.name.endswith('.log'):continue
 if src.is_dir():shutil.copytree(src,engine/src.name,symlinks=True,ignore=shutil.ignore_patterns('.DS_Store','__pycache__'))
 else:shutil.copy2(src,engine/src.name)
shutil.copytree(a.dependencies,engine/'node_modules',symlinks=True)
run=resources/'runtime';(run/'bin').mkdir(parents=True);(run/'lib/node_modules').mkdir(parents=True)
shutil.copy2(a.runtime/'bin/node',run/'bin/node');shutil.copy2(a.runtime/'LICENSE',run/'LICENSE')
shutil.copytree(a.runtime/'lib/node_modules/npm',run/'lib/node_modules/npm',symlinks=True)
(run/'bin/npm').symlink_to('../lib/node_modules/npm/bin/npm-cli.js');(run/'bin/npx').symlink_to('../lib/node_modules/npm/bin/npx-cli.js')
for link in resources.rglob('*'):
 if link.is_symlink() and not link.resolve().is_relative_to(resources.resolve()):raise SystemExit('External symlink: '+str(link))
health={'product':'QQ Studio Desktop','version':'1.1.0'}
(engine/'public/desktop-health.json').write_text(json.dumps(health)+'\n')
info={'CFBundleName':'SillyTavern QQ Studio','CFBundleDisplayName':'SillyTavern QQ Studio','CFBundleExecutable':'QQStudio','CFBundleIdentifier':'io.shufen.qqstudio.desktop','CFBundlePackageType':'APPL','CFBundleShortVersionString':'1.1.0','CFBundleVersion':'110','LSMinimumSystemVersion':'13.0','LSMultipleInstancesProhibited':True,'NSHighResolutionCapable':True,'NSPrincipalClass':'NSApplication','NSAppTransportSecurity':{'NSAllowsLocalNetworking':True},'QQStudioPort':8020}
if a.icon and a.icon.exists():shutil.copy2(a.icon,resources/'AppIcon.icns');info['CFBundleIconFile']='AppIcon.icns'
if a.test_data:
 info.update(CFBundleIdentifier='io.shufen.qqstudio.desktop.test',CFBundleDisplayName='QQ Studio Desktop Test',QQStudioPort=8021,QQStudioDataDirectory=str(a.test_data.resolve()))
(resources/'Desktop-Source').mkdir();shutil.copy2(Path(__file__).with_name('App.swift'),resources/'Desktop-Source/App.swift')
with (a.output/'Contents/Info.plist').open('wb') as f:plistlib.dump(info,f)
(a.output/'Contents/PkgInfo').write_text('APPL????')
subprocess.run(['/usr/bin/codesign','--force','--deep','--sign','-',str(a.output)],check=True)
print('Built:',a.output)
