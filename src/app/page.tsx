'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog,
  Thermometer, Droplets, Wind, Gauge, Eye, Calendar,
  RefreshCw, MapPin, Clock, ChevronRight, ChevronDown, Sprout,
  TrendingUp, AlertTriangle, Leaf, TreePine,
} from 'lucide-react';

/* ====== Types ====== */
interface ForecastRow {
  id: string; targetDate: string; sourceId: string; sourceName: string;
  snapshotDate: string; daysBefore: number; locationId: string;
  tempMax: number|null; tempMin: number|null; precipSum: number|null; precipProb: number|null;
  windMax: number|null; windGusts: number|null; humidityMax: number|null; humidityMin: number|null;
  pressureMax: number|null; pressureMin: number|null; uvIndexMax: number|null;
  weatherCode: number|null; et0: number|null;
}

interface AgroRow {
  id: string; targetDate: string; sourceId: string; sourceName: string;
  snapshotDate: string; daysBefore: number; locationId: string;
  soilTemp6cm: number|null; soilTemp18cm: number|null; soilTemp54cm: number|null;
  soilMoisture07: number|null; soilMoisture28100: number|null;
  et0Sum: number|null; dewPointMax: number|null; vaporPressureDefMax: number|null;
  solarRadiationSum: number|null; growingDegreeDays: number|null; frostRisk: boolean|null;
}

interface Snapshot {
  id: string; location: { name: string; lat: number; lon: number; locationId: string };
  snapshotDate: string; fetchedAt: string;
  forecastRows: ForecastRow[]; agroRows: AgroRow[];
  sourceCount: number; dayCount: number; errors: string[];
}

/* ====== Constants ====== */
const BASE = '/weather-station';

const SOURCES = [
  { id: 'ecmwf', name: 'ECMWF IFS', color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' },
  { id: 'gfs',   name: 'GFS',       color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe' },
  { id: 'icon',  name: 'ICON-EU',   color: '#9333ea', bg: '#f3e8ff', border: '#e9d5ff' },
];

const WMO: Record<number, string> = {
  0:'Ясно',1:'Преим.ясно',2:'Перем.облачн.',3:'Пасмурно',45:'Туман',48:'Изморозь',
  51:'Морось сл.',53:'Морось',55:'Морось сил.',61:'Дождь сл.',63:'Дождь',65:'Дождь сил.',
  71:'Снег сл.',73:'Снег',75:'Снег сил.',80:'Ливень сл.',81:'Ливень',82:'Ливень сил.',
  85:'Снегопад сл.',86:'Снегопад сил.',95:'Гроза',96:'Гроза+град',99:'Гроза+град сил.',
};
function wmoDesc(c: number|null): string { return c == null ? '' : (WMO[c] || ''); }

const WEEKDAYS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_SHORT = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];

function todayStr() { return new Date().toISOString().split('T')[0]; }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; }

function fmtDate(d: string): string {
  const dt = new Date(d + 'T12:00:00');
  const today = todayStr(), tomorrow = tomorrowStr();
  if (d === today) return 'Сегодня';
  if (d === tomorrow) return 'Завтра';
  return `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]}`;
}
function fmtWeekday(d: string): string { return WEEKDAYS[new Date(d + 'T12:00:00').getDay()]; }
function fmtVal(v: number|null, dec = 1): string { return v != null ? v.toFixed(dec) : '—'; }
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} UTC`;
}

function getWeatherIcon(c: number|null, size = 22) {
  if (c == null || c === 1) return <Sun className="text-amber-400" size={size} />;
  if (c === 0) return <Sun className="text-amber-500" size={size} />;
  if (c === 2) return <Cloud className="text-slate-400" size={size} />;
  if (c === 3) return <Cloud className="text-slate-500" size={size} />;
  if (c <= 48) return <CloudFog className="text-slate-400" size={size} />;
  if (c <= 55) return <CloudDrizzle className="text-blue-400" size={size} />;
  if (c <= 67) return <CloudRain className="text-blue-500" size={size} />;
  if (c <= 77) return <CloudSnow className="text-blue-300" size={size} />;
  if (c <= 82) return <CloudRain className="text-blue-600" size={size} />;
  return <CloudLightning className="text-amber-600" size={size} />;
}

function getTempColor(t: number|null): string {
  if (t == null) return 'text-slate-400';
  if (t <= -15) return 'text-blue-700';
  if (t <= -5) return 'text-blue-500';
  if (t <= 0) return 'text-cyan-500';
  if (t <= 10) return 'text-teal-600';
  if (t <= 18) return 'text-emerald-600';
  if (t <= 25) return 'text-orange-500';
  if (t <= 32) return 'text-red-500';
  return 'text-red-700';
}

type Tab = 'forecast' | 'compare' | 'agro' | 'sources';

/* ====== MAIN COMPONENT ====== */
export default function Home() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('forecast');
  const [activeSource, setActiveSource] = useState('ecmwf');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}/data/latest.json`)
      .then(r => { if (!r.ok) throw new Error('Data not found'); return r.json(); })
      .then(data => { setSnapshot(data); setLoading(false); })
      .catch(() => { setError('Не удалось загрузить данные'); setLoading(false); });
  }, []);

  const dates = useMemo(() => {
    if (!snapshot) return [];
    const s = new Set(snapshot.forecastRows.map(r => r.targetDate));
    return Array.from(s).sort();
  }, [snapshot]);

  const rowsByDateSource = useMemo(() => {
    const m: Record<string, Record<string, ForecastRow>> = {};
    if (!snapshot) return m;
    for (const r of snapshot.forecastRows) {
      if (!m[r.targetDate]) m[r.targetDate] = {};
      m[r.targetDate][r.sourceId] = r;
    }
    return m;
  }, [snapshot]);

  const agroByDate = useMemo(() => {
    const m: Record<string, Record<string, AgroRow>> = {};
    if (!snapshot) return m;
    for (const r of snapshot.agroRows) {
      if (!m[r.targetDate]) m[r.targetDate] = {};
      m[r.targetDate][r.sourceId] = r;
    }
    return m;
  }, [snapshot]);

  const today = rowsByDateSource[todayStr()]?.[activeSource] || rowsByDateSource[todayStr()]?.['ecmwf'];

  /* ====== RENDER ====== */
  if (loading) return <LoadingScreen />;
  if (!snapshot || error) return <ErrorScreen msg={error} />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-md shadow-green-200/50">
              <Sprout className="text-white" size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">АгроПогода</h1>
              <p className="text-[11px] text-slate-400">Белореченск, Краснодарский край</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">
              <Clock size={12} />
              {snapshot?.fetchedAt ? fmtTime(snapshot.fetchedAt) : '—'}
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {snapshot?.sourceCount || 0} модел.
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-0.5 -mb-px overflow-x-auto">
            {([
              ['forecast', 'Прогноз', <Thermometer key="t1" size={14} />],
              ['compare', 'Сравнение', <TrendingUp key="t2" size={14} />],
              ['agro', 'Сад / Огород', <TreePine key="t3" size={14} />],
              ['sources', 'Источники', <Eye key="t4" size={14} />],
            ] as [Tab, string, React.ReactNode][]).map(([k, label, icon]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  tab === k
                    ? 'border-emerald-500 text-emerald-700'
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
                }`}>
                {icon} {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        {tab === 'forecast' && (
          <ForecastTab
            today={today} dates={dates} rowsByDateSource={rowsByDateSource}
            activeSource={activeSource} onSourceChange={setActiveSource}
            expandedDay={expandedDay} onToggleDay={setExpandedDay}
          />
        )}
        {tab === 'compare' && <CompareTab dates={dates} rowsByDateSource={rowsByDateSource} />}
        {tab === 'agro' && <AgroTab dates={dates} agroByDate={agroByDate} />}
        {tab === 'sources' && <SourcesTab />}

        <footer className="text-center text-xs text-slate-400 pt-4 pb-8 space-y-1">
          <p>Данные: ECMWF IFS, GFS, ICON-EU (Open-Meteo, бесплатно) · Автообновление: 06:00 и 18:00 МСК</p>
          <p>Каждый снимок прогноза сохраняется в архив · 44.78°N, 40.12°E</p>
        </footer>
      </main>
    </div>
  );
}

/* ====== LOADING ====== */
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-green-200/50 animate-pulse">
          <Sprout className="text-white" size={28} />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-40 mx-auto bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-56 mx-auto bg-slate-100 rounded animate-pulse" />
        </div>
        <p className="text-sm text-slate-400">Загрузка прогноза...</p>
      </div>
    </div>
  );
}

/* ====== ERROR ====== */
function ErrorScreen({ msg }: { msg: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="text-center max-w-sm bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
          <AlertTriangle className="text-amber-500" size={28} />
        </div>
        <h2 className="text-lg font-semibold text-slate-700">{msg}</h2>
        <p className="text-sm text-slate-400 mt-2">Данные появятся после первого автоматического обновления (06:00 / 18:00 MSK)</p>
      </div>
    </div>
  );
}

/* ====== FORECAST TAB ====== */
function ForecastTab({ today, dates, rowsByDateSource, activeSource, onSourceChange, expandedDay, onToggleDay }: {
  today: ForecastRow | undefined; dates: string[]; rowsByDateSource: Record<string, Record<string, ForecastRow>>;
  activeSource: string; onSourceChange: (s: string) => void;
  expandedDay: string | null; onToggleDay: (d: string | null) => void;
}) {
  return (
    <>
      {/* Source selector */}
      <div className="flex gap-2 flex-wrap">
        {SOURCES.map(s => (
          <button key={s.id} onClick={() => onSourceChange(s.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
            style={activeSource === s.id
              ? { backgroundColor: s.bg, borderColor: s.border, color: s.color }
              : { backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#64748b' }
            }>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeSource === s.id ? s.color : '#cbd5e1' }} />
            {s.name}
          </button>
        ))}
      </div>

      {/* Today hero card */}
      {today && <TodayCard row={today} sourceName={SOURCES.find(s => s.id === activeSource)?.name || 'ECMWF IFS'} />}

      {/* Forecast list */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Calendar size={14} /> Прогноз на {dates.length} дней
          </h2>
          <span className="text-[11px] text-slate-400">{SOURCES.find(s => s.id === activeSource)?.name}</span>
        </div>
        <div className="divide-y divide-slate-50">
          {dates.map(d => {
            const r = rowsByDateSource[d]?.[activeSource];
            if (!r) return null;
            const isT = d === todayStr();
            const isExp = expandedDay === d;
            return (
              <div key={d}>
                <button
                  onClick={() => onToggleDay(isExp ? null : d)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${isT ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'}`}
                >
                  {/* Date */}
                  <div className="w-24 shrink-0">
                    <p className={`text-sm font-medium ${isT ? 'text-emerald-700' : 'text-slate-700'}`}>{fmtDate(d)}</p>
                    <p className="text-[11px] text-slate-400">{fmtWeekday(d)}</p>
                  </div>

                  {/* Weather icon */}
                  <div className="w-8 shrink-0 flex justify-center">{getWeatherIcon(r.weatherCode)}</div>

                  {/* Temperature range bar */}
                  <div className="flex items-center gap-2 w-40 shrink-0">
                    <span className="text-xs text-slate-400 w-8 text-right">{fmtVal(r.tempMin, 0)}°</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{
                          width: r.tempMin != null && r.tempMax != null
                            ? `${Math.min(100, Math.max(15, ((r.tempMax - r.tempMin + 15) / 55) * 100))}%`
                            : '0%',
                          background: 'linear-gradient(to right, #06b6d4, #f59e0b, #ef4444)',
                        }} />
                    </div>
                    <span className={`text-sm font-semibold w-8 ${getTempColor(r.tempMax)}`}>{fmtVal(r.tempMax, 0)}°</span>
                  </div>

                  {/* Precipitation */}
                  <div className="w-16 shrink-0 text-center">
                    {r.precipSum != null && r.precipSum > 0
                      ? <span className="text-xs font-medium text-blue-500">{fmtVal(r.precipSum, 1)} мм</span>
                      : r.precipProb != null && r.precipProb > 0
                        ? <span className="text-xs text-slate-400">{Math.round(r.precipProb)}%</span>
                        : <span className="text-xs text-slate-200">—</span>
                    }
                  </div>

                  {/* Wind */}
                  <div className="w-16 shrink-0 text-center">
                    {r.windMax != null
                      ? <span className="text-xs text-slate-500">{fmtVal(r.windMax, 0)} км/ч</span>
                      : <span className="text-xs text-slate-200">—</span>
                    }
                  </div>

                  {/* Expand arrow */}
                  <ChevronDown size={14} className={`text-slate-300 transition-transform shrink-0 ${isExp ? 'rotate-180' : ''}`} />
                </button>

                {/* Expanded details */}
                {isExp && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs text-slate-400 mb-3 font-medium">Подробности · {fmtDate(d)} {fmtWeekday(d)} · {wmoDesc(r.weatherCode)}</p>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                        <Stat icon={<Droplets size={14} className="text-blue-400" />} label="Влажность макс" value={r.humidityMax != null ? `${Math.round(r.humidityMax)}%` : '—'} />
                        <Stat icon={<Droplets size={14} className="text-blue-300" />} label="Влажность мин" value={r.humidityMin != null ? `${Math.round(r.humidityMin)}%` : '—'} />
                        <Stat icon={<Wind size={14} className="text-slate-400" />} label="Порывы ветра" value={r.windGusts != null ? `${fmtVal(r.windGusts, 0)} км/ч` : '—'} />
                        <Stat icon={<Gauge size={14} className="text-slate-400" />} label="Давление" value={r.pressureMax != null ? `${fmtVal(r.pressureMax, 0)} гПа` : '—'} />
                        <Stat icon={<Sun size={14} className="text-amber-400" />} label="УФ-индекс" value={r.uvIndexMax != null ? r.uvIndexMax.toFixed(1) : '—'} />
                        <Stat icon={<Sprout size={14} className="text-emerald-500" />} label="ЭТ₀" value={r.et0 != null ? `${fmtVal(r.et0)} мм/д` : '—'} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-slate-400">{icon} <span className="text-[10px]">{label}</span></div>
      <p className="text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}

/* ====== TODAY CARD ====== */
function TodayCard({ row, sourceName }: { row: ForecastRow; sourceName: string }) {
  return (
    <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 rounded-2xl p-5 text-white shadow-lg shadow-green-200/40">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-emerald-100 text-xs font-medium">Сегодня · {sourceName}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-5xl font-light">{fmtVal(row.tempMax, 0)}°</span>
            <span className="text-2xl font-light text-white/70">/ {fmtVal(row.tempMin, 0)}°</span>
          </div>
          <p className="text-emerald-100 text-sm mt-1">
            {getWeatherIcon(row.weatherCode, 16)} <span className="inline-block align-middle ml-1">{wmoDesc(row.weatherCode)}</span>
          </p>
        </div>
        <div className="text-right space-y-2 text-sm">
          {row.precipSum != null && row.precipSum > 0 && (
            <div className="flex items-center gap-1.5 justify-end"><CloudRain size={14} className="text-white/70" /> {fmtVal(row.precipSum, 1)} мм</div>
          )}
          {row.windMax != null && (
            <div className="flex items-center gap-1.5 justify-end"><Wind size={14} className="text-white/70" /> {fmtVal(row.windMax, 0)} км/ч</div>
          )}
          {row.humidityMax != null && (
            <div className="flex items-center gap-1.5 justify-end"><Droplets size={14} className="text-white/70" /> {Math.round(row.humidityMax)}%</div>
          )}
          {row.pressureMax != null && (
            <div className="flex items-center gap-1.5 justify-end"><Gauge size={14} className="text-white/70" /> {fmtVal(row.pressureMax, 0)} гПа</div>
          )}
        </div>
      </div>
      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-white/20">
        <MiniBar label="Осадки" value={row.precipSum ?? 0} max={25} unit="мм" barColor="bg-blue-300" />
        <MiniBar label="Ветер" value={row.windMax ?? 0} max={40} unit="км/ч" barColor="bg-yellow-300" />
        <MiniBar label="Влажность" value={row.humidityMax ?? 0} max={100} unit="%" barColor="bg-cyan-300" />
      </div>
    </div>
  );
}

function MiniBar({ label, value, max, unit, barColor }: { label: string; value: number; max: number; unit: string; barColor: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-white/70">{label}</span>
        <span className="font-medium">{typeof value === 'number' ? (value === 0 && label !== 'Влажность' ? '0' : value.toFixed(value >= 10 ? 0 : 1)) : value} {unit}</span>
      </div>
      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ====== COMPARE TAB ====== */
function CompareTab({ dates, rowsByDateSource }: {
  dates: string[]; rowsByDateSource: Record<string, Record<string, ForecastRow>>;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <TrendingUp size={14} /> Сравнение моделей
        </h2>
        <p className="text-[11px] text-slate-400 mt-0.5">ECMWF IFS vs GFS vs ICON-EU — температуры и осадки</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2.5 px-4 font-semibold text-slate-500 text-xs">Дата</th>
              {SOURCES.map(s => (
                <th key={s.id} colSpan={3} className="text-center py-2.5 px-2 text-xs font-semibold" style={{ color: s.color }}>
                  {s.name}
                </th>
              ))}
            </tr>
            <tr className="text-[10px] text-slate-400 border-b border-slate-50">
              <th></th>
              {SOURCES.map(s => (
                <React.Fragment key={s.id}>
                  <th>Макс</th><th>Мин</th><th>Ос</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.slice(0, 12).map(d => {
              const hasAny = SOURCES.some(s => rowsByDateSource[d]?.[s.id]);
              if (!hasAny) return null;
              const isT = d === todayStr();
              return (
                <tr key={d} className={`border-b border-slate-50 ${isT ? 'bg-emerald-50/40' : 'hover:bg-slate-50/60'}`}>
                  <td className={`py-2.5 px-4 text-xs font-medium ${isT ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {fmtDate(d)} <span className="text-slate-400">{fmtWeekday(d)}</span>
                  </td>
                  {SOURCES.map(s => {
                    const r = rowsByDateSource[d]?.[s.id];
                    if (!r) return (
                      <React.Fragment key={s.id}>
                        <td colSpan={3} className="text-center text-slate-200 text-xs py-2.5">—</td>
                      </React.Fragment>
                    );
                    return (
                      <React.Fragment key={s.id}>
                        <td className={`text-center py-2.5 px-1.5 text-xs font-medium ${getTempColor(r.tempMax)}`}>{fmtVal(r.tempMax, 0)}°</td>
                        <td className="text-center py-2.5 px-1.5 text-xs text-slate-500">{fmtVal(r.tempMin, 0)}°</td>
                        <td className="text-center py-2.5 px-1.5 text-xs font-medium">
                          {r.precipSum != null && r.precipSum > 0
                            ? <span className="text-blue-500">{fmtVal(r.precipSum, 1)}</span>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ====== AGRO TAB ====== */
function AgroTab({ dates, agroByDate }: {
  dates: string[]; agroByDate: Record<string, Record<string, AgroRow>>;
}) {
  const primary = 'ecmwf_soil';

  return (
    <>
      {/* Top cards: 3 days */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {dates.slice(0, 3).map(d => {
          const r = agroByDate[d]?.[primary];
          if (!r) return null;
          const isT = d === todayStr();
          return (
            <div key={d} className={`bg-white rounded-2xl border shadow-sm p-4 ${isT ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-200/80'}`}>
              <div className="flex items-center justify-between mb-3">
                <p className={`text-sm font-semibold ${isT ? 'text-emerald-700' : 'text-slate-700'}`}>
                  {fmtDate(d)} <span className="text-slate-400 font-normal">{fmtWeekday(d)}</span>
                </p>
                {r.frostRisk && (
                  <span className="text-[10px] font-medium bg-red-50 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <AlertTriangle size={10} /> Заморозки
                  </span>
                )}
              </div>
              <div className="space-y-2.5 text-xs">
                <AgroStat label="Т почвы 6 см" value={fmtVal(r.soilTemp6cm, 1)} unit="°C" icon={<Thermometer size={12} className="text-orange-400" />} />
                <AgroStat label="Т почвы 18 см" value={fmtVal(r.soilTemp18cm, 1)} unit="°C" icon={<Thermometer size={12} className="text-amber-400" />} />
                <AgroStat label="Т почвы 54 см" value={fmtVal(r.soilTemp54cm, 1)} unit="°C" icon={<Thermometer size={12} className="text-yellow-500" />} />
                <AgroStat label="Влажность почвы" value={fmtVal(r.soilMoisture07, 2)} unit="м³/м³" icon={<Droplets size={12} className="text-blue-400" />} />
                <AgroStat label="ЭТ₀" value={fmtVal(r.et0Sum)} unit="мм/д" icon={<Sprout size={12} className="text-emerald-500" />} />
                <AgroStat label="GDD (≥10°C)" value={fmtVal(r.growingDegreeDays)} unit="°C·д" icon={<Leaf size={12} className="text-green-500" />} />
                <AgroStat label="Солн. радиация" value={fmtVal(r.solarRadiationSum)} unit="МДж/м²" icon={<Sun size={12} className="text-amber-400" />} />
                <AgroStat label="Точка росы" value={fmtVal(r.dewPointMax)} unit="°C" icon={<Droplets size={12} className="text-cyan-400" />} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Agro table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <TreePine size={14} /> Полные агрометеоданные
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Температура почвы, влажность, ЭТ₀, GDD, риск заморозков</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left py-2.5 px-3 font-semibold text-slate-500">Дата</th>
                <th className="text-center py-2.5 px-2 font-semibold text-slate-500">Т почвы<br/>6см</th>
                <th className="text-center py-2.5 px-2 font-semibold text-slate-500">Т почвы<br/>18см</th>
                <th className="text-center py-2.5 px-2 font-semibold text-slate-500">Т почвы<br/>54см</th>
                <th className="text-center py-2.5 px-2 font-semibold text-slate-500">Влажн.<br/>0-7</th>
                <th className="text-center py-2.5 px-2 font-semibold text-slate-500">Влажн.<br/>28-100</th>
                <th className="text-center py-2.5 px-2 font-semibold text-slate-500">ЭТ₀</th>
                <th className="text-center py-2.5 px-2 font-semibold text-slate-500">Роса</th>
                <th className="text-center py-2.5 px-2 font-semibold text-slate-500">Солн.</th>
                <th className="text-center py-2.5 px-2 font-semibold text-slate-500">GDD</th>
                <th className="text-center py-2.5 px-2 font-semibold text-slate-500">Зам.</th>
              </tr>
            </thead>
            <tbody>
              {dates.map(d => {
                const r = agroByDate[d]?.[primary];
                if (!r) return null;
                const isT = d === todayStr();
                return (
                  <tr key={d} className={`border-b border-slate-50 ${isT ? 'bg-emerald-50/40' : 'hover:bg-slate-50/60'}`}>
                    <td className={`py-2.5 px-3 font-medium ${isT ? 'text-emerald-700' : 'text-slate-600'}`}>
                      {fmtDate(d)} <span className="text-slate-400">{fmtWeekday(d)}</span>
                    </td>
                    <td className="text-center py-2.5 px-2 text-slate-700">{fmtVal(r.soilTemp6cm, 1)}</td>
                    <td className="text-center py-2.5 px-2 text-slate-700">{fmtVal(r.soilTemp18cm, 1)}</td>
                    <td className="text-center py-2.5 px-2 text-slate-700">{fmtVal(r.soilTemp54cm, 1)}</td>
                    <td className="text-center py-2.5 px-2 text-slate-700">{fmtVal(r.soilMoisture07, 2)}</td>
                    <td className="text-center py-2.5 px-2 text-slate-700">{fmtVal(r.soilMoisture28100, 2)}</td>
                    <td className="text-center py-2.5 px-2 text-slate-700">{fmtVal(r.et0Sum)}</td>
                    <td className="text-center py-2.5 px-2 text-slate-700">{fmtVal(r.dewPointMax)}</td>
                    <td className="text-center py-2.5 px-2 text-slate-700">{fmtVal(r.solarRadiationSum)}</td>
                    <td className="text-center py-2.5 px-2 font-medium text-slate-700">{fmtVal(r.growingDegreeDays)}</td>
                    <td className="text-center py-2.5 px-2">
                      {r.frostRisk
                        ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-50"><AlertTriangle size={11} className="text-red-500" /></span>
                        : <span className="text-emerald-400">✓</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function AgroStat({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-slate-500">{icon} {label}</span>
      <span className="font-medium text-slate-700">{value} <span className="text-slate-400 font-normal">{unit}</span></span>
    </div>
  );
}

/* ====== SOURCES TAB ====== */
function SourcesTab() {
  const forecast = [
    { name: 'ECMWF IFS', org: 'ECMWF (Европа)', res: '9 км', days: '10', color: '#16a34a', bg: '#dcfce7', note: 'Лучшая глобальная модель. Осадки ~2x точнее ERA5.' },
    { name: 'GFS', org: 'NWS (США)', res: '25 км', days: '16', color: '#2563eb', bg: '#dbeafe', note: 'Основная модель США. 16 дней прогноза.' },
    { name: 'ICON-EU', org: 'DWD (Германия)', res: '6 км', days: '7', color: '#9333ea', bg: '#f3e8ff', note: 'Высочайшее разрешение для Европы и юга России.' },
  ];
  const api = { name: 'Open-Meteo', org: 'Агрегатор', color: '#0891b2', bg: '#cffafe', note: 'Бесплатный API, без ключа. Единый интерфейс для всех моделей.' };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Eye size={14} /> Источники прогноза</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {forecast.map(s => (
            <div key={s.name} className="px-4 py-3.5 flex items-start gap-3">
              <div className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: s.color }} />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-slate-800">{s.name}</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>Модель</span>
                  <span className="text-[10px] text-slate-400">{s.res} · до {s.days} дн.</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{s.org}</p>
                <p className="text-xs text-slate-500 mt-1">{s.note}</p>
              </div>
            </div>
          ))}
          <div className="px-4 py-3.5 flex items-start gap-3">
            <div className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: api.color }} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-800">{api.name}</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: api.bg, color: api.color }}>API</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{api.org}</p>
              <p className="text-xs text-slate-500 mt-1">{api.note}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Архитектура проекта</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ArchCard title="Data-First" desc="Прогнозы загружаются на сервере и сохраняются как JSON. Страница открывается мгновенно без клиентских API-вызовов." />
          <ArchCard title="Auto-update" desc="GitHub Actions cron 2 раза в день (06:00 и 18:00 MSK). Данные обновляются, билдятся и деплоятся автоматически." />
          <ArchCard title="Immutable Snapshots" desc="Каждый снимок прогноза сохраняется с таймстемпом. Данные неизменяемы — можно сравнить прогноз с фактом." />
          <ArchCard title="Стек" desc="Next.js 14 (static export) + TypeScript + Tailwind CSS + Lucide Icons + GitHub Pages" />
        </div>
      </div>
    </div>
  );
}

function ArchCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <p className="text-xs font-semibold text-slate-700 mb-1">{title}</p>
      <p className="text-[11px] text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}
