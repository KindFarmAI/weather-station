import { UserObservation, ForecastSnapshot } from './types';
const K={l:'ap_loc',p:'ap_par',o:'ap_obs',s:'ap_slug',sn:'ap_snap'};
function gs(k:string){try{const r=localStorage.getItem(k);return r?JSON.parse(r):null;}catch{return null;}}
function ss(k:string,v:any){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
export const saveLocation=(v:any)=>ss(K.l,v);
export const loadLocation=()=>gs(K.l);
export const saveParams=(v:string[])=>ss(K.p,v);
export const loadParams=()=>gs(K.p) as string[]|null;
export const saveCitySlug=(v:string)=>ss(K.s,v);
export const loadCitySlug=()=>gs(K.s) as string|null;
export const loadObs=():UserObservation[]=>{return gs(K.o)||[];};
export function addObs(o:UserObservation){const a=loadObs();a.unshift(o);if(a.length>365)a.length=365;ss(K.o,a);}
export function delObs(id:string){ss(K.o,loadObs().filter((o:UserObservation)=>o.id!==id));}
export const loadSnaps=():ForecastSnapshot[]=>{return gs(K.sn)||[];};
export function addSnaps(arr:ForecastSnapshot[]){const all=loadSnaps();all.push(...arr);if(all.length>500)all.splice(0,all.length-500);ss(K.sn,all);}
export function clearSnaps(){ss(K.sn,[]);}
export function gid():string{return Date.now().toString(36)+Math.random().toString(36).substring(2,8);}
export function expCSV(obs:UserObservation[]):string{
  return '\uFEFFДата;Температура;Влажность;Осадки;Ветер;Примечания\n'+obs.map(o=>o.date+';'+o.temp+';'+o.humidity+';'+o.precip+';'+o.wind+';'+o.notes).join('\n');
}
export function dlCSV(csv:string,fn:string){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));a.download=fn;a.click();}
