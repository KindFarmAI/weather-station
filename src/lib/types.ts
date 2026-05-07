export interface GeoLocation {
  name: string; lat: number; lon: number;
  country?: string; admin1?: string; displayName: string;
}

/* ====== CORE DATA MODEL: immutable forecast rows ====== */
export interface ForecastRow {
  id: string;               // locationId_sourceId_targetDate_snapshotDate
  targetDate: string;       // date being predicted ("2024-04-24")
  sourceId: string;         // "ecmwf" | "gfs" | "icon" | "yandex"
  sourceName: string;       // "ECMWF IFS"
  snapshotDate: string;     // when prediction was made
  daysBefore: number;       // days until targetDate
  locationId: string;       // "44.78_40.12"
  tempMax: number|null; tempMin: number|null;
  precipSum: number|null; precipProb: number|null;
  windMax: number|null; windGusts: number|null;
  humidityMax: number|null; humidityMin: number|null;
  pressureMax: number|null; pressureMin: number|null;
  uvIndexMax: number|null;
  weatherCode: number|null; et0: number|null;
}

export interface HourlyForecast {
  time: string; temp: number|null; precip: number|null; windSpeed: number|null;
  windDir: number|null; humidity: number|null; pressure: number|null;
  weatherCode: number|null; cloudCover: number|null; visibility: number|null;
  windGusts: number|null; isDay: number|null;
}

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

export interface FactRow {
  id: string; date: string; locationId: string; source: string;
  tempMax: number|null; tempMin: number|null; precipSum: number|null; windMax: number|null;
}

export interface ArchiveDay {
  date: string; tempMax: number|null; tempMin: number|null;
  precipSum: number|null; windMax: number|null; source: string;
}

export interface UserObservation {
  id: string; date: string; temp: string; humidity: string;
  precip: string; wind: string; notes: string; createdAt: string;
}

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
export const DEFAULT_PARAMS = ['tempMax','tempMin','precipSum','precipProb','windMax','windGusts','humidityMax'];

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

export const POPULAR_CITIES: GeoLocation[] = [
  { name:'Москва',          lat:55.7558,  lon:37.6173,  country:'Россия', admin1:'Москва',                 displayName:'Москва, Россия' },
  { name:'Санкт-Петербург', lat:59.9343,  lon:30.3351,  country:'Россия', admin1:'Санкт-Петербург',       displayName:'Санкт-Петербург, Россия' },
  { name:'Краснодар',       lat:45.0355,  lon:38.9753,  country:'Россия', admin1:'Краснодарский край',    displayName:'Краснодар, Краснодарский край, Россия' },
  { name:'Белореченск',     lat:44.7844,  lon:40.1169,  country:'Россия', admin1:'Краснодарский край',    displayName:'Белореченск, Краснодарский край, Россия' },
  { name:'Новосибирск',     lat:55.0084,  lon:82.9357,  country:'Россия', admin1:'Новосибирская область', displayName:'Новосибирск, Новосибирская область, Россия' },
  { name:'Екатеринбург',    lat:56.8389,  lon:60.6057,  country:'Россия', admin1:'Свердловская область',  displayName:'Екатеринбург, Свердловская область, Россия' },
  { name:'Казань',          lat:55.7887,  lon:49.1221,  country:'Россия', admin1:'Татарстан',             displayName:'Казань, Татарстан, Россия' },
  { name:'Ростов-на-Дону',  lat:47.2357,  lon:39.7015,  country:'Россия', admin1:'Ростовская область',    displayName:'Ростов-на-Дону, Ростовская область, Россия' },
  { name:'Сочи',            lat:43.6028,  lon:39.7342,  country:'Россия', admin1:'Краснодарский край',    displayName:'Сочи, Краснодарский край, Россия' },
  { name:'Волгоград',       lat:48.7080,  lon:44.5133,  country:'Россия', admin1:'Волгоградская область', displayName:'Волгоград, Волгоградская область, Россия' },
  { name:'Кропоткин',       lat:45.4356,  lon:40.5817,  country:'Россия', admin1:'Краснодарский край',    displayName:'Кропоткин, Краснодарский край, Россия' },
  { name:'Майкоп',          lat:44.6098,  lon:40.1006,  country:'Россия', admin1:'Адыгея',                displayName:'Майкоп, Адыгея, Россия' },
  { name:'Туапсе',          lat:44.0958,  lon:39.0725,  country:'Россия', admin1:'Краснодарский край',    displayName:'Туапсе, Краснодарский край, Россия' },
  { name:'Армавир',         lat:44.9943,  lon:41.1219,  country:'Россия', admin1:'Краснодарский край',    displayName:'Армавир, Краснодарский край, Россия' },
];
