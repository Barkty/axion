/** 
 * takes a function 
 * and returns the param names 
 */

var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
var ARGUMENT_NAMES = /([^\s,]+)/g;

function getParamNames(func) {
  // For debugging
    if (typeof func !== 'function') {
        console.error(`❌ getParamNames error: Not a function`);
        console.error(`   Module: ${func}`);
        console.error(`   Function name: ${func}`);
        console.error(`   Type: ${typeof func}`);
        console.error(`   Value:`, func);
        // throw new Error(`an exposed function not found: ${moduleName}.${functionName}`);
    }
  if(!func){
    throw Error(`an exposed function not found.`)
  }
  var fnStr = func.toString().replace(STRIP_COMMENTS, '');
  var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
  if(result === null)
     result = [];
  return result.join(" , ");
}

module.exports = getParamNames;