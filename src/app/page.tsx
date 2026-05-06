'use client';
import {useState,useEffect,useCallback,useRef,useMemo} from 'react';
import{GeoLocation,ForecastSource,ArchiveDay,UserObservation,ForecastSnapshot,WEATHER_PARAMS,DEFAULT_PARAMS,getWeatherDesc,getWeatherEmoji}from'@/lib/types';
import{searchLocations,fetchECMWF,fetchGFS,fetchICON,fetchYandex,fetchRecentArchive,fetchERA5Archive,formatDate,formatDateFull,getPrecipClass,todayStr,daysAgo,fmt,pbw}from'@/lib/api';
import{saveLocation,loadLocation,saveParams,loadParams,saveCitySlug,loadCitySlug,loadObs,addObs,delObs,loadSnaps,addSnaps,clearSnaps,gid,expCSV,dlCSV}from'@/lib/storage';

const DL:GeoLocation={name:'Белореченск',lat:44.7844,lon:40.1169,country:'Россия',admin1:'Краснодарский край',displayName:'Белореченск, Краснодарский край, Россия'};
function es(id:string,nm:string,md:string):ForecastSource{return{id,name:nm,model:md,daily:[],hourly:[],loaded:false,error:null,loading:true};}

export default function Home(){
  const[loc,setLoc]=useState<GeoLocation>(DL);
  const[sq,setSq]=useState('');const[sr,setSr]=useState<GeoLocation[]>([]);const[ssOn,setSsOn]=useState(false);
  const stR=useRef<NodeJS.Timeout|null>(null);
  const[tab,setTab]=useState(0);
  const[srcs,setSrcs]=useState<ForecastSource[]>([es('ecmwf','ECMWF IFS','ecmwf_ifs'),es('gfs','GFS (Windy)','gfs_seamless'),es('icon','ICON-EU','icon_eu'),{id:'yandex',name:'Яндекс',model:'yandex',daily:[],hourly:[],loaded:false,error:null,loading:false}]);
  const[fcD,setFcD]=useState(7);
  const[selD,setSelD]=useState<string|null>(null);const[selS,setSelS]=useState<string|null>(null);const[showHr,setShowHr]=useState(false);
  const[params,setParams]=useState<string[]>(DEFAULT_PARAMS);
  const[showPS,setShowPS]=useState(false);
  const[ad,setAd]=useState<ArchiveDay[]>([]);const[adL,setAdL]=useState(false);const[adD,setAdD]=useState(14);
  const[adS,setAdS]=useState(daysAgo(30));const[adE,setAdE]=useState(daysAgo(0));const[adM,setAdM]=useState<'r'|'c'>('r');
  const[obs,setObs]=useState<UserObservation[]>([]);const[ofOn,setOfOn]=useState(false);
  const[of,setOf]=useState({temp:'',humidity:'',precip:'',wind:'',notes:'',date:todayStr()});
  const[snaps,setSnaps]=useState<ForecastSnapshot[]>([]);
  const[archFact,setArchFact]=useState<ArchiveDay[]>([]);const[afL,setAfL]=useState(false);

  useEffect(()=>{const l=loadLocation();if(l)setLoc(l as GeoLocation);const p=loadParams();if(p)setParams(p);setObs(loadObs());setSnaps(loadSnaps());},[]);

  const loadFc=useCallback(async(l:GeoLocation,days:number)=>{
    setSrcs(p=>p.map(s=>({...s,loaded:false,loading:true,error:null,daily:[],hourly:[]})));
    const[e,g,ic]=await Promise.all([fetchECMWF(l.lat,l.lon,days),fetchGFS(l.lat,l.lon,days),fetchICON(l.lat,l.lon,Math.min(days,7))]);
    setSrcs(p=>{const u=[...p];for(const r of[e,g,ic]){const i=u.findIndex(s=>s.id===r.id);if(i>=0)u[i]=r;}return u;});
    const sl=loadCitySlug()||l.name.toLowerCase().replace(/\s+/g,'-');
    saveCitySlug(sl);
    setSrcs(p=>{const u=[...p];const yi=u.findIndex(s=>s.id==='yandex');if(yi>=0)u[yi]={...u[yi],loading:true};return u;});
    fetchYandex(sl).then(yr=>setSrcs(p=>{const u=[...p];const i=u.findIndex(s=>s.id==='yandex');if(i>=0)u[i]=yr;return u;}));
  },[]);

  useEffect(()=>{loadFc(loc,fcD);},[loc,fcD,loadFc]);

  const loadArch=useCallback(async()=>{
    setAdL(true);setAd([]);let d:ArchiveDay[]=[];
    if(adM==='r'){d=await fetchRecentArchive(loc.lat,loc.lon,adD);}
    else{const diff=Math.floor((Date.now()-new Date(adS+'T00:00:00').getTime())/864e5);
      d=diff<=92?await fetchRecentArchive(loc.lat,loc.lon,diff):await fetchERA5Archive(loc.lat,loc.lon,adS,adE);}
    setAd(d);setAdL(false);
  },[loc,adM,adD,adS,adE]);

  const saveSnapsNow=()=>{
    const loaded=srcs.filter(s=>s.loaded&&s.daily.length>0);
    if(!loaded.length){alert('Нет загруженных прогнозов');return;}
    const now=new Date().toISOString();
    const ns:ForecastSnapshot[]=loaded.map(s=>({id:gid(),savedAt:now,sourceId:s.id,sourceName:s.name,
      forecasts:s.daily.map(d=>({date:d.date,tempMax:d.tempMax,tempMin:d.tempMin,precipSum:d.precipSum,windMax:d.windMax,precipProb:d.precipProb}))}));
    addSnaps(ns);setSnaps(loadSnaps());
  };
  const loadFacts=async()=>{setAfL(true);const d=await fetchRecentArchive(loc.lat,loc.lon,60);setArchFact(d);setAfL(false);};
  const hSrch=(q:string)=>{setSq(q);if(stR.current)clearTimeout(stR.current);if(q.length<2){setSr([]);return;}
    stR.current=setTimeout(async()=>{try{setSr(await searchLocations(q));}catch{setSr([]);}},400);};
  const sLoc=(l:GeoLocation)=>{setLoc(l);saveLocation(l as any);setSq('');setSr([]);setSsOn(false);setSelD(null);setShowHr(false);};
  const togP=(pid:string)=>setParams(p=>{const n=p.includes(pid)?p.filter(x=>x!==pid):[...p,pid];saveParams(n);return n;});
  const addO=()=>{if(!of.date)return;
    addObs({id:gid(),date:of.date,temp:of.temp,humidity:of.humidity,precip:of.precip,wind:of.wind,notes:of.notes,createdAt:new Date().toISOString()});
    setObs(loadObs());setOf({temp:'',humidity:'',precip:'',wind:'',notes:'',date:todayStr()});setOfOn(false);};
  const delO=(id:string)=>{delObs(id);setObs(loadObs());};
  const actS=()=>srcs.find(s=>s.id===(selS||'ecmwf'))||srcs[0];
  const rpv=(day:any,pid:string)=>{const p=WEATHER_PARAMS.find(x=>x.id===pid);if(!p)return'—';const v=(day as any)[pid];if(v==null)return'—';
    if(pid==='sunrise'||pid==='sunset'){const d=new Date(v);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
    if(pid==='uvIndexMax')return v.toFixed(1)+' '+(v>=8?'(опасно)':v>=6?'(выс.)':v>=3?'(умер.)':'(низ.)');
    if(pid==='et0')return v.toFixed(1)+' '+p.unit;return fmt(v)+' '+p.unit;};

  const TABS=['Прогноз','Сравнение','Архив','Точность','Наблюдения'];
  const TIC=['🌡','📊','📅','🎯','📝'];

  const accRows = useMemo(() => {
    if (!snaps.length || !archFact.length) return [];
    const rows: { date: string; fact: ArchiveDay; forecasts: { name: string; tempMax: number|null; tempMin: number|null; precipSum: number|null; daysBefore: number }[] }[] = [];
    for (const fact of archFact) {
      const fcs: typeof rows[0]['forecasts'] = [];
      for (const snap of snaps) {
        const fc = snap.forecasts.find(f => f.date === fact.date);
        if (!fc) continue;
        const db = Math.round((new Date(fact.date + 'T12:00:00').getTime() - new Date(snap.savedAt).getTime()) / 864e5);
        fcs.push({ name: snap.sourceName, tempMax: fc.tempMax, tempMin: fc.tempMin, precipSum: fc.precipSum, daysBefore: db });
      }
      if (fcs.length) rows.push({ date: fact.date, fact, forecasts: fcs });
    }
    return rows;
  }, [snaps, archFact]);

  return(
  <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
    <header className="bg-white shadow-sm border-b border-green-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl">🌾</span>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-green-800 leading-tight">АгроПогода</h1>
              <button onClick={()=>setSsOn(!ssOn)} className="text-xs text-green-600 hover:text-green-800 truncate block">
                📍 {loc.name}{loc.admin1?<span className="text-gray-400">, {loc.admin1}</span>:null} <span className="text-gray-300">✏️</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 mr-1">Срок:</span>
            {[3,7,10,14].map(d=><button key={d} onClick={()=>{setFcD(d);setSelD(null);setShowHr(false);}} className={'px-2 py-1 rounded-full text-xs font-medium transition '+(fcD===d?'bg-green-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200')}>{d}д</button>)}
          </div>
          <button onClick={()=>loadFc(loc,fcD)} className="px-2 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">🔄 Обн.</button>
        </div>
        {ssOn&&<div className="mt-2 relative">
          <input type="text" value={sq} onChange={e=>hSrch(e.target.value)} placeholder="Введите город..." className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:outline-none focus:border-green-500 text-sm" autoFocus/>
          {sr.length>0&&<div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
            {sr.map((r,i)=><button key={i} onClick={()=>sLoc(r)} className="w-full px-3 py-2 text-left hover:bg-green-50 border-b last:border-0 block">
              <div className="font-medium text-gray-800 text-sm">{r.name}</div><div className="text-xs text-gray-500 truncate">{r.displayName}</div></button>)}
          </div>}
          <button onClick={()=>{setSsOn(false);setSr([]);}} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>}
        <div className="flex mt-2 border-t border-green-100 pt-1 -mx-3 px-3 overflow-x-auto">
          {TABS.map((t,i)=><button key={i} onClick={()=>{setTab(i);setSelD(null);setShowHr(false);}} className={'tb '+(tab===i?'on':'')}>{TIC[i]} {t}</button>)}
        </div>
      </div>
    </header>

    <main className="max-w-7xl mx-auto px-3 py-3">
      <div className="mb-3 flex items-center gap-1 flex-wrap">
        <button onClick={()=>setShowPS(!showPS)} className="text-xs text-green-700 hover:text-green-900 font-medium">⚙️ Парам.({params.length})</button>
        {params.map(pid=>{const p=WEATHER_PARAMS.find(x=>x.id===pid);return p?<span key={pid} className="pb on">{p.icon}{p.label}<span onClick={()=>togP(pid)} className="ml-0.5 cursor-pointer text-green-400 hover:text-red-500">✕</span></span>:null;})}
      </div>
      {showPS&&<div className="mb-3 p-3 bg-white rounded-lg border shadow-sm">
        <div className="flex flex-wrap gap-1">{WEATHER_PARAMS.map(p=><button key={p.id} onClick={()=>togP(p.id)} className={'pb '+(params.includes(p.id)?'on':'')}>{p.icon}{p.label}<span className="text-xs opacity-50">{p.unit}</span></button>)}</div></div>}

      {/* TAB 0: FORECAST */}
      {tab===0&&<div>
        <div className="flex gap-1 mb-3 flex-wrap">
          {srcs.map(s=><button key={s.id} onClick={()=>{setSelS(s.id);setSelD(null);setShowHr(false);}}
            className={'px-2 py-1.5 rounded-lg text-xs font-medium transition '+((!selS&&s.id==='ecmwf')||selS===s.id?(s.id==='yandex'?'bg-yellow-500 text-white shadow':'bg-green-600 text-white shadow'):s.loaded?'bg-white text-gray-600 hover:bg-gray-50 border':'bg-gray-100 text-gray-400 border border-dashed')}>
            {s.loading&&<span className="sp mr-1"/>}{s.name}{s.loaded&&<span className="ml-1 opacity-60">✓</span>}{s.error&&<span className="ml-1" title={s.error}>⚠</span>}
          </button>)}
        </div>
        {(()=>{const s=actS();if(s.loading)return<div className="flex items-center gap-2 p-6"><div className="sp"/>Загрузка {s.name}...</div>;
          if(s.error&&!s.loaded)return<div className="p-4 bg-red-50 rounded-lg text-red-700 text-sm">Ошибка: {s.error}</div>;
          if(!s.daily.length)return<div className="p-4 text-gray-400">Нет данных</div>;
          return<div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
            <table className="dt"><thead><tr><th>Дата</th><th>Погода</th>{params.map(pid=>{const p=WEATHER_PARAMS.find(x=>x.id===pid);return p?<th key={pid}>{p.icon}{p.label}</th>:null;})}</tr></thead>
            <tbody>{s.daily.map(d=><tr key={d.date} onClick={()=>{setSelD(d.date);setShowHr(true);}} className={'cursor-pointer '+(selD===d.date?'cur':'')}>
              <td className="font-medium">{formatDate(d.date)}{d.date===todayStr()&&<span className="ml-1 text-xs bg-green-100 text-green-700 px-1 rounded">сег.</span>}</td>
              <td><span className="mr-0.5">{getWeatherEmoji(d.weatherCode)}</span><span className="text-xs text-gray-500">{getWeatherDesc(d.weatherCode)}</span></td>
              {params.map(pid=>pid==='precipSum'?<td key={pid}><div className="flex items-center gap-1"><span className={d.precipSum&&d.precipSum>0?'text-blue-600 font-medium':''}>{fmt(d.precipSum)}</span><div className="pb-bar"><div className={'pb-fill '+getPrecipClass(d.precipSum)} style={{width:pbw(d.precipSum)+'%'}}/></div></div></td>:<td key={pid}>{rpv(d,pid)}</td>)}
            </tr>)}</tbody></table></div>;})()}
        {showHr&&selD&&(()=>{const s=actS();if(!s.hourly.length)return<div className="mt-3 p-3 bg-yellow-50 rounded-lg text-yellow-700 text-sm">Почасовые данные недоступны для {s.name}</div>;
          const hr=s.hourly.filter(h=>h.time.startsWith(selD));if(!hr.length)return null;
          return<div className="mt-3 bg-white rounded-lg shadow-sm border overflow-x-auto">
            <div className="px-3 py-2 bg-blue-50 rounded-t-lg border-b flex items-center justify-between">
              <h3 className="font-semibold text-blue-800 text-sm">📋 Почасовой отчёт: {formatDateFull(selD)}</h3>
              <button onClick={()=>setShowHr(false)} className="text-gray-400 hover:text-gray-600">✕</button></div>
            <table className="dt"><thead><tr><th>Время</th><th>🌡Т</th><th>🌧Осадки</th><th>💨Ветер</th><th>💧Влажн.</th><th>📊Давл.</th><th>Погода</th></tr></thead>
            <tbody>{hr.map((h,i)=><tr key={i}>
              <td className="font-medium">{h.time.split('T')[1]?.substring(0,5)}</td>
              <td className={h.temp!=null&&h.temp>30?'text-red-600 font-medium':h.temp!=null&&h.temp<0?'text-blue-600 font-medium':''}>{fmt(h.temp,0)}°C</td>
              <td className={h.precip&&h.precip>0?'text-blue-600 font-medium':''}>{fmt(h.precip)}мм</td>
              <td>{fmt(h.windSpeed,0)}км/ч</td>
              <td>{fmt(h.humidity,0)}%</td>
              <td>{h.pressure?(h.pressure/100*0.75006).toFixed(1):'—'}мм</td>
              <td><span className="mr-0.5">{getWeatherEmoji(h.weatherCode)}</span><span className="text-xs text-gray-500">{getWeatherDesc(h.weatherCode)}</span></td>
            </tr>)}</tbody></table></div>;})()}
      </div>}

      {/* TAB 1: COMPARE */}
      {tab===1&&<div>
        <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          {(()=>{
            const ls=srcs.filter(s=>s.loaded);
            const srcColors: Record<string,string>={ecmwf:'text-green-700',gfs:'text-blue-700',icon:'text-purple-700',yandex:'text-yellow-700'};
            return <table className="dt"><thead>
              <tr><th>Дата</th>{ls.map(s=><th key={s.id} colSpan={params.length} className="text-center"><span className={srcColors[s.id]||''}>{s.name}</span></th>)}</tr>
              <tr><th></th>{ls.flatMap(s=>params.map(pid=>{const p=WEATHER_PARAMS.find(x=>x.id===pid);return<th key={s.id+'-'+pid} className="text-xs">{p?.label}</th>;}))}</tr>
            </thead><tbody>
              {!ls.length?<tr><td colSpan={99} className="text-center p-4 text-gray-400">Загрузка...</td></tr>:
              Array.from({length:Math.max(...ls.map(s=>s.daily.length))},(_,i)=>{
                const d0=ls[0].daily[i]?.date;
                return <tr key={i} onClick={()=>{setSelD(d0||null);setShowHr(true);}} className={'cursor-pointer '+(selD===d0?'cur':'')}>
                  <td className="font-medium">{d0?formatDate(d0):''}</td>
                  {ls.map(s=>{const d=s.daily[i];if(!d)return params.map(pid=><td key={s.id+'-'+pid}>—</td>);
                    return params.map(pid=>{
                      if(pid==='precipSum') return <td key={s.id+'-'+pid}><span className={d.precipSum&&d.precipSum>0?'text-blue-600 font-medium':''}>{fmt(d.precipSum)}</span></td>;
                      return <td key={s.id+'-'+pid}>{rpv(d,pid)}</td>;
                    });})}
                </tr>;
              })}
            </tbody></table>;
          })()}
        </div>
        {selD&&(()=>{const ls=srcs.filter(s=>s.loaded&&s.daily.find(d=>d.date===selD));if(ls.length<2)return null;
          return<div className="mt-3 bg-white rounded-lg shadow-sm border p-3">
            <h3 className="font-semibold mb-2 text-gray-700 text-sm">📊 Сводка за {formatDateFull(selD)}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              {['tempMax','tempMin','precipSum','windMax'].filter(p=>params.includes(p)).map(pid=>{
                const p=WEATHER_PARAMS.find(x=>x.id===pid);const vals=ls.map(s=>{const d=s.daily.find(dd=>dd.date===selD);return{name:s.name,val:d?(d as any)[pid]:null};}).filter(v=>v.val!=null);
                if(!vals.length)return null;const nv=vals.map(v=>v.val as number);const avg=nv.reduce((a,b)=>a+b,0)/nv.length;
                return<div key={pid} className="p-2 bg-gray-50 rounded-lg"><div className="text-xs text-gray-500">{p?.icon}{p?.label}</div>
                  <div className="text-base font-bold">{avg.toFixed(1)} {p?.unit}</div>
                  <div className="text-xs text-gray-400">Δ: {(Math.max(...nv)-Math.min(...nv)).toFixed(1)}</div>
                  <div className="mt-1 flex flex-wrap gap-0.5">{vals.map(v=><span key={v.name} className="text-xs px-1 bg-white rounded border">{v.name}: {v.val.toFixed(1)}</span>)}</div></div>;})}
            </div></div>;})()}
      </div>}

      {/* TAB 2: ARCHIVE */}
      {tab===2&&<div>
        <div className="bg-white rounded-lg shadow-sm border p-3 mb-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="flex gap-1">
              <button onClick={()=>setAdM('r')} className={'px-2 py-1 rounded text-xs font-medium '+(adM==='r'?'bg-green-600 text-white':'bg-gray-100 text-gray-600')}>Последние</button>
              <button onClick={()=>setAdM('c')} className={'px-2 py-1 rounded text-xs font-medium '+(adM==='c'?'bg-green-600 text-white':'bg-gray-100 text-gray-600')}>Произвольный</button>
            </div>
            {adM==='r'?<div className="flex items-center gap-1"><span className="text-xs text-gray-500">Дней:</span>{[7,14,30,60,90].map(d=><button key={d} onClick={()=>setAdD(d)} className={'px-2 py-0.5 rounded text-xs '+(adD===d?'bg-green-100 text-green-700 font-medium':'text-gray-500 hover:bg-gray-100')}>{d}</button>)}</div>:
            <div className="flex items-center gap-1 flex-wrap"><span className="text-xs text-gray-500">С:</span><input type="date" value={adS} onChange={e=>setAdS(e.target.value)} className="px-2 py-1 border rounded text-xs"/><span className="text-xs text-gray-500">По:</span><input type="date" value={adE} onChange={e=>setAdE(e.target.value)} className="px-2 py-1 border rounded text-xs"/></div>}
            <button onClick={loadArch} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">{adL?'...':'Загрузить'}</button>
          </div>
          <div className="text-xs text-gray-400">ℹ️ {adM==='r'?'ECMWF IFS анализ (~9 км) — ближе к реальным данным станций, чем ERA5.':'ERA5 реанализ (~31 км). Осадки могут быть занижены.'}</div>
        </div>
        {adL?<div className="flex items-center gap-2 p-6"><div className="sp"/>Загрузка...</div>:
        ad.length>0?<div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          <table className="dt"><thead><tr><th>Дата</th><th>🌡Т макс</th><th>🌡Т мин</th><th>🌧Осадки</th><th>Осадки</th><th>💨Ветер</th><th>Источник</th></tr></thead>
          <tbody>{[...ad].reverse().map(d=><tr key={d.date} className={'cursor-pointer '+(selD===d.date?'cur':'')} onClick={()=>setSelD(d.date)}>
            <td className="font-medium">{formatDate(d.date)}</td>
            <td className={d.tempMax!=null&&d.tempMax>35?'text-red-600 font-medium':''}>{fmt(d.tempMax)}°C</td><td>{fmt(d.tempMin)}°C</td>
            <td className={d.precipSum!=null&&d.precipSum>0?'text-blue-600 font-bold':''}>{fmt(d.precipSum)}мм</td>
            <td><div className="pb-bar"><div className={'pb-fill '+getPrecipClass(d.precipSum)} style={{width:pbw(d.precipSum)+'%'}}/></div></td>
            <td>{fmt(d.windMax,0)}км/ч</td>
            <td><span className={'text-xs px-1.5 py-0.5 rounded-full '+(d.source==='ecmwf_ifs'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700')}>{d.source==='ecmwf_ifs'?'ECMWF IFS':'ERA5'}</span></td>
          </tr>)}</tbody></table>
          <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-600 flex flex-wrap gap-3">
            <span>{formatDate(ad[0]?.date)} — {formatDate(ad[ad.length-1]?.date)}</span><span>{ad.length} дн.</span>
            {(()=>{const pp=ad.map(d=>d.precipSum).filter((v):v is number=>v!=null);if(!pp.length)return null;const t=pp.reduce((a,b)=>a+b,0);
              return<><span>Σ:{t.toFixed(1)}мм</span><span>Макс:{Math.max(...pp).toFixed(1)}мм</span><span>Ср/дн:{(t/pp.length).toFixed(1)}мм</span></>;})()}
          </div></div>:<div className="p-6 text-center text-gray-400">Нажмите «Загрузить»</div>}
      </div>}

      {/* TAB 3: ACCURACY */}
      {tab===3&&<div>
        <div className="bg-white rounded-lg shadow-sm border p-3 mb-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <button onClick={saveSnapsNow} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">💾 Сохранить прогноз</button>
            <button onClick={loadFacts} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">{afL?'...':'📊 Загрузить факты (60 дн.)'}</button>
            {snaps.length>0&&<button onClick={()=>{if(confirm('Удалить все снапшоты?')){clearSnaps();setSnaps([]);}}} className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200">🗑 Очистить</button>}
            <span className="text-xs text-gray-400">Снапшотов: {snaps.length} | Фактов: {archFact.length}</span>
          </div>
          <div className="text-xs text-gray-500 leading-relaxed">
            💡 <strong>Как пользоваться:</strong> Каждый день нажимайте «Сохранить прогноз» — система запомнит прогнозы всех моделей. Когда появятся фактические данные, нажмите «Загрузить факты» — вы увидите таблицу сравнения. Чем ближе к дате — тем точнее прогноз.
          </div>
          {snaps.length>0&&<div className="mt-2 text-xs text-gray-400">Последний: {new Date(snaps[snaps.length-1].savedAt).toLocaleString('ru')} ({snaps[snaps.length-1].sourceName})</div>}
        </div>
        {accRows.length>0?<div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          <table className="dt"><thead>
            <tr><th>Дата</th><th>Факт Тмакс</th><th>Факт Тмин</th><th>Факт Осадки</th>{Array.from(new Set(snaps.map(s=>s.sourceName))).map(nm=><th key={nm} colSpan={3} className="text-center text-xs">{nm}</th>)}</tr>
            <tr><th></th><th></th><th></th><th></th>{Array.from(new Set(snaps.map(s=>s.sourceName))).flatMap(()=>[<th className="text-xs">Прогн.Т</th>,<th className="text-xs">ΔТ</th>,<th className="text-xs">Пр/Факт</th>])}</tr>
          </thead><tbody>
            {accRows.map(row=>{const srcs=Array.from(new Set(snaps.map(s=>s.sourceName)));
              return<tr key={row.date}>
                <td className="font-medium">{formatDate(row.date)}</td>
                <td>{fmt(row.fact.tempMax,0)}°C</td><td>{fmt(row.fact.tempMin,0)}°C</td>
                <td className={row.fact.precipSum&&row.fact.precipSum>0?'text-blue-600 font-bold':''}>{fmt(row.fact.precipSum)}мм</td>
                {srcs.flatMap(nm=>{const fcs=row.forecasts.filter(f=>f.name===nm).sort((a:any,b:any)=>Math.abs(a.daysBefore)-Math.abs(b.daysBefore));const fc=fcs[0];
                  if(!fc)return[<td key={nm+'t'}>—</td>,<td key={nm+'d'}>—</td>,<td key={nm+'p'}>—</td>];
                  const eT=fc.tempMax!=null&&row.fact.tempMax!=null?fc.tempMax-row.fact.tempMax:null;
                  const eTc=eT!=null?(Math.abs(eT)<=2?'err-pos':Math.abs(eT)<=4?'err-warn':'err-bad'):'';
                  return[<td key={nm+'t'}>{fc.tempMax!=null?fc.tempMax.toFixed(0):'—'}</td>,
                    <td key={nm+'d'} className={eTc}>{eT!=null?(eT>0?'+':'')+eT.toFixed(1):'—'}{fc.daysBefore>0&&<span className="text-gray-300 text-xs ml-0.5">({fc.daysBefore}д)</span>}</td>,
                    <td key={nm+'p'}>{fc.precipSum!=null?fc.precipSum.toFixed(1):'—'}<span className="text-gray-300">/{row.fact.precipSum?.toFixed(1)??'?'}</span></td>];})}
              </tr>;})}
          </tbody></table>
          {(()=>{const rows=accRows;if(!rows.length)return null;let sTE=0,sPC=0,nT=0,nP=0;
            for(const r of rows)for(const f of r.forecasts){if(f.tempMax!=null&&r.fact.tempMax!=null){sTE+=Math.abs(f.tempMax-r.fact.tempMax);nT++;}
              if(f.precipSum!=null&&r.fact.precipSum!=null){sPC+=f.precipSum-r.fact.precipSum;nP++;}}
            return<div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-600 flex flex-wrap gap-4">
              {nT>0&&<span>MAE Т макс: <strong>{(sTE/nT).toFixed(1)}°C</strong></span>}
              {nP>0&&<span>Смещ. осадков: <strong>{(sPC/nP).toFixed(1)}мм</strong> ({sPC>0?'завышение':'занижение'})</span>}
            </div>;})()}
        </div>:<div className="p-6 text-center text-gray-400">{snaps.length===0?'Сохраните прогноз, чтобы начать оценку':'Загрузите фактические данные'}</div>}
      </div>}

      {/* TAB 4: OBSERVATIONS */}
      {tab===4&&<div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-2">
            <button onClick={()=>setOfOn(!ofOn)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">➕ Добавить</button>
            {obs.length>0&&<button onClick={()=>dlCSV(expCSV(obs),'obs_'+todayStr()+'.csv')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">📥 CSV</button>}
          </div><span className="text-xs text-gray-400">{obs.length} зап.</span>
        </div>
        {ofOn&&<div className="bg-white rounded-lg shadow-sm border p-3 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {[{k:'date',l:'Дата',t:'date'},{k:'temp',l:'🌡 Т(°C)',t:'text'},{k:'humidity',l:'💧 Влажн.(%)',t:'text'},{k:'precip',l:'🌧 Осадки(мм)',t:'text'},{k:'wind',l:'💨 Ветер(м/с)',t:'text'},{k:'notes',l:'📝 Прим.',t:'text'}].map(f=>
              <div key={f.k}><label className="text-xs text-gray-500 block mb-0.5">{f.l}</label>
              <input type={f.t} value={(of as any)[f.k]} onChange={e=>setOf(p=>({...p,[f.k]:e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs"/></div>)}
          </div>
          <div className="mt-2 flex gap-2"><button onClick={addO} className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700">Сохранить</button><button onClick={()=>setOfOn(false)} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium">Отмена</button></div>
        </div>}
        {obs.length>0?<div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          <table className="dt"><thead><tr><th>Дата</th><th>🌡Т</th><th>💧Вл.</th><th>🌧Ос</th><th>💨В</th><th>Прим.</th><th></th></tr></thead>
          <tbody>{obs.map(o=><tr key={o.id}><td className="font-medium">{formatDate(o.date)}</td><td>{o.temp||'—'}</td><td>{o.humidity||'—'}</td><td className={parseFloat(o.precip)>0?'text-blue-600 font-medium':''}>{o.precip||'—'}</td><td>{o.wind||'—'}</td><td className="text-xs text-gray-500 max-w-xs truncate">{o.notes||'—'}</td><td><button onClick={()=>delO(o.id)} className="text-red-400 hover:text-red-600">🗑</button></td></tr>)}</tbody></table>
        </div>:<div className="p-6 text-center text-gray-400">Нет наблюдений</div>}
      </div>}

      <footer className="mt-6 py-3 text-center text-xs text-gray-400 border-t">
        <p>АгроПогода — ECMWF IFS, GFS, ICON-EU, ERA5 (Open-Meteo)</p>
        <p>{loc.lat.toFixed(4)}°N, {loc.lon.toFixed(4)}°E</p>
      </footer>
    </main>
  </div>);
}
