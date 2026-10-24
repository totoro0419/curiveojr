// Import existing application logic in Node without building a second implementation.
import {readFileSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import ts from 'typescript';
const cache=new Map();
export function moduleUrl(path){
 path=resolve(path);
 if(cache.has(path))return cache.get(path);
 let source=readFileSync(path,'utf8');
 if(extname(path)==='.json')source='export default '+source+';';
 else source=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 source=source.replace(/from\s+(["'])(\.[^"']+)\1/g,(_,quote,relative)=>{
  const target=resolve(dirname(path),relative);
  return 'from '+JSON.stringify(moduleUrl(extname(target)?target:target+'.ts'));
 });
 const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');cache.set(path,url);return url;
}
export const loadTs=path=>import(moduleUrl(path));
