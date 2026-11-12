/* Server URL registry for persistent navigation. No academic data hydration. */
(()=>{'use strict';const store=document.getElementById('workspace-routes');
const page=key=>store?.dataset[key]||null;
function matchesCourse(path){const route=page('courseDetail');if(!route)return false;const name=new URL(route,location.href).pathname,index=name.lastIndexOf('/0');if(index<0)return false;const prefix=name.slice(0,index+1),suffix=name.slice(index+2);return path.startsWith(prefix)&&path.endsWith(suffix)&&path.length>prefix.length+suffix.length}
window.ihawkRoutes={page,matchesCourse};})();
