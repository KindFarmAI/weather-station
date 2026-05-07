import { GeoLocation, DailyForecast, HourlyForecast, ForecastRow, AgroRow, ArchiveDay, FactRow } from './types';
import { locId, todayStr, loadCitySlug, saveCitySlug } from './storage';

const NOM = 'https://nominatim.openstreetmap.org/search';
const FC  = 'https://api.open-meteo.com/v1/forecast';
const AR  = 'https://archive-api.open-meteo.com/v1/archive';
const PROXY = 'https://api.allorigins.win/raw?url=';

/* ====== Геокодинг (приоритет РФ) ====== */
export async function searchLocations(q: string): Promise<GeoLocation[]> {
  if (!q || q.length < 2) return [];
  /* Сначала поиск по РФ */
  const pRu = new URLSearchParams({ q, format: 'json', limit: '8', 'accept-language': 'ru', addressdetails: '1', countrycodes: 'ru' });
  try {
    const r = await fetch(NOM + '?' + pRu, { headers: { 'User-Agent': 'AgroPogoda/1.0' } });
    if (r.ok) {
      const data = await r.json();
      if (data.length > 0) return data.map((x: any) => ({ name: x.name || x.display_name.split(',')[0], lat: +x.lat, lon: +x.lon, country: x.address?.country, admin1: x.address?.state || x.address?.region, displayName: x.display_name }));
    }
  } catch {}
  /* Фолбэк — все страны */
  const pAll = new URLSearchParams({ q, format: 'json', limit: '8', 'accept-language': 'ru,en', addressdetails: '1' });
  const r = await fetch(NOM + '?' + pAll, { headers: { 'User-Agent': 'AgroPogoda/1.0' } });
  if (!r.ok) return [];
  return (await r.json()).map((x: any) => ({ name: x.name || x.display_name.split(',')[0], lat: +x.lat, lon: +x.lon, country: x.address?.country, admin1: x.address?.state || x.address?.region, displayName: x.display_name }));
}

/* ====== Списки параметров ====== */
const DF = 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,relative_humidity_2m_max,relative_humidity_2m_min,surface_pressure_max,surface_pressure_min,uv_index_max,et0_fao_evapotranspiration,weather_code,sunrise,sunset';
const HF = 'temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,relative_humidity_2m,surface_pressure,weather_code,cloud_cover,visibility,wind_gusts_10m,is_day';
const SOIL_DAILY = 'soil_temperature_6cm,soil_temperature_18cm,soil_temperature_54cm,et0_fao_evapotranspiration,dew_point_2m_max,vapor_pressure_deficit_max,shortwave_radiation_sum';
const SOIL_HOURLY = 'soil_moisture_0_7cm,soil_moisture_28_100cm';

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
    const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), forecast_days: String(days), models: 'ecmwf_ifs', daily: DF + ',' + SOIL_DAILY, hourly: HF + ',' + SOIL_HOURLY, timezone: 'auto' });
    const r = await fetch(FC + '?' + p); if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    return { id: 'ecmwf', name: 'ECMWF IFS', model: 'ecmwf_ifs', daily: pD(d), hourly: pH(d), loaded: true, error: null, loading: false, agroData: d };
  } catch (e: any) { return mkErr('ecmwf', 'ECMWF IFS', 'ecmwf_ifs', e.message); }
}
export async function fetchGFS(lat: number, lon: number, days: number = 16): Promise<any> {
  try {
    const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), forecast_days: String(days), models: 'gfs_seamless', daily: DF + ',' + SOIL_DAILY, hourly: HF + ',' + SOIL_HOURLY, timezone: 'auto' });
    const r = await fetch(FC + '?' + p); if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    return { id: 'gfs', name: 'GFS', model: 'gfs_seamless', daily: pD(d), hourly: pH(d), loaded: true, error: null, loading: false, agroData: d };
  } catch (e: any) { return mkErr('gfs', 'GFS', 'gfs_seamless', e.message); }
}
export async function fetchICON(lat: number, lon: number, days: number = 7): Promise<any> {
  try {
    const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), forecast_days: String(days), models: 'icon_eu', daily: DF + ',' + SOIL_DAILY, hourly: HF + ',' + SOIL_HOURLY, timezone: 'auto' });
    const r = await fetch(FC + '?' + p); if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    return { id: 'icon', name: 'ICON-EU', model: 'icon_eu', daily: pD(d), hourly: pH(d), loaded: true, error: null, loading: false, agroData: d };
  } catch (e: any) { return mkErr('icon', 'ICON-EU', 'icon_eu', e.message); }
}
export async function fetchAROME(lat: number, lon: number): Promise<any> {
  try {
    const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), forecast_days: '2', models: 'arome_france_hd', daily: DF, hourly: HF, timezone: 'auto' });
    const r = await fetch(FC + '?' + p); if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    return { id: 'arome', name: 'AROME', model: 'arome_france_hd', daily: pD(d), hourly: pH(d), loaded: true, error: null, loading: false, agroData: null };
  } catch (e: any) { return mkErr('arome', 'AROME', 'arome_france_hd', e.message); }
}

/* ====== Яндекс Погода (основной прогноз) ====== */
export async function fetchYandex(slug: string): Promise<any> {
  const base: any = { id: 'yandex', name: 'Яндекс', model: 'yandex', daily: [], hourly: [], loaded: false, error: null, loading: true, agroData: null };
  try {
    const url = 'https://yandex.ru/pogoda/' + encodeURIComponent(slug) + '/details?via=mstack';
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(PROXY + encodeURIComponent(url), { signal: ctrl.signal }); clearTimeout(t);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const html = await r.text();
    if (!html || html.length < 500) throw new Error('Пустой ответ');
    const days = parseYaMain(html);
    return { ...base, daily: days, loaded: days.length > 0, error: days.length === 0 ? 'Парсинг' : '', loading: false };
  } catch (e: any) { return { ...base, error: e.name === 'AbortError' ? 'Таймаут' : e.message, loading: false }; }
}
function parseYaMain(html: string): DailyForecast[] {
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
      tempMax: ts.length ? +ts[0][1] : null, tempMin: ts.length > 1 ? +ts[ts.length - 1][1] : ts.length ? +ts[0][1] : null,
      precipSum: pm ? +pm[1].replace(',', '.') : 0, windMax: null, windDir: null,
      humidityMax: null, humidityMin: null, pressureMax: null, pressureMin: null,
      uvIndexMax: null, precipProb: null, sunrise: null, sunset: null, weatherCode: null, windGusts: null, et0: null,
    });
  }
  return out;
}

/* ====== Яндекс Сад и Огород (агро-данные) ====== */
export async function fetchYandexGarden(slug: string): Promise<AgroRow[]> {
  try {
    const url = 'https://yandex.ru/pogoda/ru/' + encodeURIComponent(slug) + '/details/gardening';
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(PROXY + encodeURIComponent(url), { signal: ctrl.signal }); clearTimeout(t);
    if (!r.ok) return [];
    const html = await r.text();
    return parseYaGarden(html);
  } catch { return []; }
}
function parseYaGarden(html: string): AgroRow[] {
  const rows: AgroRow[] = [];
  const mm: any = { 'января':'01','февраля':'02','марта':'03','апреля':'04','мая':'05','июня':'06','июля':'07','августа':'08','сентября':'09','октября':'10','ноября':'11','декабря':'12' };
  const yr = new Date().getFullYear();
  const snapDate = todayStr();

  /* Извлекаем данные из таблицы Сад и Огород */
  /* Yandex рендерит через JS, поэтому парсинг HTML может быть неполным */
  /* Ищем паттерны: температуру почвы, влажность, заморозки */
  const blocks = html.split(/class="[^"]*(?:card|row|item|day|gardening)[^"]*"/i);
  for (const b of blocks) {
    const dm = b.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i);
    if (!dm) continue;
    const mo = mm[dm[2].toLowerCase()] || '01';
    const date = yr + '-' + mo + '-' + dm[1].padStart(2, '0');
    const daysBefore = Math.round((new Date(date + 'T12:00:00').getTime() - new Date(snapDate + 'T12:00:00').getTime()) / 86400000);
    const soilTemp = b.match(/(\d+)\s*°/)?.[1];
    const frostMatch = b.match(/заморозк/i);
    rows.push({
      id: `_yandex_garden_${date}_${snapDate}`,
      targetDate: date, sourceId: 'yandex_garden', sourceName: 'Яндекс Сад/Огород',
      snapshotDate: snapDate, daysBefore, locationId: '',
      soilTemp6cm: soilTemp ? +soilTemp : null, soilTemp18cm: null, soilTemp54cm: null,
      soilMoisture07: null, soilMoisture28100: null, et0Sum: null,
      dewPointMax: null, vaporPressureDefMax: null, solarRadiationSum: null,
      growingDegreeDays: null, frostRisk: !!frostMatch,
    });
  }
  return rows;
}

/* ====== yr.no ====== */
export async function fetchYrNo(lat: number, lon: number): Promise<any> {
  try {
    /* yr.no legacy endpoint */
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'AgroPogoda/1.0' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const days: DailyForecast[] = [];
    const dayMap: Record<string, { maxT: number; minT: number; precip: number; windMax: number; code: number }> = {};
    for (const ts of d.properties?.timeseries || []) {
      const date = ts.time.split('T')[0];
      if (!dayMap[date]) dayMap[date] = { maxT: -999, minT: 999, precip: 0, windMax: 0, code: 0 };
      const dm = dayMap[date];
      const data = ts.data?.instant?.details;
      if (data) {
        if (data.air_temperature != null) { dm.maxT = Math.max(dm.maxT, data.air_temperature); dm.minT = Math.min(dm.minT, data.air_temperature); }
        if (data.wind_speed != null) dm.windMax = Math.max(dm.windMax, data.wind_speed);
      }
      const p1h = ts.data?.next_1_hours?.details?.precipitation_amount;
      if (p1h != null) dm.precip += p1h;
      const p6h = ts.data?.next_6_hours?.details?.precipitation_amount;
      if (p6h != null) dm.precip += p6h;
      const sym = ts.data?.next_1_hours?.summary?.symbol_code;
      if (sym) dm.code = parseYrCode(sym);
    }
    for (const [date, dm] of Object.entries(dayMap)) {
      days.push({ date, tempMax: dm.maxT > -900 ? dm.maxT : null, tempMin: dm.minT < 900 ? dm.minT : null, precipSum: dm.precip || null, windMax: dm.windMax || null, windDir: null, humidityMax: null, humidityMin: null, pressureMax: null, pressureMin: null, uvIndexMax: null, precipProb: null, sunrise: null, sunset: null, weatherCode: dm.code || null, windGusts: null, et0: null });
    }
    return { id: 'yrno', name: 'yr.no', model: 'yrno', daily: days, hourly: [], loaded: days.length > 0, error: days.length === 0 ? 'Пустой ответ' : null, loading: false, agroData: null };
  } catch (e: any) { return mkErr('yrno', 'yr.no', 'yrno', e.message); }
}
function parseYrCode(code: string): number {
  if (!code) return 0;
  if (code.startsWith('clearsky')) return 0;
  if (code.startsWith('fair')) return 1;
  if (code.startsWith('partlycloudy')) return 2;
  if (code.startsWith('cloudy')) return 3;
  if (code.includes('fog')) return 45;
  if (code.includes('rain') && code.includes('thunder')) return 95;
  if (code.includes('rain')) return code.includes('heavy') ? 65 : code.includes('light') ? 61 : 63;
  if (code.includes('snow') && code.includes('thunder')) return 95;
  if (code.includes('snow')) return code.includes('heavy') ? 75 : code.includes('light') ? 71 : 73;
  if (code.includes('drizzle')) return 53;
  return 3;
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

/* ====== DATA-FIRST: DailyForecast → ForecastRow[] ====== */
export function toForecastRows(sourceId: string, sourceName: string, dailyForecasts: DailyForecast[], loc: GeoLocation, snapshotDate: string): ForecastRow[] {
  const lid = locId(loc);
  return dailyForecasts.map(d => {
    const targetDate = d.date;
    const daysBefore = Math.round((new Date(targetDate + 'T12:00:00').getTime() - new Date(snapshotDate + 'T12:00:00').getTime()) / 86400000);
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

/* ====== DATA-FIRST: Open-Meteo response → AgroRow[] ====== */
export function toAgroRows(sourceId: string, sourceName: string, apiData: any, loc: GeoLocation, snapshotDate: string): AgroRow[] {
  if (!apiData?.daily?.time) return [];
  const lid = locId(loc);
  /* Вычисляем среднюю влажность почвы за день из почасовых данных */
  const hourlyMoisture07: Record<string, number[]> = {};
  const hourlyMoisture28: Record<string, number[]> = {};
  if (apiData.hourly?.time) {
    const times = apiData.hourly.time as string[];
    const m07 = apiData.hourly.soil_moisture_0_7cm as number[] | undefined;
    const m28 = apiData.hourly.soil_moisture_28_100cm as number[] | undefined;
    for (let i = 0; i < times.length; i++) {
      const date = times[i].split('T')[0];
      if (!hourlyMoisture07[date]) hourlyMoisture07[date] = [];
      if (!hourlyMoisture28[date]) hourlyMoisture28[date] = [];
      if (m07?.[i] != null) hourlyMoisture07[date].push(m07[i]);
      if (m28?.[i] != null) hourlyMoisture28[date].push(m28[i]);
    }
  }
  return apiData.daily.time.map((date: string, i: number) => {
    const daysBefore = Math.round((new Date(date + 'T12:00:00').getTime() - new Date(snapshotDate + 'T12:00:00').getTime()) / 86400000);
    const tMax = apiData.daily.temperature_2m_max?.[i] ?? null;
    const tMin = apiData.daily.temperature_2m_min?.[i] ?? null;
    const avg07 = hourlyMoisture07[date]?.length ? hourlyMoisture07[date].reduce((a, b) => a + b, 0) / hourlyMoisture07[date].length : null;
    const avg28 = hourlyMoisture28[date]?.length ? hourlyMoisture28[date].reduce((a, b) => a + b, 0) / hourlyMoisture28[date].length : null;
    const gdd = tMax != null && tMin != null ? Math.max(0, ((tMax + tMin) / 2) - 10) : null;
    return {
      id: `${lid}_${sourceId}_${date}_${snapshotDate}`,
      targetDate: date, sourceId, sourceName, snapshotDate, daysBefore, locationId: lid,
      soilTemp6cm: apiData.daily.soil_temperature_6cm?.[i] ?? null,
      soilTemp18cm: apiData.daily.soil_temperature_18cm?.[i] ?? null,
      soilTemp54cm: apiData.daily.soil_temperature_54cm?.[i] ?? null,
      soilMoisture07: avg07, soilMoisture28100: avg28,
      et0Sum: apiData.daily.et0_fao_evapotranspiration?.[i] ?? null,
      dewPointMax: apiData.daily.dew_point_2m_max?.[i] ?? null,
      vaporPressureDefMax: apiData.daily.vapor_pressure_deficit_max?.[i] ?? null,
      solarRadiationSum: apiData.daily.shortwave_radiation_sum?.[i] ?? null,
      growingDegreeDays: gdd, frostRisk: tMin != null ? tMin < 2 : null,
    };
  });
}

/* ====== Загрузка всего (data-first) ====== */
export async function fetchAllForecasts(loc: GeoLocation): Promise<{ forecastRows: ForecastRow[]; agroRows: AgroRow[] }> {
  const snapDate = todayStr();
  const [ecmwf, gfs, icon] = await Promise.all([
    fetchECMWF(loc.lat, loc.lon, 10),
    fetchGFS(loc.lat, loc.lon, 16),
    fetchICON(loc.lat, loc.lon, 7),
  ]);
  const forecastRows: ForecastRow[] = [];
  const agroRows: AgroRow[] = [];

  if (ecmwf.loaded) {
    forecastRows.push(...toForecastRows('ecmwf', 'ECMWF IFS', ecmwf.daily, loc, snapDate));
    if (ecmwf.agroData) agroRows.push(...toAgroRows('ecmwf_soil', 'ECMWF IFS почва', ecmwf.agroData, loc, snapDate));
  }
  if (gfs.loaded) {
    forecastRows.push(...toForecastRows('gfs', 'GFS', gfs.daily, loc, snapDate));
    if (gfs.agroData) agroRows.push(...toAgroRows('gfs_soil', 'GFS почва', gfs.agroData, loc, snapDate));
  }
  if (icon.loaded) {
    forecastRows.push(...toForecastRows('icon', 'ICON-EU', icon.daily, loc, snapDate));
    if (icon.agroData) agroRows.push(...toAgroRows('icon_soil', 'ICON-EU почва', icon.agroData, loc, snapDate));
  }

  /* Яндекс */
  try {
    const slug = loadCitySlug() || loc.name.toLowerCase().replace(/\s+/g, '-');
    saveCitySlug(slug);
    const [ya, yaGarden] = await Promise.all([fetchYandex(slug), fetchYandexGarden(slug)]);
    if (ya.loaded && ya.daily.length > 0) forecastRows.push(...toForecastRows('yandex', 'Яндекс', ya.daily, loc, snapDate));
    if (yaGarden.length > 0) {
      const lid = locId(loc);
      for (const r of yaGarden) r.locationId = lid;
      agroRows.push(...yaGarden);
    }
  } catch {}

  /* yr.no */
  try {
    const yr = await fetchYrNo(loc.lat, loc.lon);
    if (yr.loaded && yr.daily.length > 0) forecastRows.push(...toForecastRows('yrno', 'yr.no', yr.daily, loc, snapDate));
  } catch {}

  return { forecastRows, agroRows };
}

/* ====== Почасовые данные (на demanda) ====== */
export async function fetchHourly(lat: number, lon: number, date: string): Promise<HourlyForecast[]> {
  try {
    const end = new Date(date + 'T00:00:00'); end.setDate(end.getDate() + 1);
    const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), start_date: date, end_date: end.toISOString().split('T')[0], hourly: HF, timezone: 'auto' });
    const r = await fetch(FC + '?' + p); if (!r.ok) return [];
    return pH(await r.json());
  } catch { return []; }
}

/* ====== Фактические данные ====== */
export async function fetchFacts(loc: GeoLocation, days: number = 60): Promise<FactRow[]> {
  const lid = locId(loc);
  try {
    const p = new URLSearchParams({ latitude: String(loc.lat), longitude: String(loc.lon), past_days: String(days), forecast_days: '1', models: 'ecmwf_ifs', daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max', timezone: 'auto' });
    const r = await fetch(FC + '?' + p); if (!r.ok) return [];
    const d = await r.json(); if (!d.daily?.time) return [];
    return d.daily.time.map((t: string, i: number) => ({
      id: `${lid}_fact_${t}`, date: t, locationId: lid, source: 'ecmwf_ifs',
      tempMax: d.daily.temperature_2m_max?.[i] ?? null, tempMin: d.daily.temperature_2m_min?.[i] ?? null,
      precipSum: d.daily.precipitation_sum?.[i] ?? null, windMax: d.daily.wind_speed_10m_max?.[i] ?? null,
    }));
  } catch { return []; }
}
