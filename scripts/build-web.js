const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),output=path.join(root,'dist');fs.mkdirSync(output,{recursive:true});
const pages=['index.html','entry_recorder.html','cleaner.html','charging.html','scheduler.html','manager.html','admin.html','mobile_admin.html'];
for(const file of pages)fs.copyFileSync(path.join(root,file),path.join(output,file));
for(const folder of ['src/js','src/css','src/data'])fs.cpSync(path.join(root,folder),path.join(output,folder),{recursive:true});
console.log('Android web assets prepared in dist.');
