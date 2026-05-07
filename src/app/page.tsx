'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  GeoLocation, ForecastRow, FactRow, HourlyForecast, ArchiveDay, UserObservation, AgroRow,
  WEATHER_PARAMS, DEFAULT_PARAMS, AGRO_PARAMS, POPULAR_CITIES,
  FORECAST_SOURCES, FACT_SOURCES,
  getWeatherDesc, getWeatherEmoji, WeatherParam,
} from '@/lib/types';
import {
  searchLocations, fetchAllForecasts, fetchHourly,
  fetchRecentArchive, fetchERA5Archive,
} from '@/lib/api';
import {
  locId, todayStr, daysAgo, formatDate, formatDateFull, formatTime, fmt, getPrecipClass, pbw,
  loadForecastRows, saveForecastRows,
  loadAgroRows, saveAgroRows,

  saveLocation, loadLocation, saveParams, loadParams,
  saveAgroParams, loadAgroParams,
  loadRecentCities, addRecentCity,
  loadObs, addObs, delObs, gid, expCSV, dlCSV,
} from '@/lib/storage';

const DL: GeoLocation = {
  name: 'Белореченск', lat: 44.7844, lon: 40.1169,
  country: 'Россия', admin1: 'Краснодарский край',
  displayName: 'Белореченск, Краснодарский край, Россия',
};

const SOURCES = [
  { id: 'ecmwf', name: 'ECMWF IFS', color: 'text-green-700', bg: 'bg-green-600' },
  { id: 'gfs',   name: 'GFS',       color: 'text-blue-700',  bg: 'bg-blue-600' },
  { id: 'icon',  name: 'ICON-EU',   color: 'text-purple-700', bg: 'bg-purple-600' },
];

function fmtVal(row: ForecastRow, pid: string): string {
  const p = WEATHER_PARAMS.find(x => x.id === pid);
  if (!p) return '—';
  const v = row[p.rowKey] as number | null;
  if (v == null) return '—';
  if (pid === 'uvIndexMax') return v.toFixed(1) + (v >= 8 ? ' (опасно)' : v >= 6 ? ' (выс.)' : v >= 3 ? ' (умер.)' : ' (низ.)');
  if (pid === 'et0') return v.toFixed(1);
  return fmt(v) + ' ' + p.unit;
}

function fmtAgro(row: any, pid: string): string {
  const p = AGRO_PARAMS.find(x => x.id === pid);
  if (!p) return '—';
  const v = row[p.key];
  if (v == null) return '—';
  if (pid === 'frostRisk') return v ? '❄️ Да' : '✅ Нет';
  if (pid === 'growingDegreeDays') return v.toFixed(1);
  return v.toFixed(2) + ' ' + p.unit;
}

export default function Home() {
  /* ====== Location ====== */
  const [loc, setLoc] = useState<GeoLocation>(DL);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sq, setSq] = useState('');
  const [sr, setSr] = useState<GeoLocation[]>([]);
  const sTimer = useRef<NodeJS.Timeout | null>(null);

  /* ====== Data (from server JSON) ====== */
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [agroRows, setAgroRows] = useState<any[]>([]);
  const [observations, setObservations] = useState<UserObservation[]>([]);
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'fetching' | 'done' | 'error'>('idle');
  const [fetchMsg, setFetchMsg] = useState('');
  const [fetchedAt, setFetchedAt] = useState('');
  const [snapshotDate, setSnapshotDate] = useState('');

  /* ====== UI ====== */
  const [tab, setTab] = useState(0);
  const [params, setParams] = useState<string[]>(DEFAULT_PARAMS);
  const [agroParams, setAgroParams] = useState<string[]>(['soilTemp6cm','soilTemp18cm','et0Sum','frostRisk','growingDegreeDays']);
  const [showPS, setShowPS] = useState(false);
  const [selDate, setSelDate] = useState<string | null>(null);
  const [selSource, setSelSource] = useState('ecmwf');
  const [expandDate, setExpandDate] = useState<string | null>(null);
  const [hourlyData, setHourlyData] = useState<HourlyForecast[]>([]);
  const [hourlyLoading, setHourlyLoading] = useState(false);
  const [showHourly, setShowHourly] = useState(false);

  /* Archive */
  const [archData, setArchData] = useState<ArchiveDay[]>([]);
  const [archL, setArchL] = useState(false);
  const [archDays, setArchDays] = useState(14);
  const [archMode, setArchMode] = useState<'r' | 'c'>('r');
  const [archS, setArchS] = useState(daysAgo(30));
  const [archE, setArchE] = useState(daysAgo(0));

  /* Observations form */
  const [obsOpen, setObsOpen] = useState(false);
  const [obsForm, setObsForm] = useState({ temp: '', humidity: '', precip: '', wind: '', notes: '', date: todayStr() });

  /* ====== Data lifecycle: load from server JSON ====== */
  const BASE = '/weather-station';

  const loadFromServer = useCallback(async () => {
    setFetchStatus('fetching');
    setFetchMsg('Загрузка данных...');
    try {
      const r = await fetch(`${BASE}/data/latest.json`);
      if (!r.ok) throw new Error('Файл данных не найден');
      const snap = await r.json();
      if (snap.forecastRows?.length) { setRows(snap.forecastRows); saveForecastRows(snap.forecastRows); }
      if (snap.agroRows?.length) { setAgroRows(snap.agroRows); saveAgroRows(snap.agroRows); }
      setFetchedAt(snap.fetchedAt || '');
      setSnapshotDate(snap.snapshotDate || '');
      setFetchStatus('done');
      const time = snap.fetchedAt ? formatTime(snap.fetchedAt) : '';
      setFetchMsg(`Обновлено ${snap.snapshotDate}${time ? ' в ' + time : ''} · ${snap.sourceCount || '?'} источн. · ${snap.dayCount || '?'} дн.`);
    } catch (e: any) {
      const cached = loadForecastRows();
      if (cached.length > 0) {
        setRows(cached); setAgroRows(loadAgroRows());
        setFetchStatus('done'); setFetchMsg('Оффлайн: показаны кэшированные данные.');
      } else {
        setFetchStatus('error'); setFetchMsg('Нет данных. Первый запуск — данные появятся после автоматического обновления (06:00 / 18:00 MSK).');
      }
    }
  }, []);

  const doManualFetch = useCallback(async () => {
    setFetchStatus('fetching'); setFetchMsg('Загрузка свежего прогноза...');
    try {
      const { forecastRows, agroRows: newAgro } = await fetchAllForecasts(loc);
      if (forecastRows.length === 0) throw new Error('Нет данных от серверов');
      setRows(forecastRows); saveForecastRows(forecastRows);
      if (newAgro.length > 0) { setAgroRows(newAgro); saveAgroRows(newAgro); }
      addRecentCity(loc); setSnapshotDate(todayStr()); setFetchedAt(new Date().toISOString());
      setFetchStatus('done'); setFetchMsg(`Ручное обновление: ${forecastRows.length} записей · ${todayStr()}`);
    } catch (e: any) { setFetchStatus('error'); setFetchMsg(e.message || 'Ошибка загрузки'); }
  }, [loc]);

  /* Init */
  useEffect(() => {
    const sl = loadLocation(); if (sl) setLoc(sl);
    const sp = loadParams(); if (sp) setParams(sp);
    const sap2 = loadAgroParams(); if (sap2) setAgroParams(sap2);
    setObservations(loadObs());
    loadFromServer();
  }, [loadFromServer]);

  /* ====== Computed: latest forecast per date per source ====== */
  const locRows = useMemo(() => {
    const lid = locId(loc);
    return rows.filter(r => r.locationId === lid);
  }, [rows, loc]);

  const latestByDate = useMemo(() => {
    const m: Record<string, Record<string, ForecastRow>> = {};
    for (const row of locRows) {
      if (!m[row.targetDate]) m[row.targetDate] = {};
      const existing = m[row.targetDate][row.sourceId];
      if (!existing || row.daysBefore <= existing.daysBefore) {
        m[row.targetDate][row.sourceId] = row;
      }
    }
    return m;
  }, [locRows]);

  const sortedDates = useMemo(() => Object.keys(latestByDate).sort(), [latestByDate]);

  const locAgro = useMemo(() => agroRows.filter((r: any) => r.locationId === locId(loc)), [agroRows, loc]);
  const agroByDate = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const r of locAgro) {
      if (!m[r.targetDate]) m[r.targetDate] = [];
      const existing = m[r.targetDate].find((x: any) => x.sourceId === r.sourceId);
      if (!existing || r.daysBefore <= existing.daysBefore) {
        m[r.targetDate] = m[r.targetDate].filter((x: any) => x.sourceId !== r.sourceId);
        m[r.targetDate].push(r);
      }
    }
    return m;
  }, [locAgro]);
  const agroSortedDates = useMemo(() => Object.keys(agroByDate).sort(), [agroByDate]);

  /* ====== Accuracy ====== */
  const [archFacts, setArchFacts] = useState<any[]>([]);
  const accuracyRows = useMemo(() => {
    if (!archFacts.length || !locRows.length) return [];
    const out: { date: string; fact: any; predictions: { sourceId: string; sourceName: string; daysBefore: number; tempMax: number|null; precipSum: number|null }[] }[] = [];
    for (const fact of archFacts) {
      if (fact.date > todayStr()) continue;
      const preds = locRows.filter(r => r.targetDate === fact.date)
        .map(r => ({ sourceId: r.sourceId, sourceName: r.sourceName, daysBefore: r.daysBefore, tempMax: r.tempMax, precipSum: r.precipSum }))
        .sort((a, b) => a.daysBefore - b.daysBefore);
      if (preds.length) out.push({ date: fact.date, fact, predictions: preds });
    }
    return out;
  }, [locRows, archFacts]);

  /* ====== Handlers ====== */
  const hSearch = (q: string) => {
    setSq(q);
    if (sTimer.current) clearTimeout(sTimer.current);
    if (q.length < 2) { setSr([]); return; }
    sTimer.current = setTimeout(async () => { try { setSr(await searchLocations(q)); } catch { setSr([]); } }, 350);
  };
  const selectCity = (c: GeoLocation) => {
    setLoc(c); saveLocation(c); setSearchOpen(false); setSq(''); setSr([]);
    setExpandDate(null); setShowHourly(false);
  };
  const togParam = (pid: string) => setParams(p => { const n = p.includes(pid) ? p.filter(x => x !== pid) : [...p, pid]; saveParams(n); return n; });
  const togAgroParam = (pid: string) => setAgroParams(p => { const n = p.includes(pid) ? p.filter(x => x !== pid) : [...p, pid]; saveAgroParams(n); return n; });
  const clickDate = async (date: string) => {
    setSelDate(date === selDate ? null : date);
    if (date !== selDate) { setShowHourly(true); setHourlyLoading(true); setHourlyData([]); }
  };
  useEffect(() => {
    if (!showHourly || !selDate) return;
    setHourlyLoading(true);
    fetchHourly(loc.lat, loc.lon, selDate).then(d => { setHourlyData(d); setHourlyLoading(false); });
  }, [selDate, showHourly]);

  /* Archive */
  const loadArch = async () => {
    setArchL(true); setArchData([]);
    let d: ArchiveDay[] = [];
    if (archMode === 'r') { d = await fetchRecentArchive(loc.lat, loc.lon, archDays); }
    else {
      const diff = Math.floor((Date.now() - new Date(archS + 'T00:00:00').getTime()) / 864e5);
      d = diff <= 92 ? await fetchRecentArchive(loc.lat, loc.lon, diff) : await fetchERA5Archive(loc.lat, loc.lon, archS, archE);
    }
    setArchData(d); setArchL(false);
  };

  /* Load facts for accuracy */
  const loadFactsNow = async () => {
    setFetchMsg('Загрузка фактических данных...');
    const d = await fetchRecentArchive(loc.lat, loc.lon, 30);
    if (d.length) { setArchFacts(d); setFetchMsg(`Загружено ${d.length} дней фактов`); }
    else { setFetchMsg('Не удалось загрузить факты'); }
  };

  /* Observations */
  const addObsNow = () => {
    if (!obsForm.date) return;
    addObs({ id: gid(), date: obsForm.date, temp: obsForm.temp, humidity: obsForm.humidity, precip: obsForm.precip, wind: obsForm.wind, notes: obsForm.notes, createdAt: new Date().toISOString() });
    setObservations(loadObs());
    setObsForm({ temp: '', humidity: '', precip: '', wind: '', notes: '', date: todayStr() });
    setObsOpen(false);
  };

  /* ====== City search panel ====== */
  const recentCities = useMemo(() => loadRecentCities(), [searchOpen]);
  const showSuggestions = searchOpen && (sq.length < 2 ? (recentCities.length > 0 || POPULAR_CITIES.length > 0) : sr.length > 0);

  /* ====== Tabs ====== */
  const TABS = ['Прогноз', 'Сравнение', 'Сад/Огород', 'Точность', 'Архив', 'Источники', 'Наблюдения'];
  const TIC = ['🌡', '📊', '🌱', '🎯', '📅', '📡', '📝'];

  const locRowCount = useMemo(() => rows.filter(r => r.locationId === locId(loc)).length, [rows, loc]);
  const locAgroCount = useMemo(() => agroRows.filter((r: any) => r.locationId === locId(loc)).length, [agroRows, loc]);

  /* ====== RENDER ====== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      {/* === HEADER === */}
      <header className="bg-white shadow-sm border-b border-green-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl">🌾</span>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-green-800 leading-tight">АгроПогода</h1>
                <button onClick={() => setSearchOpen(!searchOpen)} className="text-xs text-green-600 hover:text-green-800 truncate block">
                  📍 {loc.name}{loc.admin1 ? <span className="text-gray-400">, {loc.admin1}</span> : null} <span className="text-gray-300">✏️</span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400">Данные:</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {locRowCount} зап.
                {locAgroCount > 0 && <span className="ml-1 text-emerald-600">🌱 {locAgroCount}</span>}
                {snapshotDate && <span className="text-green-600 ml-1">→ {snapshotDate}</span>}
              </span>
              <button onClick={doManualFetch} disabled={fetchStatus === 'fetching'}
                className="px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50" title="Загрузить свежий прогноз напрямую">
                {fetchStatus === 'fetching' ? '⏳ ...' : '🔄 Обновить'}
              </button>
            </div>
          </div>

          {/* Status message */}
          {fetchMsg && <div className={'mt-1 text-xs px-2 py-1 rounded ' + (fetchStatus === 'error' ? 'bg-red-50 text-red-600' : fetchStatus === 'done' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-600')}>
            {fetchMsg}
          </div>}

          {/* City search */}
          {searchOpen && (
            <div className="mt-2 relative">
              <input type="text" value={sq} onChange={e => hSearch(e.target.value)} placeholder="Начните вводить город..."
                className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:outline-none focus:border-green-500 text-sm" autoFocus />
              {showSuggestions && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-auto">
                  {sq.length < 2 ? (
                    <>
                      {recentCities.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 text-xs text-gray-400 font-medium bg-gray-50 sticky top-0">Недавние</div>
                          {recentCities.map((c, i) => (
                            <button key={'r' + i} onClick={() => selectCity(c)} className="w-full px-3 py-2 text-left hover:bg-green-50 border-b last:border-0">
                              <div className="font-medium text-gray-800 text-sm">{c.name}</div>
                              <div className="text-xs text-gray-500 truncate">{c.displayName}</div>
                            </button>
                          ))}
                        </div>
                      )}
                      <div>
                        <div className="px-3 py-1.5 text-xs text-gray-400 font-medium bg-gray-50 sticky top-0">Популярные города</div>
                        {POPULAR_CITIES.slice(0, sq.length < 2 && recentCities.length > 0 ? 5 : 10).map((c, i) => (
                          <button key={'p' + i} onClick={() => selectCity(c)} className="w-full px-3 py-2 text-left hover:bg-green-50 border-b last:border-0">
                            <div className="font-medium text-gray-800 text-sm">{c.name}</div>
                            <div className="text-xs text-gray-500 truncate">{c.displayName}</div>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    sr.map((r, i) => (
                      <button key={i} onClick={() => selectCity(r)} className="w-full px-3 py-2 text-left hover:bg-green-50 border-b last:border-0">
                        <div className="font-medium text-gray-800 text-sm">{r.name}</div>
                        <div className="text-xs text-gray-500 truncate">{r.displayName}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
              <button onClick={() => { setSearchOpen(false); setSq(''); setSr([]); }} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">✕</button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex mt-2 border-t border-green-100 pt-1 -mx-3 px-3 overflow-x-auto">
            {TABS.map((t, i) => (
              <button key={i} onClick={() => { setTab(i); setSelDate(null); setShowHourly(false); setExpandDate(null); }}
                className={'tb ' + (tab === i ? 'on' : '')}>{TIC[i]} {t}</button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 py-3">
        {/* === PARAM BAR === */}
        <div className="mb-3 flex items-center gap-1 flex-wrap">
          <button onClick={() => setShowPS(!showPS)} className="text-xs text-green-700 hover:text-green-900 font-medium">⚙️ Парам. ({params.length})</button>
          {params.map(pid => {
            const p = WEATHER_PARAMS.find(x => x.id === pid);
            return p ? (
              <span key={pid} className="pb on">{p.icon}{p.label}<span onClick={() => togParam(pid)} className="ml-0.5 cursor-pointer text-green-400 hover:text-red-500">✕</span></span>
            ) : null;
          })}
        </div>
        {showPS && (
          <div className="mb-3 p-3 bg-white rounded-lg border shadow-sm">
            <div className="text-xs text-gray-500 mb-2">Выберите параметры для отображения (изменяется только визуал, данные сохранены полностью):</div>
            <div className="flex flex-wrap gap-1">
              {WEATHER_PARAMS.map(p => (
                <button key={p.id} onClick={() => togParam(p.id)} className={'pb ' + (params.includes(p.id) ? 'on' : '')}>
                  {p.icon}{p.label}<span className="text-xs opacity-50">{p.unit}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ====== TAB 0: FORECAST ====== */}
        {tab === 0 && (
          <div>
            {/* Source selector */}
            <div className="flex gap-1 mb-3 flex-wrap">
              {SOURCES.map(s => (
                <button key={s.id} onClick={() => { setSelSource(s.id); setExpandDate(null); }}
                  className={'px-2 py-1.5 rounded-lg text-xs font-medium transition ' + (selSource === s.id ? s.bg + ' text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-50 border')}>
                  {s.name}
                </button>
              ))}
              <button onClick={() => setExpandDate(expandDate ? null : (sortedDates[0] || null))}
                className="px-2 py-1.5 rounded-lg text-xs font-medium transition bg-gray-100 text-gray-600 hover:bg-gray-200 border border-dashed">
                {expandDate ? '🔀 Свернуть' : '📋 История прогнозов'}
              </button>
            </div>

            {sortedDates.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                {fetchStatus === 'fetching' ? <div className="flex items-center justify-center gap-2"><div className="sp" />Загрузка...</div> : 'Нет данных. Нажмите "Загрузить" для получения прогноза.'}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
                <table className="dt">
                  <thead>
                    <tr>
                      <th>Дата</th><th>Погода</th><th>Д-до</th>
                      {params.map(pid => { const p = WEATHER_PARAMS.find(x => x.id === pid); return p ? <th key={pid}>{p.icon}{p.label}</th> : null; })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDates.map(date => {
                      const row = latestByDate[date]?.[selSource];
                      if (!row) return null;
                      const isExpanded = expandDate === date;
                      return (
                        <tbody key={date}>
                          <tr onClick={() => setExpandDate(isExpanded ? null : date)} className={isExpanded ? 'cur' : 'cursor-pointer hover:bg-gray-50'}>
                            <td className="font-medium">{formatDate(date)}{date === todayStr() && <span className="ml-1 text-xs bg-green-100 text-green-700 px-1 rounded">сег.</span>}</td>
                            <td><span className="mr-0.5">{getWeatherEmoji(row.weatherCode)}</span><span className="text-xs text-gray-500">{getWeatherDesc(row.weatherCode)}</span></td>
                            <td className="text-xs text-gray-400">{row.daysBefore >= 0 ? row.daysBefore + 'д' : '—'}</td>
                            {params.map(pid => {
                              if (pid === 'precipSum') {
                                return (<td key={pid}><div className="flex items-center gap-1"><span className={row.precipSum && row.precipSum > 0 ? 'text-blue-600 font-medium' : ''}>{fmt(row.precipSum)}</span><div className="pb-bar"><div className={'pb-fill ' + getPrecipClass(row.precipSum)} style={{ width: pbw(row.precipSum) + '%' }} /></div></div></td>);
                              }
                              return <td key={pid}>{fmtVal(row, pid)}</td>;
                            })}
                          </tr>
                          {/* Expanded: history of predictions for this date */}
                          {isExpanded && (() => {
                            const history = locRows.filter(r => r.targetDate === date).sort((a, b) => a.daysBefore - b.daysBefore);
                            if (history.length <= 1) return <tr><td colSpan={3 + params.length} className="text-center text-xs text-gray-400 py-2">Только одно наблюдение за эту дату</td></tr>;
                            return (
                              <tr>
                                <td colSpan={3 + params.length} className="p-0">
                                  <div className="bg-blue-50/50 border-t border-blue-200">
                                    <div className="px-3 py-1.5 text-xs text-blue-700 font-medium">История прогнозов на {formatDateFull(date)} ({SOURCES.find(s => s.id === selSource)?.name})</div>
                                    <table className="dt">
                                      <thead><tr><th>Когда сохранено</th><th>Дней до даты</th>{params.map(pid => { const p = WEATHER_PARAMS.find(x => x.id === pid); return p ? <th key={pid}>{p.label}</th> : null; })}</tr></thead>
                                      <tbody>
                                        {history.filter(r => r.sourceId === selSource).map(r => (
                                          <tr key={r.id} className={r.snapshotDate === todayStr() ? 'bg-green-50' : ''}>
                                            <td className="text-xs">{formatDate(r.snapshotDate)}{r.snapshotDate === todayStr() && <span className="ml-1 text-green-600">→ сегодня</span>}</td>
                                            <td className="text-xs text-center">{r.daysBefore >= 0 ? r.daysBefore + 'д' : (Math.abs(r.daysBefore) + 'д после')}</td>
                                            {params.map(pid => {
                                              if (pid === 'precipSum') return <td key={pid}><span className={r.precipSum && r.precipSum > 0 ? 'text-blue-600 font-medium' : ''}>{fmt(r.precipSum)}</span></td>;
                                              return <td key={pid}>{fmtVal(r, pid)}</td>;
                                            })}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            );
                          })()}
                        </tbody>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-500">
                  Показаны последние прогнозы · {sortedDates.length} дней · {SOURCES.find(s => s.id === selSource)?.name}
                </div>
              </div>
            )}

            {/* Hourly */}
            {showHourly && selDate && (
              <div className="mt-3 bg-white rounded-lg shadow-sm border overflow-x-auto">
                <div className="px-3 py-2 bg-blue-50 rounded-t-lg border-b flex items-center justify-between">
                  <h3 className="font-semibold text-blue-800 text-sm">📋 Почасовой отчёт: {formatDateFull(selDate)}</h3>
                  <button onClick={() => setShowHourly(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                {hourlyLoading ? <div className="p-4 text-center"><div className="sp" /> Загрузка...</div> : hourlyData.length === 0 ? <div className="p-4 text-center text-gray-400">Нет почасовых данных</div> : (
                  <table className="dt">
                    <thead><tr><th>Время</th><th>🌡 Т</th><th>🌧 Осадки</th><th>💨 Ветер</th><th>💧 Влажн.</th><th>📊 Давл.</th><th>Погода</th></tr></thead>
                    <tbody>{hourlyData.filter(h => h.time.startsWith(selDate)).map((h, i) => (
                      <tr key={i}>
                        <td className="font-medium">{h.time.split('T')[1]?.substring(0, 5)}</td>
                        <td className={h.temp != null && h.temp > 30 ? 'text-red-600 font-medium' : h.temp != null && h.temp < 0 ? 'text-blue-600 font-medium' : ''}>{fmt(h.temp, 0)}°C</td>
                        <td className={h.precip && h.precip > 0 ? 'text-blue-600 font-medium' : ''}>{fmt(h.precip)}мм</td>
                        <td>{fmt(h.windSpeed, 0)}км/ч</td>
                        <td>{fmt(h.humidity, 0)}%</td>
                        <td>{h.pressure ? (h.pressure / 100 * 0.75006).toFixed(1) : '—'}мм</td>
                        <td><span className="mr-0.5">{getWeatherEmoji(h.weatherCode)}</span><span className="text-xs text-gray-500">{getWeatherDesc(h.weatherCode)}</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {/* ====== TAB 1: COMPARE ====== */}
        {tab === 1 && (
          <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
            {sortedDates.length === 0 ? (
              <div className="p-6 text-center text-gray-400">Нет данных</div>
            ) : (
              <table className="dt">
                <thead>
                  <tr><th>Дата</th>{SOURCES.filter(s => latestByDate[sortedDates[0]]?.[s.id]).map(s => (
                    <th key={s.id} colSpan={params.length} className="text-center"><span className={s.color}>{s.name}</span></th>
                  ))}</tr>
                  <tr><th></th>{SOURCES.filter(s => latestByDate[sortedDates[0]]?.[s.id]).flatMap(s =>
                    params.map(pid => { const p = WEATHER_PARAMS.find(x => x.id === pid); return <th key={s.id + '-' + pid} className="text-xs">{p?.label}</th>; })
                  )}</tr>
                </thead>
                <tbody>
                  {sortedDates.map(date => (
                    <tr key={date} onClick={() => clickDate(date)} className={'cursor-pointer ' + (selDate === date ? 'cur' : '')}>
                      <td className="font-medium">{formatDate(date)}</td>
                      {SOURCES.filter(s => latestByDate[sortedDates[0]]?.[s.id]).map(s => {
                        const row = latestByDate[date]?.[s.id];
                        if (!row) return params.map(pid => <td key={s.id + '-' + pid}>—</td>);
                        return params.map(pid => {
                          if (pid === 'precipSum') return <td key={s.id + '-' + pid}><span className={row.precipSum && row.precipSum > 0 ? 'text-blue-600 font-medium' : ''}>{fmt(row.precipSum)}</span></td>;
                          return <td key={s.id + '-' + pid}>{fmtVal(row, pid)}</td>;
                        });
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ====== TAB 2: GARDEN/AGRO ====== */}
        {tab === 2 && (
          <div>
            <div className="bg-white rounded-lg shadow-sm border p-3 mb-3">
              <div className="text-xs text-gray-500 leading-relaxed">
                <strong>Агрометеоданные</strong> для выращивания. Т почвы определяет всхожесть (5-15°C).
                ЭТ₀ — испаряемость для оросительных норм. GDD — сумма эффективных температур.
              </div>
            </div>
            {agroSortedDates.length === 0 ? (
              <div className="p-6 text-center text-gray-400">Нет агроданных. Нажмите «Загрузить».</div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
                <table className="dt"><thead>
                  <tr><th>Дата</th><th>Источник</th><th>Д-до</th>{agroParams.map(pid => { const p = AGRO_PARAMS.find(x => x.id === pid); return p ? <th key={pid}>{p.icon}{p.label}</th> : null; })}</tr>
                </thead><tbody>
                  {agroSortedDates.flatMap((date: string) => agroByDate[date].map((row: any, i: number) => (
                    <tr key={date + '-' + i}>
                      {i === 0 && <td rowSpan={agroByDate[date].length} className="font-medium">{formatDate(date)}{date === todayStr() && <span className="ml-1 text-xs bg-green-100 text-green-700 px-1 rounded">сег.</span>}</td>}
                      <td className="text-xs">{row.sourceName}</td>
                      <td className="text-xs text-gray-400">{row.daysBefore >= 0 ? row.daysBefore + 'д' : '—'}</td>
                      {agroParams.map(pid => (
                        <td key={pid} className={pid === 'frostRisk' && row.frostRisk ? 'bg-blue-50' : pid === 'soilTemp6cm' && row.soilTemp6cm != null && row.soilTemp6cm < 5 ? 'bg-yellow-50' : ''}>
                          {fmtAgro(row, pid)}
                        </td>
                      ))}
                    </tr>
                  )))}
                </tbody></table>
              </div>
            )}
          </div>
        )}

        {/* ====== TAB 3: ACCURACY ====== */}
        {tab === 3 && (
          <div>
            <div className="bg-white rounded-lg shadow-sm border p-3 mb-3">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <button onClick={loadFactsNow} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">📊 Загрузить факты (60 дн.)</button>
                {archFacts.length > 0 && <button onClick={() => setArchFacts([])} className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200">🗑 Очистить</button>}
                <span className="text-xs text-gray-400">Фактов: {archFacts.length} | Прогнозов: {locRows.length}</span>
              </div>
              <div className="text-xs text-gray-500 leading-relaxed">
                <strong>Как это работает:</strong> Каждый день при открытии приложения прогнозы автоматически сохраняются. Для каждой даты накапливается до 10 прогнозов (с 10-дневного до 0-дневного срока). Загрузив фактические данные, вы увидите как менялась точность прогноза по мере приближения к дате.
              </div>
            </div>

            {accuracyRows.length > 0 ? (
              <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
                <table className="dt">
                  <thead>
                    <tr><th>Дата</th><th>Факт Тмакс</th><th>Факт Осадки</th><th>Источник</th><th>Дней до</th><th>Прогн.Т</th><th>ΔТ</th><th>Пр/Факт</th></tr>
                  </thead>
                  <tbody>
                    {accuracyRows.map(row => (
                      row.predictions.map((pred, i) => (
                        <tr key={row.date + '-' + i}>
                          {i === 0 && <td rowSpan={row.predictions.length} className="font-medium">{formatDate(row.date)}</td>}
                          {i === 0 && <td rowSpan={row.predictions.length}>{fmt(row.fact.tempMax, 0)}°C</td>}
                          {i === 0 && <td rowSpan={row.predictions.length} className={row.fact.precipSum && row.fact.precipSum > 0 ? 'text-blue-600 font-bold' : ''}>{fmt(row.fact.precipSum)}мм</td>}
                          <td className="text-xs">{pred.sourceName}</td>
                          <td className="text-xs text-center">{pred.daysBefore >= 0 ? pred.daysBefore + 'д' : '—'}</td>
                          <td>{pred.tempMax != null ? pred.tempMax.toFixed(1) : '—'}</td>
                          <td className={(() => {
                            if (pred.tempMax == null || row.fact.tempMax == null) return '';
                            const e = Math.abs(pred.tempMax - row.fact.tempMax);
                            return e <= 2 ? 'err-pos' : e <= 4 ? 'err-warn' : 'err-bad';
                          })()}>
                            {pred.tempMax != null && row.fact.tempMax != null ? ((pred.tempMax > row.fact.tempMax ? '+' : '') + (pred.tempMax - row.fact.tempMax).toFixed(1)) : '—'}
                          </td>
                          <td>
                            <span className="text-gray-500">{pred.precipSum != null ? pred.precipSum.toFixed(1) : '—'}</span>
                            <span className="text-gray-300">/</span>
                            <span className="font-medium">{row.fact.precipSum?.toFixed(1) ?? '?'}</span>
                          </td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
                {/* Summary */}
                {(() => {
                  let sTE = 0, nT = 0, sPE = 0, nP = 0;
                  const buckets: Record<string, { sTE: number; nT: number }> = {};
                  for (const row of accuracyRows) {
                    for (const pred of row.predictions) {
                      const bk = Math.min(10, Math.max(0, pred.daysBefore)) + 'д';
                      if (!buckets[bk]) buckets[bk] = { sTE: 0, nT: 0 };
                      if (pred.tempMax != null && row.fact.tempMax != null) {
                        const e = Math.abs(pred.tempMax - row.fact.tempMax);
                        sTE += e; nT++;
                        buckets[bk].sTE += e; buckets[bk].nT++;
                      }
                      if (pred.precipSum != null && row.fact.precipSum != null) { sPE += pred.precipSum - row.fact.precipSum; nP++; }
                    }
                  }
                  if (nT === 0) return null;
                  return (
                    <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-600">
                      <span>MAE Т макс: <strong>{(sTE / nT).toFixed(1)}°C</strong></span>
                      {nP > 0 && <span className="ml-3">Смещ. осадков: <strong>{(sPE / nP).toFixed(1)}мм</strong> ({sPE > 0 ? 'завышение' : 'занижение'})</span>}
                      <div className="mt-1 flex flex-wrap gap-2">
                        {Object.entries(buckets).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => (
                          <span key={k} className="px-1.5 py-0.5 bg-white rounded border">{k}: {v.nT > 0 ? (v.sTE / v.nT).toFixed(1) + '°C' : '—'}</span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-400">{locRows.length === 0 ? 'Сначала загрузите прогноз' : 'Нажмите "Загрузить факты" для анализа точности'}</div>
            )}
          </div>
        )}

        {/* ====== TAB 4: ARCHIVE ====== */}
        {tab === 4 && (
          <div>
            <div className="bg-white rounded-lg shadow-sm border p-3 mb-3">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <div className="flex gap-1">
                  <button onClick={() => setArchMode('r')} className={'px-2 py-1 rounded text-xs font-medium ' + (archMode === 'r' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600')}>Последние</button>
                  <button onClick={() => setArchMode('c')} className={'px-2 py-1 rounded text-xs font-medium ' + (archMode === 'c' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600')}>Произвольный</button>
                </div>
                {archMode === 'r' ? (
                  <div className="flex items-center gap-1"><span className="text-xs text-gray-500">Дней:</span>
                    {[7, 14, 30, 60, 90].map(d => <button key={d} onClick={() => setArchDays(d)} className={'px-2 py-0.5 rounded text-xs ' + (archDays === d ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-500 hover:bg-gray-100')}>{d}</button>)}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-gray-500">С:</span><input type="date" value={archS} onChange={e => setArchS(e.target.value)} className="px-2 py-1 border rounded text-xs" />
                    <span className="text-xs text-gray-500">По:</span><input type="date" value={archE} onChange={e => setArchE(e.target.value)} className="px-2 py-1 border rounded text-xs" />
                  </div>
                )}
                <button onClick={loadArch} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">{archL ? '...' : 'Загрузить'}</button>
              </div>
              <div className="text-xs text-gray-400">ECMWF IFS анализ (~9 км) — ближе к реальным данным станций, чем ERA5. Для Белореченска максимально точные данные — станция в родниках (WMO 37013).</div>
            </div>
            {archL ? <div className="p-6 text-center"><div className="sp" /> Загрузка...</div> : archData.length > 0 ? (
              <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
                <table className="dt">
                  <thead><tr><th>Дата</th><th>Т макс</th><th>Т мин</th><th>Осадки</th><th>Осадки</th><th>Ветер</th><th>Источник</th></tr></thead>
                  <tbody>{[...archData].reverse().map(d => (
                    <tr key={d.date}>
                      <td className="font-medium">{formatDate(d.date)}</td>
                      <td className={d.tempMax != null && d.tempMax > 35 ? 'text-red-600 font-medium' : ''}>{fmt(d.tempMax)}°C</td>
                      <td>{fmt(d.tempMin)}°C</td>
                      <td className={d.precipSum != null && d.precipSum > 0 ? 'text-blue-600 font-bold' : ''}>{fmt(d.precipSum)}мм</td>
                      <td><div className="pb-bar"><div className={'pb-fill ' + getPrecipClass(d.precipSum)} style={{ width: pbw(d.precipSum) + '%' }} /></div></td>
                      <td>{fmt(d.windMax, 0)}км/ч</td>
                      <td><span className={'text-xs px-1.5 py-0.5 rounded-full ' + (d.source === 'ecmwf_ifs' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>{d.source === 'ecmwf_ifs' ? 'ECMWF IFS' : 'ERA5'}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
                <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-600 flex flex-wrap gap-3">
                  <span>{formatDate(archData[0]?.date)} — {formatDate(archData[archData.length - 1]?.date)}</span>
                  <span>{archData.length} дн.</span>
                  {(() => { const pp = archData.map(d => d.precipSum).filter((v): v is number => v != null); if (!pp.length) return null; const t = pp.reduce((a, b) => a + b, 0);
                    return <><span>Σ: {t.toFixed(1)}мм</span><span>Макс: {Math.max(...pp).toFixed(1)}мм</span><span>Ср/дн: {(t / pp.length).toFixed(1)}мм</span></>;
                  })()}
                </div>
              </div>
            ) : <div className="p-6 text-center text-gray-400">Нажмите «Загрузить»</div>}
          </div>
        )}

        {/* ====== TAB 5: SOURCES ====== */}
        {tab === 5 && (
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-white rounded-lg shadow-sm border p-3">
                <h2 className="font-bold text-green-800 mb-2">Источники прогноза</h2>
                <div className="space-y-2">
                  {FORECAST_SOURCES.map(s => (
                    <div key={s.id} className="p-2 rounded-lg border hover:bg-gray-50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={'px-1.5 py-0.5 rounded text-white text-xs font-medium ' + s.bg}>{s.type === 'model' ? 'Модель' : 'Сервис'}</span>
                        <span className="font-medium text-gray-800 text-sm">{s.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-gray-600">
                        <div>Разрешение: <strong>{s.resolution}</strong></div>
                        <div>Макс. дней: <strong>{s.maxDays}</strong></div>
                        <div>Агро: {s.hasAgro ? '✅' : '—'}</div>
                        <div>Покрытие: {s.coverage}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{s.note}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border p-3">
                <h2 className="font-bold text-blue-800 mb-2">Источники фактических данных</h2>
                <div className="space-y-2">
                  {FACT_SOURCES.map(s => (
                    <div key={s.id} className="p-2 rounded-lg border hover:bg-gray-50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={'px-1.5 py-0.5 rounded text-white text-xs font-medium ' + (s.type === 'station' ? 'bg-emerald-600' : s.type === 'reanalysis' ? 'bg-blue-600' : 'bg-indigo-600')}>
                          {s.type === 'station' ? 'Станция' : s.type === 'reanalysis' ? 'Реанализ' : 'Анализ'}
                        </span>
                        <span className="font-medium text-gray-800 text-sm">{s.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-gray-600">
                        <div>Архив с: <strong>{s.archiveStart}</strong></div>
                        <div>Осадки: {s.precipAccuracy === 'excellent' ? '✅ Отлично' : s.precipAccuracy === 'good' ? '⚠️ Хорошо' : '❌ Смещены'}</div>
                        <div>РФ: {s.russiaCoverage}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{s.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====== TAB 6: OBSERVATIONS ====== */}
        {tab === 6 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-2">
                <button onClick={() => setObsOpen(!obsOpen)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">➕ Добавить</button>
                {observations.length > 0 && <button onClick={() => dlCSV(expCSV(observations), 'obs_' + todayStr() + '.csv')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">📥 CSV</button>}
              </div>
              <span className="text-xs text-gray-400">{observations.length} зап.</span>
            </div>
            {obsOpen && (
              <div className="bg-white rounded-lg shadow-sm border p-3 mb-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {[{ k: 'date', l: 'Дата', t: 'date' }, { k: 'temp', l: '🌡 Т(°C)', t: 'text' }, { k: 'humidity', l: '💧 Влажн.(%)', t: 'text' }, { k: 'precip', l: '🌧 Осадки(мм)', t: 'text' }, { k: 'wind', l: '💨 Ветер(м/с)', t: 'text' }, { k: 'notes', l: '📝 Прим.', t: 'text' }].map(f => (
                    <div key={f.k}><label className="text-xs text-gray-500 block mb-0.5">{f.l}</label>
                      <input type={f.t} value={(obsForm as any)[f.k]} onChange={e => setObsForm(p => ({ ...p, [f.k]: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={addObsNow} className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700">Сохранить</button>
                  <button onClick={() => setObsOpen(false)} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium">Отмена</button>
                </div>
              </div>
            )}
            {observations.length > 0 ? (
              <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
                <table className="dt">
                  <thead><tr><th>Дата</th><th>🌡Т</th><th>💧Вл.</th><th>🌧Ос</th><th>💨В</th><th>Прим.</th><th></th></tr></thead>
                  <tbody>{observations.map(o => (
                    <tr key={o.id}><td className="font-medium">{formatDate(o.date)}</td><td>{o.temp || '—'}</td><td>{o.humidity || '—'}</td><td className={parseFloat(o.precip) > 0 ? 'text-blue-600 font-medium' : ''}>{o.precip || '—'}</td><td>{o.wind || '—'}</td><td className="text-xs text-gray-500 max-w-xs truncate">{o.notes || '—'}</td><td><button onClick={() => { delObs(o.id); setObservations(loadObs()); }} className="text-red-400 hover:text-red-600">🗑</button></td></tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <div className="p-6 text-center text-gray-400">Нет наблюдений</div>}
          </div>
        )}

        <footer className="mt-6 py-3 text-center text-xs text-gray-400 border-t">
          <p>АгроПогода — Data-First архитектура: ECMWF IFS, GFS, ICON-EU (Open-Meteo)</p>
          <p>Прогнозы сохраняются ежедневно, данные неизменяемы · {loc.lat.toFixed(4)}°N, {loc.lon.toFixed(4)}°E</p>
        </footer>
      </main>
    </div>
  );
}
