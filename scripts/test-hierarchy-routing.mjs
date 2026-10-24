import assert from "node:assert/strict";
import {loadTs} from "./load-typescript.mjs";
const {catalog}=await loadTs("src/catalog.ts");
const {learningNodes,hierarchyRoots,nodeHref,nodeVideos,recoveryHrefForMissingNode}=await loadTs("src/navigation/hierarchy.ts");
assert.equal(catalog.subjects.length,4);
for(const subject of catalog.subjects){
 const root=learningNodes.get(hierarchyRoots[subject.id]);
 assert.ok(root,"Root missing: "+subject.id);
 assert.ok(nodeVideos(root.id).length>0,"No indexed lessons for "+subject.id);
 assert.equal(nodeHref(root),"#/subject/"+subject.id);
 assert.equal(recoveryHrefForMissingNode("learn-"+subject.id+"-oldhash"),"#/subject/"+subject.id);
 assert.equal(recoveryHrefForMissingNode(undefined,subject.id),"#/subject/"+subject.id);
}
assert.equal(recoveryHrefForMissingNode("learn-japanese-history-legacy"),"#/subject/japanese-history");
assert.equal(recoveryHrefForMissingNode("unrecognized-category"),"#/discover");
for(const node of learningNodes.values()){
 if(node.kind==="subject")continue;
 const href=nodeHref(node);
 if(node.id==='field-japanese-history:歴史'){
  assert.equal(href,'#/history');
  continue;
 }
 assert.ok(href.startsWith("#/category/"));
 const id=decodeURIComponent(href.slice("#/category/".length));
 assert.equal(id,node.id,"Category deep link must roundtrip");
 assert.ok(learningNodes.has(id));
}
const special={id:"field-mathematics:割合/比?検査",kind:"field",subjectId:"mathematics"};
assert.equal(decodeURIComponent(nodeHref(special).slice("#/category/".length)),special.id);
console.log("Category links and legacy route recovery: PASS ("+learningNodes.size+" nodes)");
