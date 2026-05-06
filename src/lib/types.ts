export interface GeoLocation { name: string; lat: number; lon: number; country?: string; admin1?: string; displayName: string }
export interface DailyForecast {
  date: string; tempMax: number|null; tempMin: number|null; precipSum: number|null;
  windMax: number|null; windDir: number|null; humidityMax: number|null; humidityMin: number|null;
  pressureMax: number|null; pressureMin: number|null; uvIndexMax: number|null; precipProb: number|null;
  sunrise: string|null; sunset: string|null; weatherCode: number|null; windGusts: number|null; et0: number|null;
}
export interface HourlyForecast {
  time: string; temp: number|null; precip: number|null; windSpeed: number|null; windDir: number|null;
  humidity: number|null; pressure: number|null; weatherCode: number|null; cloudCover: number|null;
  visibility: number|null; windGusts: number|null; isDay: number|null;
}
export interface ForecastSource {
  id: string; name: string; model: string; daily: DailyForecast[]; hourly: HourlyForecast[];
  loaded: boolean; error: string|null; loading: boolean;
}
export interface ArchiveDay { date: string; tempMax: number|null; tempMin: number|null; precipSum: number|null; windMax: number|null; source: string }
export interface ForecastSnapshot {
  id: string; savedAt: string; sourceId: string; sourceName: string;
  forecasts: { date: string; tempMax: number|null; tempMin: number|null; precipSum: number|null; windMax: number|null; precipProb: number|null }[];
}
export interface UserObservation { id: string; date: string; temp: string; humidity: string; precip: string; wind: string; notes: string; createdAt: string }
export interface WeatherParam { id: string; label: string; unit: string; icon: string; category: string }
export const WEATHER_PARAMS: WeatherParam[] = [
  { id:'tempMax', label:'Т макс', unit:'°C', icon:'🌡', category:'temperature' },
  { id:'tempMin', label:'Т мин', unit:'°C', icon:'🌡', category:'temperature' },
  { id:'precipSum', label:'Осадки', unit:'мм', icon:'🌧', category:'precipitation' },
  { id:'precipProb', label:'Вер.осадк.', unit:'%', icon:'☔', category:'precipitation' },
  { id:'windMax', label:'Ветер макс', unit:'км/ч', icon:'💨', category:'wind' },
  { id:'windGusts', label:'Порывы', unit:'км/ч', icon:'🌪', category:'wind' },
  { id:'humidityMax', label:'Влажн.макс', unit:'%', icon:'💧', category:'other' },
  { id:'humidityMin', label:'Влажн.мин', unit:'%', icon:'💧', category:'other' },
  { id:'pressureMax', label:'Давл.макс', unit:'гПа', icon:'📊', category:'other' },
  { id:'pressureMin', label:'Давл.мин', unit:'гПа', icon:'📊', category:'other' },
  { id:'uvIndexMax', label:'УФ-индекс', unit:'', icon:'☀', category:'other' },
  { id:'et0', label:'ЭТ0', unit:'мм', icon:'🌱', category:'other' },
  { id:'sunrise', label:'Восход', unit:'', icon:'🌅', category:'other' },
  { id:'sunset', label:'Заход', unit:'', icon:'🌇', category:'other' },
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
