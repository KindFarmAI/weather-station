import { GeoLocation, DailyForecast, HourlyForecast, ForecastSource, ForecastRow, ArchiveDay, FactRow } from './types';
import { locId, todayStr, loadCitySlug, saveCitySlug } from './storage';

const NOM = 'https://nominatim.openstreetmap.org/search';
const FC  = 'https://api.open-meteo.com/v1/forecast';
const AR  = 'https://archive-api.open-meteo.com/v1/archive';
const PROXY = 'https://api.allorigins.win/raw?url=';

/* ====== Geocoding ====== */
export async function searchLocations(q: string): Promise<GeoLocation[]> {
  if (!q || q.length < 2) return [];
  const p = new URLSearchParams({
    q, format: 'json', limit: '10',
    'accept-language': 'ru,en',
    addressdetails: '1',
    countrycodes: 'ru',
  });
  const r = await fetch(NOM + '?' + p, { headers: { 'User-Agent': 'AgroPogoda/1.0' } });
  if (!r.ok) throw new Error('Geocoding error');
  return (await r.json()).map((x: any) => ({
    name: x.name || x.display_name.split(',')[0],
    lat: +x.lat, lon: +x.lon,
    country: x.address?.country,
    admin1: x.address?.state || x.address?.region,
    displayName: x.display_name,
  }));
}

/* ====== Forecast parameter lists ====== */
const DF = 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,relative_humidity_2m_max,relative_humidity_2m_min,surface_pressure_max,surface_pressure_min,uv_index_max,et0_fao_evapotranspiration,weather_code,sunrise,sunset';
const HF = 'temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,relative_humidity_2m,surface_pressure,weather_code,cloud_cover,visibility,wind_gusts_10m,is_day';

function pD(d: any): DailyForecast[] {
  if (!d.daily?.time) return [];
  return d.daily.time.map((t: string, i: number) => ({
    date: t,
    tempMax: d.daily.temperature_2m_max?.[i] ?? null,
    tempMin: d.daily.temperature_2m_min?.[i] ?? null,
    precipSum: d.daily.precipitation_sum?.[i] ?? null,
    windMax: d.daily.wind_speed_10m_max?.[i] ?? null,
    windDir: null,
    humidityMax: d.daily.relative_humidity_2m_max?.[i] ?? null,
    humidityMin: d.daily.relative_humidity_2m_min?.[i] ?? null,
    pressureMax: d.daily.surface_pressure_max?.[i] ?? null,
    pressureMin: d.daily.surface_pressure_min?.[i] ?? null,
    uvIndexMax: d.daily.uv_index_max?.[i] ?? null,
    precipProb: d.daily.precipitation_probability_max?.[i] ?? null,
    sunrise: d.daily.sunrise?.[i] ?? null,
    sunset: d.daily.sunset?.[i] ?? null,
    weatherCode: d.daily.weather_code?.[i] ?? null,
    windGusts: d.daily.wind_gusts_10m_max?.[i] ?? null,
    et0: d.daily.et0_fao_evapotranspiration?.[i] ?? null,
  }));
}
function pH(d: any): HourlyForecast[] {
  if (!d.hourly?.time) return [];
  return d.hourly.time.map((t: string, i: number) => ({
    time: t, temp: d.hourly.temperature_2m?.[i] ?? null, precip: d.hourly.precipitation?.[i] ?? null,
    windSpeed: d.hourly.wind_speed_10m?.[i] ?? null, windDir: d.hourly.wind_direction_10m?.[i] ?? null,
    humidity: d.hourly.relative_humidity_2m?.[i] ?? null, pressure: d.hourly.surface_pressure?.[i] ?? null,
    weatherCode: d.hourly.weather_code?.[i] ?? null, cloudCover: d.hourly.cloud_cover?.[i] ?? null,
    visibility: d.hourly.visibility?.[i] ?? null, windGusts: d.hourly.wind_gusts_10m?.[i] ?? null,
    isDay: d.hourly.is_day?.[i] ?? null,
  }));
}
function mkErr(id: string, nm: string, md: string, msg: string): ForecastSource {
  return { id, name: nm, model: md, daily: [], hourly: [], loaded: false, error: msg, loading: false };
}

/* ====== Individual forecast sources ====== */
export async function fetchECMWF(lat: number, lon: number, days: number = 16): Promise<ForecastSource> {
  try {
    const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), forecast_days: String(days), models: 'ecmwf_ifs', daily: DF, hourly: HF, timezone: 'auto' });
    const r = await fetch(FC + '?' + p); if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    return { id: 'ecmwf', name: 'ECMWF IFS', model: 'ecmwf_ifs', daily: pD(d), hourly: pH(d), loaded: true, error: null, loading: false };
  } catch (e: any) { return mkErr('ecmwf', 'ECMWF IFS', 'ecmwf_ifs', e.message); }
}
export async function fetchGFS(lat: number, lon: number, days: number = 16): Promise<ForecastSource> {
  try {
    const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), forecast_days: String(days), models: 'gfs_seamless', daily: DF, hourly: HF, timezone: 'auto' });
    const r = await fetch(FC + '?' + p); if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    return { id: 'gfs', name: 'GFS', model: 'gfs_seamless', daily: pD(d), hourly: pH(d), loaded: true, error: null, loading: false };
  } catch (e: any) { return mkErr('gfs', 'GFS', 'gfs_seamless', e.message); }
}
export async function fetchICON(lat: number, lon: number, days: number = 7): Promise<ForecastSource> {
  try {
    const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), forecast_days: String(days), models: 'icon_eu', daily: DF, timezone: 'auto' });
    const r = await fetch(FC + '?' + p); if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    return { id: 'icon', name: 'ICON-EU', model: 'icon_eu', daily: pD(d), hourly: [], loaded: true, error: null, loading: false };
  } catch (e: any) { return mkErr('icon', 'ICON-EU', 'icon_eu', e.message); }
}

/* ====== Yandex (via proxy) ====== */
export async function fetchYandex(slug: string): Promise<ForecastSource> {
  const base: ForecastSource = { id: 'yandex', name: 'Яндекс', model: 'yandex', daily: [], hourly: [], loaded: false, error: null, loading: true };
  try {
    const url = 'https://yandex.ru/pogoda/' + encodeURIComponent(slug) + '/details?via=mstack';
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(PROXY + encodeURIComponent(url), { signal: ctrl.signal }); clearTimeout(t);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const html = await r.text();
    if (!html || html.length < 500) throw new Error('Пустой ответ');
    const days = parseYa(html);
    return { ...base, daily: days, loaded: days.length > 0, error: days.length === 0 ? 'Парсинг' : '', loading: false };
  } catch (e: any) {
    return { ...base, error: e.name === 'AbortError' ? 'Таймаут' : e.message, loading: false };
  }
}
function parseYa(html: string): DailyForecast[] {
  const out: DailyForecast[] = [];
  const mm: any = { 'января':'01','февраля':'02','марта':'03','апреля':'04','мая':'05','июня':'06','июля':'07','августа':'08','сентября':'09','октября':'10','ноября':'11','декабря':'12' };
  const yr = new Date().getFullYear();
  const blocks = html.split('weather-table__row');
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i];
    const dm = b.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i);
    if (!dm) continue;
    const ts = Array.from(b.matchAll(/temp__value[^"]*"[^>]*>([+-]?\d+)/g));
    const pm = b.match(/precipitation[^"]*"[^>]*>\s*(?:<[^>]*>)*\s*([\d,.]+)\s*мм/);
    const mo = mm[dm[2].toLowerCase()] || '01'; const da = dm[1].padStart(2, '0');
    out.push({
      date: yr + '-' + mo + '-' + da,
      tempMax: ts.length ? +ts[0][1] : null,
      tempMin: ts.length > 1 ? +ts[ts.length - 1][1] : ts.length ? +ts[0][1] : null,
      precipSum: pm ? +pm[1].replace(',', '.') : 0, windMax: null, windDir: null,
      humidityMax: null, humidityMin: null, pressureMax: null, pressureMin: null,
      uvIndexMax: null, precipProb: null, sunrise: null, sunset: null, weatherCode: null, windGusts: null, et0: null,
    });
  }
  return out;
}

/* ====== Archive sources ====== */
export async function fetchRecentArchive(lat: number, lon: number, days: number = 14): Promise<ArchiveDay[]> {
  try {
    const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), past_days: String(days), forecast_days: '1',
      models: 'ecmwf_ifs', daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max', timezone: 'auto' });
    const r = await fetch(FC + '?' + p); if (!r.ok) return [];
    const d = await r.json(); if (!d.daily?.time) return [];
    return d.daily.time.map((t: string, i: number) => ({
      date: t, tempMax: d.daily.temperature_2m_max?.[i] ?? null, tempMin: d.daily.temperature_2m_min?.[i] ?? null,
      precipSum: d.daily.precipitation_sum?.[i] ?? null, windMax: d.daily.wind_speed_10m_max?.[i] ?? null, source: 'ecmwf_ifs',
    }));
  } catch { return []; }
}
export async function fetchERA5Archive(lat: number, lon: number, s: string, e: string): Promise<ArchiveDay[]> {
  try {
    const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), start_date: s, end_date: e,
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max', timezone: 'auto' });
    const r = await fetch(AR + '?' + p); if (!r.ok) return [];
    const d = await r.json(); if (!d.daily?.time) return [];
    return d.daily.time.map((t: string, i: number) => ({
      date: t, tempMax: d.daily.temperature_2m_max?.[i] ?? null, tempMin: d.daily.temperature_2m_min?.[i] ?? null,
      precipSum: d.daily.precipitation_sum?.[i] ?? null, windMax: d.daily.wind_speed_10m_max?.[i] ?? null, source: 'era5',
    }));
  } catch { return []; }
}

/* ====== DATA-FIRST: Convert DailyForecast[] → ForecastRow[] ====== */
export function toForecastRows(
  sourceId: string, sourceName: string,
  dailyForecasts: DailyForecast[],
  loc: GeoLocation,
  snapshotDate: string,
): ForecastRow[] {
  const lid = locId(loc);
  return dailyForecasts.map(d => {
    const targetDate = d.date;
    const daysBefore = Math.round(
      (new Date(targetDate + 'T12:00:00').getTime() - new Date(snapshotDate + 'T12:00:00').getTime()) / 86400000
    );
    return {
      id: `${lid}_${sourceId}_${targetDate}_${snapshotDate}`,
      targetDate, sourceId, sourceName, snapshotDate, daysBefore, locationId: lid,
      tempMax: d.tempMax, tempMin: d.tempMin, precipSum: d.precipSum, precipProb: d.precipProb,
      windMax: d.windMax, windGusts: d.windGusts,
      humidityMax: d.humidityMax, humidityMin: d.humidityMin,
      pressureMax: d.pressureMax, pressureMin: d.pressureMin,
      uvIndexMax: d.uvIndexMax, weatherCode: d.weatherCode, et0: d.et0,
    };
  });
}

/* ====== Fetch all sources → ForecastRow[] ====== */
export async function fetchAllForecasts(loc: GeoLocation, days: number = 16): Promise<ForecastRow[]> {
  const snapDate = todayStr();
  const [ecmwf, gfs, icon] = await Promise.all([
    fetchECMWF(loc.lat, loc.lon, days),
    fetchGFS(loc.lat, loc.lon, days),
    fetchICON(loc.lat, loc.lon, Math.min(days, 7)),
  ]);
  const rows: ForecastRow[] = [];
  if (ecmwf.loaded) rows.push(...toForecastRows('ecmwf', 'ECMWF IFS', ecmwf.daily, loc, snapDate));
  if (gfs.loaded)   rows.push(...toForecastRows('gfs', 'GFS', gfs.daily, loc, snapDate));
  if (icon.loaded)  rows.push(...toForecastRows('icon', 'ICON-EU', icon.daily, loc, snapDate));

  /* Yandex — optional, non-blocking */
  try {
    const slug = loadCitySlug() || loc.name.toLowerCase().replace(/\s+/g, '-');
    saveCitySlug(slug);
    const ya = await fetchYandex(slug);
    if (ya.loaded && ya.daily.length > 0) rows.push(...toForecastRows('yandex', 'Яндекс', ya.daily, loc, snapDate));
  } catch {}

  return rows;
}

/* ====== Fetch hourly for specific date (on-demand, not stored) ====== */
export async function fetchHourly(lat: number, lon: number, date: string): Promise<HourlyForecast[]> {
  try {
    const end = new Date(date + 'T00:00:00'); end.setDate(end.getDate() + 1);
    const p = new URLSearchParams({
      latitude: String(lat), longitude: String(lon),
      start_date: date, end_date: end.toISOString().split('T')[0],
      hourly: HF, timezone: 'auto',
    });
    const r = await fetch(FC + '?' + p); if (!r.ok) return [];
    const d = await r.json(); return pH(d);
  } catch { return []; }
}

/* ====== Fetch facts → FactRow[] ====== */
export async function fetchFacts(loc: GeoLocation, days: number = 60): Promise<FactRow[]> {
  const lid = locId(loc);
  try {
    const p = new URLSearchParams({ latitude: String(loc.lat), longitude: String(loc.lon), past_days: String(days), forecast_days: '1',
      models: 'ecmwf_ifs', daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max', timezone: 'auto' });
    const r = await fetch(FC + '?' + p); if (!r.ok) return [];
    const d = await r.json(); if (!d.daily?.time) return [];
    return d.daily.time.map((t: string, i: number) => ({
      id: `${lid}_fact_${t}`, date: t, locationId: lid, source: 'ecmwf_ifs',
      tempMax: d.daily.temperature_2m_max?.[i] ?? null, tempMin: d.daily.temperature_2m_min?.[i] ?? null,
      precipSum: d.daily.precipitation_sum?.[i] ?? null, windMax: d.daily.wind_speed_10m_max?.[i] ?? null,
    }));
  } catch { return []; }
}
