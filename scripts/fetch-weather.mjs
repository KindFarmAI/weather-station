#!/usr/bin/env node
/**
 * fetch-weather.mjs — Загружает прогнозы из Open-Meteo и сохраняет в data/
 * GitHub Actions: cron 06:00 + 18:00 MSK
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const args = process.argv.slice(2);
let LAT = 44.7844, LON = 40.1169, CITY = 'Белореченск';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--lat') LAT = +args[++i];
  else if (args[i] === '--lon') LON = +args[++i];
  else if (args[i] === '--city') CITY = args[++i];
}

const FC = 'https://api.open-meteo.com/v1/forecast';
const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,relative_humidity_2m_max,relative_humidity_2m_min,surface_pressure_max,surface_pressure_min,uv_index_max,et0_fao_evapotranspiration,weather_code,sunrise,sunset,dew_point_2m_max,vapor_pressure_deficit_max,shortwave_radiation_sum';
const HOURLY = 'temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,relative_humidity_2m,surface_pressure,weather_code,cloud_cover,visibility,wind_gusts_10m,is_day,soil_moisture_0_to_7cm,soil_moisture_28_to_100cm,soil_temperature_0_to_7cm,soil_temperature_7_to_28cm,soil_temperature_28_to_100cm';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
}

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function parseDaily(d) {
  if (!d.daily?.time) return [];
  return d.daily.time.map((t, i) => ({
    date: t,
    tempMax: d.daily.temperature_2m_max?.[i] ?? null,
    tempMin: d.daily.temperature_2m_min?.[i] ?? null,
    precipSum: d.daily.precipitation_sum?.[i] ?? null,
    precipProb: d.daily.precipitation_probability_max?.[i] ?? null,
    windMax: d.daily.wind_speed_10m_max?.[i] ?? null,
    windGusts: d.daily.wind_gusts_10m_max?.[i] ?? null,
    humidityMax: d.daily.relative_humidity_2m_max?.[i] ?? null,
    humidityMin: d.daily.relative_humidity_2m_min?.[i] ?? null,
    pressureMax: d.daily.surface_pressure_max?.[i] ?? null,
    pressureMin: d.daily.surface_pressure_min?.[i] ?? null,
    uvIndexMax: d.daily.uv_index_max?.[i] ?? null,
    weatherCode: d.daily.weather_code?.[i] ?? null,
    et0: d.daily.et0_fao_evapotranspiration?.[i] ?? null,
    sunrise: d.daily.sunrise?.[i] ?? null,
    sunset: d.daily.sunset?.[i] ?? null,
  }));
}

function toForecastRows(sourceId, sourceName, dailyForecasts, locId, snapshotDate) {
  return dailyForecasts.map(d => {
    const daysBefore = Math.round((new Date(d.date + 'T12:00:00').getTime() - new Date(snapshotDate + 'T12:00:00').getTime()) / 86400000);
    return {
      id: `${locId}_${sourceId}_${d.date}_${snapshotDate}`,
      targetDate: d.date, sourceId, sourceName, snapshotDate, daysBefore, locationId: locId,
      tempMax: d.tempMax, tempMin: d.tempMin, precipSum: d.precipSum, precipProb: d.precipProb,
      windMax: d.windMax, windGusts: d.windGusts, humidityMax: d.humidityMax, humidityMin: d.humidityMin,
      pressureMax: d.pressureMax, pressureMin: d.pressureMin, uvIndexMax: d.uvIndexMax,
      weatherCode: d.weatherCode, et0: d.et0,
    };
  });
}

function toAgroRows(sourceId, sourceName, apiData, locId, snapshotDate) {
  if (!apiData?.daily?.time) return [];
  const hm07 = {}, hm28 = {}, ht07 = {}, ht18 = {}, ht54 = {};
  if (apiData.hourly?.time) {
    for (let i = 0; i < apiData.hourly.time.length; i++) {
      const date = apiData.hourly.time[i].split('T')[0];
      const init = (obj, key, val) => { if (!obj[date]) obj[date] = []; if (val != null) obj[date].push(val); };
      init(hm07, date, apiData.hourly.soil_moisture_0_to_7cm?.[i]);
      init(hm28, date, apiData.hourly.soil_moisture_28_to_100cm?.[i]);
      init(ht07, date, apiData.hourly.soil_temperature_0_to_7cm?.[i]);
      init(ht18, date, apiData.hourly.soil_temperature_7_to_28cm?.[i]);
      init(ht54, date, apiData.hourly.soil_temperature_28_to_100cm?.[i]);
    }
  }
  const avg = (arr) => arr?.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return apiData.daily.time.map((date, i) => {
    const daysBefore = Math.round((new Date(date + 'T12:00:00').getTime() - new Date(snapshotDate + 'T12:00:00').getTime()) / 86400000);
    const tMax = apiData.daily.temperature_2m_max?.[i] ?? null;
    const tMin = apiData.daily.temperature_2m_min?.[i] ?? null;
    const gdd = tMax != null && tMin != null ? Math.max(0, ((tMax + tMin) / 2) - 10) : null;
    return {
      id: `${locId}_${sourceId}_${date}_${snapshotDate}`,
      targetDate: date, sourceId, sourceName, snapshotDate, daysBefore, locationId: locId,
      soilTemp6cm: avg(ht07[date]) ? +avg(ht07[date]).toFixed(1) : null,
      soilTemp18cm: avg(ht18[date]) ? +avg(ht18[date]).toFixed(1) : null,
      soilTemp54cm: avg(ht54[date]) ? +avg(ht54[date]).toFixed(1) : null,
      soilMoisture07: avg(hm07[date]) ? +avg(hm07[date]).toFixed(3) : null,
      soilMoisture28100: avg(hm28[date]) ? +avg(hm28[date]).toFixed(3) : null,
      et0Sum: apiData.daily.et0_fao_evapotranspiration?.[i] ?? null,
      dewPointMax: apiData.daily.dew_point_2m_max?.[i] ?? null,
      vaporPressureDefMax: apiData.daily.vapor_pressure_deficit_max?.[i] ?? null,
      solarRadiationSum: apiData.daily.shortwave_radiation_sum?.[i] ?? null,
      growingDegreeDays: gdd ? +gdd.toFixed(1) : null,
      frostRisk: tMin != null ? tMin < 2 : null,
    };
  });
}

async function main() {
  const locId = `${LAT.toFixed(2)}_${LON.toFixed(2)}`;
  const snapDate = todayStr();
  const ts = timestamp();
  console.log(`[${ts}] Загрузка прогнозов для ${CITY} (${LAT}, ${LON})...`);

  const existing = findTodaySnapshot(locId, snapDate);
  if (existing) { console.log(`Уже существует: ${existing}. Пропускаем.`); return; }

  const forecastRows = [], agroRows = [], errors = [];
  const models = [
    { id: 'ecmwf', name: 'ECMWF IFS', model: 'ecmwf_ifs', days: 10 },
    { id: 'gfs', name: 'GFS', model: 'gfs_seamless', days: 16 },
    { id: 'icon', name: 'ICON-EU', model: 'icon_eu', days: 7 },
  ];

  const results = await Promise.allSettled(models.map(async (m) => {
    try {
      const url = `${FC}?latitude=${LAT}&longitude=${LON}&forecast_days=${m.days}&models=${m.model}&daily=${DAILY}&hourly=${HOURLY}&timezone=auto`;
      const data = await fetchJSON(url);
      const daily = parseDaily(data);
      console.log(`  ${m.name}: ${daily.length} дней`);
      return { ...m, data, daily, success: true };
    } catch (e) {
      console.error(`  ${m.name}: ОШИБКА — ${e.message}`);
      return { ...m, success: false, error: e.message };
    }
  }));

  for (const r of results) {
    if (!r.value?.success) { errors.push(`${r.value?.name}: ${r.value?.error}`); continue; }
    const v = r.value;
    forecastRows.push(...toForecastRows(v.id, v.name, v.daily, locId, snapDate));
    agroRows.push(...toAgroRows(v.id + '_soil', v.name + ' почва', v.data, locId, snapDate));
  }

  if (forecastRows.length === 0) { console.error('Нет данных. Выход.'); process.exit(1); }

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const snapshot = {
    id: `${locId}_${snapDate}_${ts.replace(/-/g, '')}`,
    location: { name: CITY, lat: LAT, lon: LON, locationId: locId },
    snapshotDate: snapDate,
    fetchedAt: new Date().toISOString(),
    forecastRows, agroRows,
    sourceCount: new Set(forecastRows.map(r => r.sourceId)).size,
    dayCount: new Set(forecastRows.map(r => r.targetDate)).size,
    errors,
  };

  const filename = `${snapDate}-${ts.split('-').slice(1).join('')}.json`;
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`Сохранён: data/${filename}`);

  writeFileSync(join(DATA_DIR, 'latest.json'), JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log('Обновлён: data/latest.json');

  updateManifest(locId, filename, snapshot);
  console.log('Обновлён: data/manifest.json');

  console.log(`\nИтого: ${forecastRows.length} прогнозов, ${agroRows.length} агро, ${snapshot.sourceCount} источников`);
}

function findTodaySnapshot(locId, snapDate) {
  if (!existsSync(join(DATA_DIR, 'manifest.json'))) return null;
  try {
    const m = JSON.parse(readFileSync(join(DATA_DIR, 'manifest.json'), 'utf-8'));
    return m.snapshots?.find(s => s.locationId === locId && s.snapshotDate === snapDate)?.file || null;
  } catch { return null; }
}

function updateManifest(locId, filename, snapshot) {
  const mp = join(DATA_DIR, 'manifest.json');
  let manifest = { snapshots: [], location: snapshot.location };
  if (existsSync(mp)) { try { manifest = JSON.parse(readFileSync(mp, 'utf-8')); } catch {} }
  manifest.location = snapshot.location;
  manifest.snapshots = manifest.snapshots.filter(s => !(s.locationId === locId && s.snapshotDate === snapshot.snapshotDate));
  manifest.snapshots.push({
    file: filename, snapshotDate: snapshot.snapshotDate, fetchedAt: snapshot.fetchedAt,
    sourceCount: snapshot.sourceCount, dayCount: snapshot.dayCount,
    forecastCount: snapshot.forecastRows.length, agroCount: snapshot.agroRows.length,
    locationId: locId, errors: snapshot.errors,
  });
  manifest.snapshots.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  manifest.snapshots = manifest.snapshots.filter(s => s.snapshotDate >= cutoffStr);
  writeFileSync(mp, JSON.stringify(manifest, null, 2), 'utf-8');
}

main().catch(e => { console.error(e); process.exit(1); });
