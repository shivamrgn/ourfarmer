/**
 * NASA POWER API Service
 * Prediction Of Worldwide Energy Resources (NASA Langley Research Center)
 * Provides agroclimatology and historical environmental datasets (MERRA-2 / GEOS-IT)
 */

export interface NasaDailyRecord {
  date: string; // YYYY-MM-DD
  rawDate: string; // YYYYMMDD
  displayDate: string; // e.g., "15 Aug"
  tempMean: number; // °C (T2M)
  tempMax: number; // °C (T2M_MAX)
  tempMin: number; // °C (T2M_MIN)
  precipitation: number; // mm/day (PRECTOTCORR)
  humidity: number; // % (RH2M)
  solarRadiation: number; // MJ/m²/day (ALLSKY_SFC_SW_DWN)
}

export interface NasaPowerSummary {
  avgTemp: number;
  maxTemp: number;
  minTemp: number;
  totalPrecipitation: number;
  avgHumidity: number;
  avgSolarRadiation: number;
  daysCount: number;
}

export interface NasaPowerDataset {
  periodLabel: string;
  startDate: string;
  endDate: string;
  records: NasaDailyRecord[];
  summary: NasaPowerSummary;
  sources: string[];
}

/**
 * Calculates a reliable date range for NASA POWER daily data.
 * NASA MERRA-2 assimilation dataset has a ~14 day lag for fully validated daily data.
 */
export function getNasaDateRange(days: number = 30): { start: string; end: string } {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 14); // 14-day buffer for assimilation
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));

  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  };

  return { start: format(startDate), end: format(endDate) };
}

function formatRawDate(raw: string): { iso: string; display: string } {
  // raw format: YYYYMMDD
  if (raw.length !== 8) return { iso: raw, display: raw };
  const y = raw.substring(0, 4);
  const m = raw.substring(4, 6);
  const d = raw.substring(6, 8);
  const iso = `${y}-${m}-${d}`;
  
  const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const display = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { iso, display };
}

function formatDateString(raw: string): string {
  if (raw.length !== 8) return raw;
  const y = raw.substring(0, 4);
  const m = raw.substring(4, 6);
  const d = raw.substring(6, 8);
  const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Fetches real historical/environmental data from the NASA POWER API.
 * No API key required (public science dataset from NASA Langley).
 */
export async function fetchNasaPowerData(
  latitude: number,
  longitude: number,
  days: number = 30
): Promise<NasaPowerDataset> {
  const { start, end } = getNasaDateRange(days);

  // Agroclimatology parameters from NASA POWER
  const parameters = "T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN";
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${parameters}&community=AG&longitude=${longitude.toFixed(4)}&latitude=${latitude.toFixed(4)}&start=${start}&end=${end}&format=JSON`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NASA POWER API request failed with status ${response.status}`);
  }

  const json = await response.json();
  const params = json?.properties?.parameter;
  if (!params || !params.T2M) {
    throw new Error("Invalid or empty response structure from NASA POWER API.");
  }

  const fillValue = json?.header?.fill_value ?? -999.0;
  const dateKeys = Object.keys(params.T2M).sort();

  const records: NasaDailyRecord[] = [];
  let tempSum = 0;
  let tempMaxOverall = -Infinity;
  let tempMinOverall = Infinity;
  let precipTotal = 0;
  let humiditySum = 0;
  let solarSum = 0;
  let validCount = 0;

  for (const dateKey of dateKeys) {
    const tMean = params.T2M[dateKey];
    if (tMean === fillValue || tMean === null || isNaN(tMean)) {
      continue; // Skip unfilled/missing dates
    }

    const tMax = params.T2M_MAX?.[dateKey] !== fillValue ? params.T2M_MAX[dateKey] : tMean;
    const tMin = params.T2M_MIN?.[dateKey] !== fillValue ? params.T2M_MIN[dateKey] : tMean;
    const precip = params.PRECTOTCORR?.[dateKey] !== fillValue ? Math.max(0, params.PRECTOTCORR[dateKey]) : 0;
    const humidity = params.RH2M?.[dateKey] !== fillValue ? params.RH2M[dateKey] : 0;
    const solar = params.ALLSKY_SFC_SW_DWN?.[dateKey] !== fillValue ? Math.max(0, params.ALLSKY_SFC_SW_DWN[dateKey]) : 0;

    const { iso, display } = formatRawDate(dateKey);

    records.push({
      date: iso,
      rawDate: dateKey,
      displayDate: display,
      tempMean: Number(tMean.toFixed(1)),
      tempMax: Number(tMax.toFixed(1)),
      tempMin: Number(tMin.toFixed(1)),
      precipitation: Number(precip.toFixed(2)),
      humidity: Number(humidity.toFixed(1)),
      solarRadiation: Number(solar.toFixed(2)),
    });

    tempSum += tMean;
    if (tMax > tempMaxOverall) tempMaxOverall = tMax;
    if (tMin < tempMinOverall) tempMinOverall = tMin;
    precipTotal += precip;
    humiditySum += humidity;
    solarSum += solar;
    validCount++;
  }

  if (records.length === 0) {
    throw new Error("No valid observation records returned from NASA POWER for this location.");
  }

  const startDateFormatted = formatDateString(records[0].rawDate);
  const endDateFormatted = formatDateString(records[records.length - 1].rawDate);
  const periodLabel = `Historical Environmental Data — ${startDateFormatted} to ${endDateFormatted}`;

  const summary: NasaPowerSummary = {
    avgTemp: Number((tempSum / validCount).toFixed(1)),
    maxTemp: Number(tempMaxOverall.toFixed(1)),
    minTemp: Number(tempMinOverall.toFixed(1)),
    totalPrecipitation: Number(precipTotal.toFixed(1)),
    avgHumidity: Number((humiditySum / validCount).toFixed(1)),
    avgSolarRadiation: Number((solarSum / validCount).toFixed(2)),
    daysCount: validCount,
  };

  return {
    periodLabel,
    startDate: records[0].date,
    endDate: records[records.length - 1].date,
    records,
    summary,
    sources: json?.header?.sources || ["NASA POWER", "MERRA-2", "GEOS-IT"],
  };
}
