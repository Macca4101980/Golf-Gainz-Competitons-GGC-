export function isNoReturnScore(value){
 return value===0||String(value??'').trim()==='0';
}

export function normaliseHoleScoreInput(value){
 const text=String(value??'').trim();
 if(text==='')return '';
 if(text==='0'||/^n\/?r$/i.test(text))return 0;
 return text;
}

export function displayHoleScore(value){
 return isNoReturnScore(value)?'N/R':value??'';
}

export function decrementHoleScore(value,par){
 if(value===''||value===null||value===undefined)return Math.max(0,Number(par)||0)-1;
 if(isNoReturnScore(value))return 0;
 return Math.max(0,(Number(value)||Number(par)||0)-1);
}

export function incrementHoleScore(value,par){
 if(value===''||value===null||value===undefined)return Number(par)||0;
 if(isNoReturnScore(value))return 1;
 return (Number(value)||Number(par)||0)+1;
}
