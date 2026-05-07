import { ForecastRow, AgroRow, FactRow, GeoLocation, UserObservation } from './types';

const K = {
  FORECASTS: 'ap_forecasts',
  AGRO: 'ap_agro',
  FACTS: 'ap_facts',
  LOCATION: 'ap_location',
  PARAMS: 'ap_params',
  AGRO_PARAMS: 'ap_agro_params',
  OBS: 'ap_obs',
  RECENT_CITIES: 'ap_recent_cities',
  CITY_SLUG: 'ap_city_slug',
};

function gs<T>(key: string): T | null {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; }
}
function ss(key: string, v: any): void {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

export function locId(loc: { lat: number; lon: number }): string {
  return `${loc.lat.toFixed(2)}_${loc.lon.toFixed(2)}`;
}

/* ====== ForecastRow ====== */
export function loadForecastRows(): ForecastRow[] { return gs<ForecastRow[]>(K.FORECASTS) || []; }
export function addForecastRows(newRows: ForecastRow[]): void {
  const existing = loadForecastRows();
  const existingIds = new Set(existing.map(r => r.id));
  let combined = [...existing, ...newRows.filter(r => !existingIds.has(r.id))];
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 120);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  combined = combined.filter(r => r.snapshotDate >= cutoffStr);
  ss(K.FORECASTS, combined);
}
export function hasTodaySnapshot(lid: string): boolean {
  const rows = loadForecastRows();
  const today = todayStr();
  return rows.some(r => r.locationId === lid && r.snapshotDate === today);
}

/* ====== AgroRow ====== */
export function loadAgroRows(): AgroRow[] { return gs<AgroRow[]>(K.AGRO) || []; }
export function addAgroRows(newRows: AgroRow[]): void {
  const existing = loadAgroRows();
  const existingIds = new Set(existing.map(r => r.id));
  let combined = [...existing, ...newRows.filter(r => !existingIds.has(r.id))];
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 120);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  combined = combined.filter(r => r.snapshotDate >= cutoffStr);
  ss(K.AGRO, combined);
}
export function hasTodayAgroSnapshot(lid: string): boolean {
  return loadAgroRows().some(r => r.locationId === lid && r.snapshotDate === todayStr());
}

/* ====== FactRow ====== */
export function loadFactRows(): FactRow[] { return gs<FactRow[]>(K.FACTS) || []; }
export function addFactRows(newRows: FactRow[]): void {
  const existing = loadFactRows();
  const existingIds = new Set(existing.map(r => r.id));
  ss(K.FACTS, [...existing, ...newRows.filter(r => !existingIds.has(r.id))]);
}
export function clearFacts(): void { ss(K.FACTS, []); }

/* ====== Location ====== */
export const saveLocation = (v: GeoLocation) => ss(K.LOCATION, v);
export const loadLocation = (): GeoLocation | null => gs<GeoLocation>(K.LOCATION);

/* ====== Params ====== */
export const saveParams = (v: string[]) => ss(K.PARAMS, v);
export const loadParams = (): string[] | null => gs<string[]>(K.PARAMS);
export const saveAgroParams = (v: string[]) => ss(K.AGRO_PARAMS, v);
export const loadAgroParams = (): string[] | null => gs<string[]>(K.AGRO_PARAMS);

/* ====== Recent cities ====== */
export const loadRecentCities = (): GeoLocation[] => gs<GeoLocation[]>(K.RECENT_CITIES) || [];
function saveRecentCities(cities: GeoLocation[]): void { ss(K.RECENT_CITIES, cities.slice(0, 15)); }
export function addRecentCity(city: GeoLocation): void {
  const cities = loadRecentCities();
  const idx = cities.findIndex(c => locId(c) === locId(city));
  if (idx >= 0) cities.splice(idx, 1);
  cities.unshift(city);
  saveRecentCities(cities);
}

/* ====== City slug ====== */
export const saveCitySlug = (v: string) => ss(K.CITY_SLUG, v);
export const loadCitySlug = (): string | null => gs<string>(K.CITY_SLUG);

/* ====== Observations ====== */
export const loadObs = (): UserObservation[] => gs<UserObservation[]>(K.OBS) || [];
export function addObs(o: UserObservation): void {
  const a = loadObs(); a.unshift(o);
  if (a.length > 500) a.length = 500;
  ss(K.OBS, a);
}
export function delObs(id: string): void { ss(K.OBS, loadObs().filter(o => o.id !== id)); }

/* ====== Helpers ====== */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function gid(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
export function formatDate(ds: string): string {
  const d = new Date(ds + 'T00:00:00');
  const w = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const m = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  return d.getDate() + ' ' + m[d.getMonth()] + ', ' + w[d.getDay()];
}
export function formatDateFull(ds: string): string {
  const d = new Date(ds + 'T00:00:00');
  const m = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return d.getDate() + ' ' + m[d.getMonth()] + ' ' + d.getFullYear();
}
export function fmt(v: number|null|undefined, dec: number = 1): string {
  return v != null ? v.toFixed(dec) : '—';
}
export function getPrecipClass(mm: number|null): string {
  if (mm == null || mm === 0) return 'pl';
  if (mm < 5) return 'pl'; if (mm < 20) return 'pm'; return 'ph';
}
export function pbw(v: number|null): number {
  return (v == null || v === 0) ? 0 : Math.min(100, Math.max(2, v * 2));
}
export function expCSV(obs: UserObservation[]): string {
  return '\uFEFFДата;Температура;Влажность;Осадки;Ветер;Примечания\n' +
    obs.map(o => `${o.date};${o.temp};${o.humidity};${o.precip};${o.wind};${o.notes}`).join('\n');
}
export function dlCSV(csv: string, fn: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = fn; a.click();
}
