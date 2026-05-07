import { GeoLocation, DailyForecast, HourlyForecast, ForecastRow, AgroRow, ArchiveDay, FactRow } from './types';
import { locId, todayStr, loadCitySlug, saveCitySlug } from './storage';

const NOM = 'https://nominatim.openstreetmap.org/search';
const FC  = 'https://api.open-meteo.com/v1/forecast';
const AR  = 'https://archive-api.open-meteo.com/v1/archive';
const PROXY = 'https://api.allorigins.win/raw?url=';

/* ====== Геокодинг (приоритет РФ) ====== */
export async function searchLocations(q: string): Promise<GeoLocation[]> {
  if (!q || q.length < 2) return [];
  const pRu = new URLSearchParams({ q, format: 'json', limit: '8', 'accept-language': 'ru', addressdetails: '1', countrycodes: 'ru' });
  try {
    const r = await fetch(NOM + '?' + pRu, { headers: { 'User-Agent': 'AgroPogoda/1.0' } });
    if (r.ok) { const data = await r.json(); if (data.length > 0) return data.map((x: any) => ({ name: x.name || x.display_name.split(',')[0], lat: +x.lat, lon: +x.lon, country: x.address?.country, admin1: x.address?.state || x.address?.region, displayName: x.display_name })); }
  } catch {}
  const pAll = new URLSearchParams({ q, format: 'json', limit: '8', 'accept-language': 'ru,en', addressdetails: '1' });
  const r = await fetch(NOM + '?' + pAll, { headers: { 'User-Agent': 'AgroPogoda/1.0' } });
  if (!r.ok) return [];
  return (await r.json()).map((x: any) => ({ name: x.name || x.display_name.split(',')[0], lat: +x.lat, lon: +x.lon, country: x.address?.country, admin1: x.address?.state || x.address?.region, displayName: x.display_name }));
}

/* ====== Списки параметров (без дублей) ====== */
const DF = 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,relative_humidity_2m_max,relative_humidity_2m_min,surface_pressure_max,surface_pressure_min,uv_index_max,et0_fao_evapotranspiration,weather_code,sunrise,sunset,dew_point_2m_max,vapor_pressure_deficit_max,shortwave_radiation_sum';
const HF = 'temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,relative_humidity_2m,surface_pressure,weather_code,cloud_cover,visibility,wind_gusts_10m,is_day,soil_moisture_0_to_7cm,soil_moisture_28_to_100cm,soil_temperature_0_to_7cm,soil_temperature_7_to_28cm,soil_temperature_28_to_100cm';

function pD(d: any): DailyForecast[] {
  if (!d.daily?.time) return [];
  return d.daily.time.map((t: string, i: number) => ({
    date: t, tempMax: d.daily.temperature_2m_max?.[i] ?? null, tempMin: d.daily.temperature_2m_min?.[i] ?? null,
    precipSum: d.daily.precipitation_sum?.[i] ?? null, windMax: d.daily.wind_speed_10m_max?.[i] ?? null, windDir: null,
    humidityMax: d.daily.relative_humidity_2m_max?.[i] ?? null, humidityMin: d.daily.relative_humidity_2m_min?.[i] ?? null,
    pressureMax: d.daily.surface_pressure_max?.[i] ?? null, pressureMin: d.daily.surface_pressure_min?.[i] ?? null,
    uvIndexMax: d.daily.uv_index_max?.[i] ?? null, precipProb: d.daily.precipitation_probability_max?.[i] ?? null,
    sunrise: d.daily.sunrise?.[i] ?? null, sunset: d.daily.sunset?.[i] ?? null,
    weatherCode: d.daily.weather_code?.[i] ?? null, windGusts: d.daily.wind_gusts_10m_max?.[i] ?? null,
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
function mkErr(id: string, nm: string, md: string, msg: string): any {
  return { id, name: nm, model: md, daily: [], hourly: [], loaded: false, error: msg, loading: false };
}

/* ====== Модели прогнозов ====== */
export async function fetchECMWF(lat: number, lon: number, days: number = 10): Promise<any> {
  try {
    const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), forecast_days: String(days), models: 'ecmwf_ifs', daily: DF, hourly: HF, timezone: 'auto' });
    const r = await fetch(FC + '?' + p); if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    return { id: 'ecmwf', name: 'ECMWF IFS', model: 'ecmwf_ifs', daily: pD(d), hourly: pH(d), loaded: true, error: null, loading: false, agroData: d };
  } catch (e: any) { return mkErr('ecmwf', 'ECMWF IFS', 'ecmwf_ifs', e.message); }
}
export async function fetchGFS(lat: number, lon: number, days: number = 16): Promise<any> {
  try {
    const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), forecast_days: String(days), models: 'gfs_seamless', daily: DF, hourly: HF, timezone: 'auto' });
    const r = await fetch(FC + '?' + p); if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    return { id: 'gfs', name: 'GFS', model: 'gfs_seamless', daily: pD(d), hourly: pH(d), loaded: true, error: null, loading: false, agroData: d };
  } catch (e: any) { return mkErr('gfs', 'GFS', 'gfs_seamless', e.message); }
}
export async function fetchICON(lat: number, lon: number, days: number = 7): Promise<any> {
  try {
    const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), forecast_days: String(days), models: 'icon_eu', daily: DF, hourly: HF, timezone: 'auto' });
    const r = await fetch(FC + '?' + p); if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    return { id: 'icon', name: 'ICON-EU', model: 'icon_eu', daily: pD(d), hourly: pH(d), loaded: true, error: null, loading: false, agroData: d };
  } catch (e: any) { return mkErr('icon', 'ICON-EU', 'icon_eu', e.message); }
}

/* ====== DATA-FIRST: DailyForecast → ForecastRow[] ====== */
export function toForecastRows(sourceId: string, sourceName: string, dailyForecasts: DailyForecast[], loc: GeoLocation, snapshotDate: string): ForecastRow[] {
  const lid = locId(loc);
  return dailyForecasts.map(d => {
    const targetDate = d.date;
    const daysBefore = Math.round((new Date(targetDate + 'T12:00:00').getTime() - new Date(snapshotDate + 'T12:00:00').getTime()) / 86400000);
    return { id: `${lid}_${sourceId}_${targetDate}_${snapshotDate}`, targetDate, sourceId, sourceName, snapshotDate, daysBefore, locationId: lid, tempMax: d.tempMax, tempMin: d.tempMin, precipSum: d.precipSum, precipProb: d.precipProb, windMax: d.windMax, windGusts: d.windGusts, humidityMax: d.humidityMax, humidityMin: d.humidityMin, pressureMax: d.pressureMax, pressureMin: d.pressureMin, uvIndexMax: d.uvIndexMax, weatherCode: d.weatherCode, et0: d.et0 };
  });
}

/* ====== DATA-FIRST: Open-Meteo response → AgroRow[] ====== */
export function toAgroRows(sourceId: string, sourceName: string, apiData: any, loc: GeoLocation, snapshotDate: string): AgroRow[] {
  if (!apiData?.daily?.time) return [];
  const lid = locId(loc);
  const hm07: Record<string, number[]> = {}, hm28: Record<string, number[]> = {};
  const ht07: Record<string, number[]> = {}, ht18: Record<string, number[]> = {}, ht54: Record<string, number[]> = {};
  if (apiData.hourly?.time) {
    for (let i = 0; i < apiData.hourly.time.length; i++) {
      const date = apiData.hourly.time[i].split('T')[0];
      const push = (obj: any, val: any) => { if (!obj[date]) obj[date] = []; if (val != null) obj[date].push(val); };
      push(hm07, apiData.hourly.soil_moisture_0_to_7cm?.[i]);
      push(hm28, apiData.hourly.soil_moisture_28_to_100cm?.[i]);
      push(ht07, apiData.hourly.soil_temperature_0_to_7cm?.[i]);
      push(ht18, apiData.hourly.soil_temperature_7_to_28cm?.[i]);
      push(ht54, apiData.hourly.soil_temperature_28_to_100cm?.[i]);
    }
  }
  const avg = (arr: number[] | undefined) => arr?.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  return apiData.daily.time.map((date: string, i: number) => {
    const daysBefore = Math.round((new Date(date + 'T12:00:00').getTime() - new Date(snapshotDate + 'T12:00:00').getTime()) / 86400000);
    const tMax = apiData.daily.temperature_2m_max?.[i] ?? null;
    const tMin = apiData.daily.temperature_2m_min?.[i] ?? null;
    const gdd = tMax != null && tMin != null ? Math.max(0, ((tMax + tMin) / 2) - 10) : null;
    return {
      id: `${lid}_${sourceId}_${date}_${snapshotDate}`, targetDate: date, sourceId, sourceName, snapshotDate, daysBefore, locationId: lid,
      soilTemp6cm: avg(ht07[date]) ? +avg(ht07[date])!.toFixed(1) : null,
      soilTemp18cm: avg(ht18[date]) ? +avg(ht18[date])!.toFixed(1) : null,
      soilTemp54cm: avg(ht54[date]) ? +avg(ht54[date])!.toFixed(1) : null,
      soilMoisture07: avg(hm07[date]) ? +avg(hm07[date])!.toFixed(3) : null,
      soilMoisture28100: avg(hm28[date]) ? +avg(hm28[date])!.toFixed(3) : null,
      et0Sum: apiData.daily.et0_fao_evapotranspiration?.[i] ?? null,
      dewPointMax: apiData.daily.dew_point_2m_max?.[i] ?? null,
      vaporPressureDefMax: apiData.daily.vapor_pressure_deficit_max?.[i] ?? null,
      solarRadiationSum: apiData.daily.shortwave_radiation_sum?.[i] ?? null,
      growingDegreeDays: gdd ? +gdd.toFixed(1) : null, frostRisk: tMin != null ? tMin < 2 : null,
    };
  });
}

/* ====== Загрузка всех прогнозов (для ручного обновления) ====== */
export async function fetchAllForecasts(loc: GeoLocation): Promise<{ forecastRows: ForecastRow[]; agroRows: AgroRow[] }> {
  const snapDate = todayStr();
  const [ecmwf, gfs, icon] = await Promise.all([fetchECMWF(loc.lat, loc.lon, 10), fetchGFS(loc.lat, loc.lon, 16), fetchICON(loc.lat, loc.lon, 7)]);
  const forecastRows: ForecastRow[] = [], agroRows: AgroRow[] = [];
  if (ecmwf.loaded) { forecastRows.push(...toForecastRows('ecmwf', 'ECMWF IFS', ecmwf.daily, loc, snapDate)); if (ecmwf.agroData) agroRows.push(...toAgroRows('ecmwf_soil', 'ECMWF IFS почва', ecmwf.agroData, loc, snapDate)); }
  if (gfs.loaded) { forecastRows.push(...toForecastRows('gfs', 'GFS', gfs.daily, loc, snapDate)); if (gfs.agroData) agroRows.push(...toAgroRows('gfs_soil', 'GFS почва', gfs.agroData, loc, snapDate)); }
  if (icon.loaded) { forecastRows.push(...toForecastRows('icon', 'ICON-EU', icon.daily, loc, snapDate)); if (icon.agroData) agroRows.push(...toAgroRows('icon_soil', 'ICON-EU почва', icon.agroData, loc, snapDate)); }
  return { forecastRows, agroRows };
}

/* ====== Почасовые данные ====== */
export async function fetchHourly(lat: number, lon: number, date: string): Promise<HourlyForecast[]> {
  try {
    const end = new Date(date + 'T00:00:00'); end.setDate(end.getDate() + 1);
    const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), start_date: date, end_date: end.toISOString().split('T')[0], hourly: HF, timezone: 'auto' });
    const r = await fetch(FC + '?' + p); if (!r.ok) return [];
    return pH(await r.json());
  } catch { return []; }
}

/* ====== Архивы ====== */
export async function fetchRecentArchive(lat: number, lon: number, days: number = 14): Promise<ArchiveDay[]> {
  try {
    const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), past_days: String(days), forecast_days: '1', models: 'ecmwf_ifs', daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max', timezone: 'auto' });
    const r = await fetch(FC + '?' + p); if (!r.ok) return [];
    const d = await r.json(); if (!d.daily?.time) return [];
    return d.daily.time.map((t: string, i: number) => ({ date: t, tempMax: d.daily.temperature_2m_max?.[i] ?? null, tempMin: d.daily.temperature_2m_min?.[i] ?? null, precipSum: d.daily.precipitation_sum?.[i] ?? null, windMax: d.daily.wind_speed_10m_max?.[i] ?? null, source: 'ecmwf_ifs' }));
  } catch { return []; }
}
export async function fetchERA5Archive(lat: number, lon: number, s: string, e: string): Promise<ArchiveDay[]> {
  try {
    const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), start_date: s, end_date: e, daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max', timezone: 'auto' });
    const r = await fetch(AR + '?' + p); if (!r.ok) return [];
    const d = await r.json(); if (!d.daily?.time) return [];
    return d.daily.time.map((t: string, i: number) => ({ date: t, tempMax: d.daily.temperature_2m_max?.[i] ?? null, tempMin: d.daily.temperature_2m_min?.[i] ?? null, precipSum: d.daily.precipitation_sum?.[i] ?? null, windMax: d.daily.wind_speed_10m_max?.[i] ?? null, source: 'era5' }));
  } catch { return []; }
}
