/* ====== Геолокация ====== */
export interface GeoLocation {
  name: string; lat: number; lon: number;
  country?: string; admin1?: string; displayName: string;
}

/* ====== Неизменяемая строка прогноза (data-first) ====== */
export interface ForecastRow {
  id: string;               // locationId_sourceId_targetDate_snapshotDate
  targetDate: string;
  sourceId: string;
  sourceName: string;
  snapshotDate: string;
  daysBefore: number;
  locationId: string;
  tempMax: number|null; tempMin: number|null;
  precipSum: number|null; precipProb: number|null;
  windMax: number|null; windGusts: number|null;
  humidityMax: number|null; humidityMin: number|null;
  pressureMax: number|null; pressureMin: number|null;
  uvIndexMax: number|null;
  weatherCode: number|null; et0: number|null;
}

/* ====== Агро-данные ====== */
export interface AgroRow {
  id: string;
  targetDate: string;
  sourceId: string;   // 'openmeteo_soil' | 'yandex_garden'
  sourceName: string;
  snapshotDate: string;
  daysBefore: number;
  locationId: string;
  soilTemp6cm: number|null;
  soilTemp18cm: number|null;
  soilTemp54cm: number|null;
  soilMoisture07: number|null;   // 0-7 cm m3/m3
  soilMoisture28100: number|null; // 28-100 cm
  et0Sum: number|null;           // mm/day
  dewPointMax: number|null;
  vaporPressureDefMax: number|null;
  solarRadiationSum: number|null; // MJ/m2/day
  growingDegreeDays: number|null; // base 10°C
  frostRisk: boolean|null;
}

/* ====== Почасовые данные (на demanda) ====== */
export interface HourlyForecast {
  time: string; temp: number|null; precip: number|null; windSpeed: number|null;
  windDir: number|null; humidity: number|null; pressure: number|null;
  weatherCode: number|null; cloudCover: number|null; visibility: number|null;
  windGusts: number|null; isDay: number|null;
}

/* ====== Прогноз-источник (для загрузки) ====== */
export interface ForecastSource {
  id: string; name: string; model: string;
  daily: DailyForecast[]; hourly: HourlyForecast[];
  loaded: boolean; error: string|null; loading: boolean;
}

export interface DailyForecast {
  date: string; tempMax: number|null; tempMin: number|null; precipSum: number|null;
  windMax: number|null; windDir: number|null; humidityMax: number|null; humidityMin: number|null;
  pressureMax: number|null; pressureMin: number|null; uvIndexMax: number|null; precipProb: number|null;
  sunrise: string|null; sunset: string|null; weatherCode: number|null; windGusts: number|null; et0: number|null;
}

/* ====== Фактические данные ====== */
export interface FactRow {
  id: string; date: string; locationId: string; source: string;
  tempMax: number|null; tempMin: number|null; precipSum: number|null; windMax: number|null;
}

export interface ArchiveDay {
  date: string; tempMax: number|null; tempMin: number|null;
  precipSum: number|null; windMax: number|null; source: string;
}

/* ====== Пользовательские наблюдения ====== */
export interface UserObservation {
  id: string; date: string; temp: string; humidity: string;
  precip: string; wind: string; notes: string; createdAt: string;
}

/* ====== Параметры погоды ====== */
export interface WeatherParam {
  id: string; label: string; unit: string; icon: string; category: string;
  rowKey: keyof ForecastRow;
}

export const WEATHER_PARAMS: WeatherParam[] = [
  { id:'tempMax',      label:'Т макс',     unit:'°C',   icon:'🌡', category:'temperature',   rowKey:'tempMax' },
  { id:'tempMin',      label:'Т мин',      unit:'°C',   icon:'🌡', category:'temperature',   rowKey:'tempMin' },
  { id:'precipSum',    label:'Осадки',     unit:'мм',   icon:'🌧', category:'precipitation', rowKey:'precipSum' },
  { id:'precipProb',   label:'Вер.осадк.',  unit:'%',    icon:'☔', category:'precipitation', rowKey:'precipProb' },
  { id:'windMax',      label:'Ветер макс', unit:'км/ч', icon:'💨', category:'wind',          rowKey:'windMax' },
  { id:'windGusts',    label:'Порывы',     unit:'км/ч', icon:'🌪', category:'wind',          rowKey:'windGusts' },
  { id:'humidityMax',  label:'Влажн.макс', unit:'%',    icon:'💧', category:'other',         rowKey:'humidityMax' },
  { id:'humidityMin',  label:'Влажн.мин',  unit:'%',    icon:'💧', category:'other',         rowKey:'humidityMin' },
  { id:'pressureMax',  label:'Давл.макс',  unit:'гПа',  icon:'📊', category:'other',         rowKey:'pressureMax' },
  { id:'pressureMin',  label:'Давл.мин',   unit:'гПа',  icon:'📊', category:'other',         rowKey:'pressureMin' },
  { id:'uvIndexMax',   label:'УФ-индекс',  unit:'',     icon:'☀',  category:'other',         rowKey:'uvIndexMax' },
  { id:'et0',          label:'ЭТ0',        unit:'мм',   icon:'🌱', category:'other',         rowKey:'et0' },
];

export const AGRO_PARAMS = [
  { id:'soilTemp6cm',         label:'Т почвы 6см',    unit:'°C',   icon:'🌡',  key:'soilTemp6cm' as const },
  { id:'soilTemp18cm',        label:'Т почвы 18см',   unit:'°C',   icon:'🌡',  key:'soilTemp18cm' as const },
  { id:'soilTemp54cm',        label:'Т почвы 54см',   unit:'°C',   icon:'🌡',  key:'soilTemp54cm' as const },
  { id:'soilMoisture07',      label:'Влажн. почвы',   unit:'m³/m³',icon:'💧', key:'soilMoisture07' as const },
  { id:'et0Sum',              label:'ЭТ₀ суммар.',    unit:'мм/д', icon:'🌱',  key:'et0Sum' as const },
  { id:'dewPointMax',         label:'Точка росы макс',unit:'°C',   icon:'💧',  key:'dewPointMax' as const },
  { id:'solarRadiationSum',   label:'Солн. радиация', unit:'МДж/м²',icon:'☀',  key:'solarRadiationSum' as const },
  { id:'vaporPressureDefMax', label:'Дефицит ВПД',    unit:'кПа',  icon:'📊',  key:'vaporPressureDefMax' as const },
  { id:'growingDegreeDays',   label:'GDD (≥10°C)',    unit:'°C·д', icon:'🌱',  key:'growingDegreeDays' as const },
];

export const DEFAULT_PARAMS = ['tempMax','tempMin','precipSum','precipProb','windMax','humidityMax'];

/* ====== Погодные коды ====== */
const WM: Record<number,string> = {
  0:'Ясно',1:'Преим. ясно',2:'Перем.облачн.',3:'Пасмурно',45:'Туман',48:'Изморозь',
  51:'Морось сл.',53:'Морось',55:'Морось сил.',61:'Дождь сл.',63:'Дождь',65:'Дождь сил.',
  71:'Снег сл.',73:'Снег',75:'Снег сил.',77:'Крупа',80:'Ливень сл.',81:'Ливень',82:'Ливень сил.',
  85:'Снегопад сл.',86:'Снегопад сил.',95:'Гроза',96:'Гроза+град',99:'Гроза+град сил.'
};
export function getWeatherDesc(c: number|null): string { return c==null ? '' : (WM[c]||'Код '+c); }
export function getWeatherEmoji(c: number|null): string {
  if(c==null) return ''; if(c===0) return '☀️'; if(c<=2) return '⛅'; if(c===3) return '☁️';
  if(c<=48) return '🌫'; if(c<=67) return '🌧'; if(c<=77) return '❄️'; if(c<=82) return '🌧'; if(c<=86) return '🌨'; return '⛈';
}

/* ====== Источники прогноза ====== */
export interface ForecastSourceInfo {
  id: string; name: string; type: 'model' | 'service';
  resolution: string; maxDays: number; free: boolean; needKey: boolean;
  hasHourly: boolean; hasAgro: boolean; hasArchive: boolean;
  coverage: string; color: string; bg: string;
  note: string;
}

export const FORECAST_SOURCES: ForecastSourceInfo[] = [
  { id:'ecmwf',    name:'ECMWF IFS',          type:'model',   resolution:'9 км',   maxDays:10, free:true,  needKey:false, hasHourly:true,  hasAgro:true,  hasArchive:true,  coverage:'Глобальный',         color:'text-green-700',  bg:'bg-green-600',    note:'Лучшая глобальная модель. Осадки ~2x точнее ERA5.' },
  { id:'gfs',      name:'GFS (США)',           type:'model',   resolution:'25 км',  maxDays:16, free:true,  needKey:false, hasHourly:true,  hasAgro:true,  hasArchive:false, coverage:'Глобальный',         color:'text-blue-700',   bg:'bg-blue-600',     note:'Основная модель США. 16 дней. Хороша на дальний срок.' },
  { id:'icon',     name:'ICON-EU (DWD)',       type:'model',   resolution:'6 км',   maxDays:7,  free:true,  needKey:false, hasHourly:true,  hasAgro:true,  hasArchive:false, coverage:'Европа + РФ',       color:'text-purple-700', bg:'bg-purple-600',  note:'Немецкая модель. Высочайшее разрешение для Европы/РФ.' },
  { id:'arome',    name:'AROME (Франция)',     type:'model',   resolution:'1.3 км', maxDays:2,  free:true,  needKey:false, hasHourly:true,  hasAgro:false, hasArchive:false, coverage:'Европа (запад)',    color:'text-orange-700', bg:'bg-orange-600',  note:'Сверхвысокое разрешение, но только 2 дня и Европа.' },
  { id:'yandex',   name:'Яндекс Погода',       type:'service', resolution:'~5 км',  maxDays:10, free:true,  needKey:false, hasHourly:false, hasAgro:true,  hasArchive:false, coverage:'Россия + СНГ',      color:'text-yellow-700', bg:'bg-yellow-500',  note:'Лучше для РФ микроклимата. Сад/Огород. Парсинг через прокси.' },
  { id:'yrno',     name:'yr.no (Норвегия)',    type:'service', resolution:'3 км',   maxDays:9,  free:true,  needKey:false, hasHourly:true,  hasAgro:false, hasArchive:false, coverage:'Глобальный',         color:'text-teal-700',   bg:'bg-teal-600',     note:'Норвежский метео-институт. Стабильный бесплатный API.' },
];

/* ====== Источники фактических данных ====== */
export interface FactSourceInfo {
  id: string; name: string; type: 'station' | 'reanalysis' | 'model_analysis';
  resolution: string; archiveStart: string; hourly: boolean;
  precipAccuracy: 'excellent' | 'good' | 'biased';
  russiaCoverage: string; note: string;
}

export const FACT_SOURCES: FactSourceInfo[] = [
  { id:'station_37013', name:'Белореченск (Родники, WMO 37013)', type:'station',       resolution:'Точка', archiveStart:'~2010', hourly:false, precipAccuracy:'excellent', russiaCoverage:'Белореченск', note:'Станция Росгидромета. Самый точный источник осадков для Белореченска (48мм 24.04 vs ERA5 ~15мм).' },
  { id:'rp5',           name:'rp5.ru (Синоптики)',              type:'station',       resolution:'Точка', archiveStart:'~2000', hourly:true,  precipAccuracy:'excellent', russiaCoverage:'✅ Лучший для РФ', note:'~1500 станций по РФ. 3-часовые данные. Парсинг HTML.' },
  { id:'meteostat',     name:'Meteostat (WMO/NOAA)',            type:'station',       resolution:'Точка', archiveStart:'1940s', hourly:true,  precipAccuracy:'excellent', russiaCoverage:'Хорошо', note:'Python библиотека. 10000+ станций. Нужен API ключ (бесплатно).' },
  { id:'noaa_isd',      name:'NOAA ISD',                       type:'station',       resolution:'Точка', archiveStart:'1901',  hourly:true,  precipAccuracy:'excellent', russiaCoverage:'35000+ станций', note:'Интегрированные поверхностные данные. Самый большой архив станций.' },
  { id:'ogimet',        name:'OGIMET (SYNOP)',                  type:'station',       resolution:'Точка', archiveStart:'~10 дней', hourly:false, precipAccuracy:'excellent', russiaCoverage:'Глобальный', note:'SYNOP сообщения. Последние 10 дней бесплатно.' },
  { id:'ecmwf_ifs',     name:'ECMWF IFS анализ',                type:'model_analysis', resolution:'9 км',   archiveStart:'2017',  hourly:true,  precipAccuracy:'good',       russiaCoverage:'Глобальный', note:'Анализ модели (не реанализ). Гораздо точнее ERA5 по осадкам.' },
  { id:'era5',          name:'ERA5 (ECMWF)',                    type:'reanalysis',    resolution:'31 км',  archiveStart:'1940',  hourly:true,  precipAccuracy:'biased',     russiaCoverage:'Глобальный', note:'⚠️ Осадки занижены в 2-3x vs реальные измерения!' },
  { id:'era5_land',     name:'ERA5-Land (ECMWF)',               type:'reanalysis',    resolution:'9 км',   archiveStart:'1950',  hourly:true,  precipAccuracy:'biased',     russiaCoverage:'Глобальный', note:'⚠️ Повышенное разрешение, но осадки всё ещё занижены.' },
  { id:'cerra',         name:'CERRA (Copernicus)',              type:'reanalysis',    resolution:'5.5 км', archiveStart:'1984',  hourly:true,  precipAccuracy:'good',       russiaCoverage:'Европа + РФ', note:'Европейский реанализ. Среднее между ERA5 и станциями.' },
  { id:'pogodaiklimat', name:'Погодаиклимат.ру',               type:'station',       resolution:'Точка', archiveStart:'1945',  hourly:false, precipAccuracy:'excellent', russiaCoverage:'✅ Вся РФ', note:'Агрегатор данных Росгидромета. Суточные данные.' },
  { id:'meteoinform',   name:'Метеоинформ.ру',                  type:'station',       resolution:'Точка', archiveStart:'~2000', hourly:false, precipAccuracy:'excellent', russiaCoverage:'✅ Вся РФ', note:'Данные Росгидромета. 3-часовые.' },
  { id:'roshydromet',   name:'Открытые данные Росгидромета',    type:'station',       resolution:'Точка', archiveStart:'Варьируется', hourly:false, precipAccuracy:'excellent', russiaCoverage:'✅ Вся РФ', note:'Официальный источник. vat.meteorf.ru — свободный доступ.' },
];

/* ====== Популярные города ====== */
export const POPULAR_CITIES: GeoLocation[] = [
  { name:'Белореченск',     lat:44.7844,  lon:40.1169,  country:'Россия', admin1:'Краснодарский край',    displayName:'Белореченск, Краснодарский край, Россия' },
  { name:'Краснодар',       lat:45.0355,  lon:38.9753,  country:'Россия', admin1:'Краснодарский край',    displayName:'Краснодар, Краснодарский край, Россия' },
  { name:'Майкоп',          lat:44.6098,  lon:40.1006,  country:'Россия', admin1:'Адыгея',                displayName:'Майкоп, Адыгея, Россия' },
  { name:'Сочи',            lat:43.6028,  lon:39.7342,  country:'Россия', admin1:'Краснодарский край',    displayName:'Сочи, Краснодарский край, Россия' },
  { name:'Ростов-на-Дону',  lat:47.2357,  lon:39.7015,  country:'Россия', admin1:'Ростовская область',    displayName:'Ростов-на-Дону, Ростовская область, Россия' },
  { name:'Кропоткин',       lat:45.4356,  lon:40.5817,  country:'Россия', admin1:'Краснодарский край',    displayName:'Кропоткин, Краснодарский край, Россия' },
  { name:'Армавир',         lat:44.9943,  lon:41.1219,  country:'Россия', admin1:'Краснодарский край',    displayName:'Армавир, Краснодарский край, Россия' },
  { name:'Туапсе',          lat:44.0958,  lon:39.0725,  country:'Россия', admin1:'Краснодарский край',    displayName:'Туапсе, Краснодарский край, Россия' },
  { name:'Москва',          lat:55.7558,  lon:37.6173,  country:'Россия', admin1:'Москва',                 displayName:'Москва, Россия' },
  { name:'Санкт-Петербург', lat:59.9343,  lon:30.3351,  country:'Россия', admin1:'Санкт-Петербург',       displayName:'Санкт-Петербург, Россия' },
  { name:'Новосибирск',     lat:55.0084,  lon:82.9357,  country:'Россия', admin1:'Новосибирская область', displayName:'Новосибирск, Новосибирская область, Россия' },
  { name:'Екатеринбург',    lat:56.8389,  lon:60.6057,  country:'Россия', admin1:'Свердловская область',  displayName:'Екатеринбург, Свердловская область, Россия' },
  { name:'Казань',          lat:55.7887,  lon:49.1221,  country:'Россия', admin1:'Татарстан',             displayName:'Казань, Татарстан, Россия' },
  { name:'Волгоград',       lat:48.7080,  lon:44.5133,  country:'Россия', admin1:'Волгоградская область', displayName:'Волгоград, Волгоградская область, Россия' },
];
