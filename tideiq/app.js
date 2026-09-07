const { tideIqData } = window;

const app = document.querySelector("#app");
const REFRESH_INTERVAL_MS = 60 * 1000;
const NOAA_API_URLS = [
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter",
  "https://api.tidesandcurrents.noaa.gov/api/uat/datagetter"
];
const OPEN_METEO_API_URL = "https://api.open-meteo.com/v1/forecast";
const STATION_COORDINATES = { latitude: 31.1317, longitude: -81.3967 };
const STATION_TIME_ZONE = "America/New_York";
const FUTURE_RANGE_DAYS = 365;
const DAY_START_MINUTES = 0;
const DAY_END_MINUTES = 24 * 60;

function createIcon(name, className = "") {
  const icons = {
    fallingArrow: `
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" class="${className}">
        <path d="M13 12h19v19" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M32 12 12 32" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
        <path d="M27 32h-15v-15" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `,
    risingArrow: `
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" class="${className}">
        <path d="M14 34h19v-19" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M33 15 13 35" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
        <path d="M18 15h15v15" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `,
    storm: `
      <svg viewBox="0 0 64 64" role="img" aria-label="Thunderstorm" class="${className}">
        <path d="M20.3 42.5h27.6c6.2 0 11.2-4.6 11.2-10.3 0-5.2-4.2-9.6-9.8-10.2C47.4 14.7 40.6 9.5 32.7 9.5c-7.2 0-13.5 4.5-15.8 11.1h-1.3c-6.1 0-11 4.9-11 10.9 0 6.1 4.9 11 11 11h4.7Z" fill="currentColor" />
        <path d="M31.9 35.2 24.8 49h7l-3.3 10.1 11.9-16h-7.2l4.3-7.9h-5.6Z" fill="#e9fbff" />
      </svg>
    `
  };

  return icons[name] || "";
}

function parseTimeToMinutes(time) {
  const value = String(time).trim();
  const dateTimeMatch = value.match(/^\d{4}-\d{2}-\d{2}\s+(\d{1,2}):(\d{2})$/);
  if (dateTimeMatch) {
    return Number(dateTimeMatch[1]) * 60 + Number(dateTimeMatch[2]);
  }

  const match = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const period = match[3].toUpperCase();
  if (period === "AM" && hours === 12) hours = 0;
  if (period === "PM" && hours !== 12) hours += 12;
  return hours * 60 + minutes;
}

function parseStationDateTimeMinutes(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5])
  ) / 60000;
}

function addMinutesToStationDateTime(value, minutes) {
  const timestamp = parseStationDateTimeMinutes(value);
  if (timestamp === null) return value;

  const date = new Date((timestamp + minutes) * 60000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")} ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function chartMinuteOffset(value, chartStartDateTime) {
  const timestamp = parseStationDateTimeMinutes(value);
  const startTimestamp = parseStationDateTimeMinutes(chartStartDateTime);
  if (timestamp !== null && startTimestamp !== null) return timestamp - startTimestamp;

  const minutes = parseTimeToMinutes(value);
  const startMinutes = parseTimeToMinutes(chartStartDateTime);
  if (minutes === null) return null;
  if (startMinutes === null) return minutes;

  const offset = minutes - startMinutes;
  return offset < 0 ? offset + DAY_END_MINUTES : offset;
}

function buildTimeTicks(chartStartDateTime) {
  return Array.from({ length: 9 }, (_, index) => {
    const offset = index * 3 * 60;
    const time = addMinutesToStationDateTime(chartStartDateTime, offset);
    return {
      offset,
      label: index === 0 ? "Now" : formatStationDateTime(time)
    };
  });
}

function getDisplayTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York"
  }).format(date);
}

function getStationDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(values.hour) % 24;

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour,
    minute: Number(values.minute)
  };
}

function formatNoaaDate(parts) {
  return `${parts.year}${String(parts.month).padStart(2, "0")}${String(parts.day).padStart(2, "0")}`;
}

function formatDateKey(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function parseDateKey(dateKey) {
  const match = String(dateKey).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function addDaysToDateKey(dateKey, days) {
  const parts = parseDateKey(dateKey);
  if (!parts) return dateKey;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatSelectedDate(dateKey, options = {}) {
  const parts = parseDateKey(dateKey);
  if (!parts) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...options
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)));
}

function addDaysToStationDate(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12));
  return getStationDateParts(date);
}

function formatStationDateTime(dateTime) {
  const [, time = ""] = String(dateTime).split(" ");
  const [hourValue, minute = "00"] = time.split(":");
  let hour = Number(hourValue);
  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${period}`;
}

function formatHourLabel(dateTime) {
  const [, time = ""] = String(dateTime).split(" ");
  const [hourValue] = time.split(":");
  return formatHourFrom24(Number(hourValue));
}

function formatHourFrom24(hourValue) {
  const normalizedHour = ((hourValue % 24) + 24) % 24;
  const period = normalizedHour >= 12 ? "PM" : "AM";
  const hour = normalizedHour % 12 || 12;
  return `${hour} ${period}`;
}

function formatHeight(value) {
  return `${Number(value).toFixed(1)} ft`;
}

function typeLabel(type) {
  return type === "H" ? "HIGH" : "LOW";
}

function buildCurrentHourlyConditions(conditions, date = new Date()) {
  const { hour } = getStationDateParts(date);

  return conditions.map((condition, index) => ({
    ...condition,
    time: formatHourFrom24(hour + index)
  }));
}

function buildNoaaUrl(baseUrl, params) {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

function describeWeatherCode(code) {
  if (code === 0) return { label: "Clear", icon: "☀️" };
  if (code <= 2) return { label: "Partly cloudy", icon: "🌤️" };
  if (code === 3) return { label: "Overcast", icon: "☁️" };
  if (code === 45 || code === 48) return { label: "Foggy", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "🌦️" };
  if (code >= 61 && code <= 67) return { label: "Rain", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: "❄️" };
  if (code >= 80 && code <= 82) return { label: "Showers", icon: "🌦️" };
  if (code >= 85 && code <= 86) return { label: "Snow showers", icon: "🌨️" };
  if (code >= 95) return { label: "Thunderstorms", icon: "⛈️" };
  return { label: "Mixed conditions", icon: "🌥️" };
}

async function fetchDailyForecast(selectedDate) {
  const url = buildNoaaUrl(OPEN_METEO_API_URL, {
    latitude: STATION_COORDINATES.latitude,
    longitude: STATION_COORDINATES.longitude,
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: STATION_TIME_ZONE,
    forecast_days: 16
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
  const payload = await response.json();
  const dayIndex = payload.daily?.time?.indexOf(selectedDate) ?? -1;
  if (dayIndex < 0) return null;
  const conditions = describeWeatherCode(payload.daily.weather_code[dayIndex]);

  return {
    date: selectedDate,
    ...conditions,
    high: Math.round(payload.daily.temperature_2m_max[dayIndex]),
    low: Math.round(payload.daily.temperature_2m_min[dayIndex]),
    precipitation: Math.round(payload.daily.precipitation_probability_max[dayIndex]),
    wind: Math.round(payload.daily.wind_speed_10m_max[dayIndex])
  };
}

async function fetchNoaaPredictions({ station, beginDate, endDate, interval }) {
  const params = {
    product: "predictions",
    application: "TideIQ",
    begin_date: beginDate,
    end_date: endDate,
    datum: "MLLW",
    station,
    time_zone: "lst_ldt",
    units: "english",
    interval,
    format: "json"
  };
  const errors = [];

  for (const apiUrl of NOAA_API_URLS) {
    try {
      const response = await fetch(buildNoaaUrl(apiUrl, params));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (Array.isArray(payload.predictions)) return payload.predictions;
      throw new Error(payload.error?.message || "NOAA response did not include predictions");
    } catch (error) {
      errors.push(`${apiUrl}: ${error.message}`);
    }
  }

  throw new Error(`NOAA predictions unavailable. ${errors.join(" | ")}`);
}

function findNearestPrediction(predictions, nowDateTime) {
  const nowMinutes = parseStationDateTimeMinutes(nowDateTime);
  return predictions.reduce((nearest, prediction) => {
    const minutes = parseStationDateTimeMinutes(prediction.t);
    if (minutes === null) return nearest;
    const distance = Math.abs(minutes - nowMinutes);
    return !nearest || distance < nearest.distance ? { prediction, minutes, distance } : nearest;
  }, null);
}

function findNextEvent(events, nowDateTime) {
  return events.find((event) => event.t > nowDateTime) || events[0];
}

function findNextEventOfType(events, type, nowDateTime) {
  return events.find((event) => event.type === type && event.t > nowDateTime) || events.find((event) => event.type === type);
}

function interpolateTideHeight(points, referenceMinutes, chartStartDateTime) {
  const sortedPoints = points
    .map((point) => ({
      minutes: chartMinuteOffset(point.time, chartStartDateTime),
      height: Number(point.height)
    }))
    .filter((point) => point.minutes !== null && Number.isFinite(point.height))
    .sort((a, b) => a.minutes - b.minutes);

  if (!sortedPoints.length) return null;

  const previous = sortedPoints.slice().reverse().find((point) => point.minutes <= referenceMinutes) || sortedPoints[0];
  const next = sortedPoints.find((point) => point.minutes >= referenceMinutes) || sortedPoints[sortedPoints.length - 1];
  if (previous.minutes === next.minutes) return previous.height;

  const ratio = (referenceMinutes - previous.minutes) / (next.minutes - previous.minutes);
  return previous.height + ((next.height - previous.height) * Math.max(0, Math.min(1, ratio)));
}

function applyCurrentMarker(data, date = new Date()) {
  const stationNow = getStationDateParts(date);
  const referenceDateTime = `${formatDateKey(stationNow)} ${String(stationNow.hour).padStart(2, "0")}:${String(stationNow.minute).padStart(2, "0")}`;
  const chartStartDateTime = data.chartStartDateTime || `${formatDateKey(stationNow)} 00:00`;
  const referenceMinutes = chartMinuteOffset(referenceDateTime, chartStartDateTime) ?? 0;
  const height = interpolateTideHeight(data.tidePoints || [], referenceMinutes, chartStartDateTime);

  return {
    ...data,
    currentTime: getDisplayTime(date),
    currentTideHeight: height === null ? data.currentTideHeight : formatHeight(height),
    currentPoint: {
      time: referenceDateTime,
      height: height === null ? Number.parseFloat(data.currentPoint?.height) || 0 : height
    }
  };
}

async function getLiveTideData(baseData, selectedDate) {
  const stationNow = getStationDateParts();
  const todayKey = formatDateKey(stationNow);
  const selectedParts = parseDateKey(selectedDate) || stationNow;
  const selectedKey = formatDateKey(selectedParts);
  const isToday = selectedKey === todayKey;
  const selectedNoaaDate = formatNoaaDate(selectedParts);
  const followingNoaaDate = formatNoaaDate(addDaysToStationDate(selectedParts, 1));
  const referenceMinutes = isToday ? stationNow.hour * 60 + stationNow.minute : 12 * 60;
  const referenceHour = Math.floor(referenceMinutes / 60);
  const referenceMinute = referenceMinutes % 60;
  const referenceDateTime = `${selectedKey} ${String(referenceHour).padStart(2, "0")}:${String(referenceMinute).padStart(2, "0")}`;
  const chartStartDateTime = isToday ? referenceDateTime : `${selectedKey} 00:00`;
  const chartEndDateTime = addMinutesToStationDateTime(chartStartDateTime, DAY_END_MINUTES);

  const [curvePredictions, tideEvents] = await Promise.all([
    fetchNoaaPredictions({
      station: baseData.station.id,
      beginDate: selectedNoaaDate,
      endDate: isToday ? followingNoaaDate : selectedNoaaDate,
      interval: "6"
    }),
    fetchNoaaPredictions({
      station: baseData.station.id,
      beginDate: selectedNoaaDate,
      endDate: followingNoaaDate,
      interval: "hilo"
    })
  ]);

  const visibleCurvePredictions = curvePredictions.filter((prediction) => (
    prediction.t >= chartStartDateTime && prediction.t <= chartEndDateTime
  ));
  const nearest = findNearestPrediction(curvePredictions, referenceDateTime);
  const previous = curvePredictions.slice().reverse().find((prediction) => prediction.t < referenceDateTime);
  const nextCurve = curvePredictions.find((prediction) => prediction.t > referenceDateTime);
  const previousHeight = previous ? Number(previous.v) : Number(nearest?.prediction.v ?? 0);
  const nextHeight = nextCurve ? Number(nextCurve.v) : previousHeight;
  const referenceTimestamp = parseStationDateTimeMinutes(referenceDateTime) ?? 0;
  const previousMinutes = previous ? parseStationDateTimeMinutes(previous.t) : referenceTimestamp;
  const nextMinutes = nextCurve ? parseStationDateTimeMinutes(nextCurve.t) : referenceTimestamp;
  const currentRatio = nextMinutes === previousMinutes ? 0 : (referenceTimestamp - previousMinutes) / (nextMinutes - previousMinutes);
  const currentHeight = previousHeight + ((nextHeight - previousHeight) * Math.max(0, Math.min(1, currentRatio)));
  const tideDirection = nextHeight >= previousHeight ? "RISING" : "FALLING";
  const nextEvent = findNextEvent(tideEvents, referenceDateTime);
  const nextHigh = findNextEventOfType(tideEvents, "H", referenceDateTime);
  const nextLow = findNextEventOfType(tideEvents, "L", referenceDateTime);
  const chartEvents = tideEvents
    .filter((event) => event.t >= chartStartDateTime && event.t <= chartEndDateTime)
    .map((event) => ({
      type: typeLabel(event.type),
      time: formatStationDateTime(event.t),
      sourceTime: event.t,
      height: formatHeight(event.v)
    }));

  return {
    ...baseData,
    selectedDate: selectedKey,
    selectedDateLabel: formatSelectedDate(selectedKey, { weekday: "long", month: "long", day: "numeric" }),
    isToday,
    referenceLabel: isToday ? "Current tide" : "Tide at noon",
    chartMarkerLabel: isToday ? "now" : "noon",
    chartStartDateTime,
    chartEndDateTime,
    currentTideHeight: formatHeight(currentHeight),
    tideDirection,
    nextTide: {
      type: typeLabel(nextEvent.type),
      time: formatStationDateTime(nextEvent.t)
    },
    tidePoints: visibleCurvePredictions.map((prediction) => ({
      time: prediction.t,
      height: Number(prediction.v)
    })),
    currentPoint: {
      time: referenceDateTime,
      height: currentHeight
    },
    tideEvents: chartEvents.length ? chartEvents : [nextHigh, nextLow].filter(Boolean).map((event) => ({
      type: typeLabel(event.type),
      time: formatStationDateTime(event.t),
      sourceTime: event.t,
      height: formatHeight(event.v)
    })),
    chartEvents
  };
}

function buildTideCycleSampler(points, currentPoint, tideEvents, chartStartDateTime) {
  const sortedPoints = [...points]
    .map((point) => ({
      time: point.time,
      minutes: chartMinuteOffset(point.time, chartStartDateTime),
      height: point.height
    }))
    .filter((point) => point.minutes !== null)
    .sort((a, b) => a.minutes - b.minutes);

  const currentMinutes = chartMinuteOffset(currentPoint.time, chartStartDateTime);
  const currentHeight = Number.parseFloat(currentPoint.height ?? currentPoint.heightText);
  const eventAnchors = tideEvents
    .map((event) => ({
      time: event.time,
      minutes: chartMinuteOffset(event.sourceTime || event.time, chartStartDateTime),
      height: Number.parseFloat(event.height),
      isExtremum: true
    }))
    .filter((event) => event.minutes !== null && Number.isFinite(event.height));
  const anchors = [...sortedPoints.map((point) => ({ ...point, isExtremum: false })), ...eventAnchors];

  if (currentMinutes !== null && Number.isFinite(currentHeight)) {
    anchors.push({
      time: currentPoint.time,
      minutes: currentMinutes,
      height: currentHeight,
      isExtremum: false
    });
  }

  const sortedAnchors = anchors
    .sort((a, b) => a.minutes - b.minutes)
    .filter((point, index, allPoints) => index === 0 || point.minutes !== allPoints[index - 1].minutes)
    .sort((a, b) => a.minutes - b.minutes);

  const count = sortedAnchors.length;
  if (count < 2) {
    return {
      points: sortedAnchors,
      sample: () => sortedAnchors[0]?.height ?? 0
    };
  }

  const intervalSlopes = [];
  for (let index = 0; index < count - 1; index += 1) {
    const left = sortedAnchors[index];
    const right = sortedAnchors[index + 1];
    intervalSlopes.push((right.height - left.height) / (right.minutes - left.minutes));
  }

  const tangents = new Array(count);
  tangents[0] = intervalSlopes[0];
  tangents[count - 1] = intervalSlopes[count - 2];

  for (let index = 1; index < count - 1; index += 1) {
    const previousSlope = intervalSlopes[index - 1];
    const nextSlope = intervalSlopes[index];

    if (previousSlope === 0 || nextSlope === 0 || Math.sign(previousSlope) !== Math.sign(nextSlope)) {
      tangents[index] = 0;
    } else {
      const previousWidth = sortedAnchors[index].minutes - sortedAnchors[index - 1].minutes;
      const nextWidth = sortedAnchors[index + 1].minutes - sortedAnchors[index].minutes;
      tangents[index] = (previousWidth + nextWidth) / ((previousWidth / previousSlope) + (nextWidth / nextSlope));
    }
  }

  const sample = (minutes) => {
    const clampedMinutes = Math.max(sortedAnchors[0].minutes, Math.min(sortedAnchors[count - 1].minutes, minutes));
    const segmentIndex = Math.max(0, Math.min(
      count - 2,
      sortedAnchors.findIndex((point, index) => index < count - 1 && clampedMinutes >= point.minutes && clampedMinutes <= sortedAnchors[index + 1].minutes)
    ));
    const left = sortedAnchors[segmentIndex];
    const right = sortedAnchors[segmentIndex + 1];
    const width = right.minutes - left.minutes;
    const t = width === 0 ? 0 : (clampedMinutes - left.minutes) / width;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = (2 * t3) - (3 * t2) + 1;
    const h10 = t3 - (2 * t2) + t;
    const h01 = (-2 * t3) + (3 * t2);
    const h11 = t3 - t2;

    return (
      h00 * left.height +
      h10 * width * tangents[segmentIndex] +
      h01 * right.height +
      h11 * width * tangents[segmentIndex + 1]
    );
  };

  return {
    points: sortedAnchors,
    sample
  };
}

function buildSmoothPath(points) {
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;

    const previous = points[index - 1];
    const beforePrevious = points[index - 2] || previous;
    const next = points[index + 1] || point;
    const controlOne = {
      x: previous.x + (point.x - beforePrevious.x) / 6,
      y: previous.y + (point.y - beforePrevious.y) / 6
    };
    const controlTwo = {
      x: point.x - (next.x - previous.x) / 6,
      y: point.y - (next.y - previous.y) / 6
    };

    return `${path} C ${controlOne.x.toFixed(2)} ${controlOne.y.toFixed(2)}, ${controlTwo.x.toFixed(2)} ${controlTwo.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, "");
}

function getChartGeometry(points, currentPoint, tideEvents, chartStartDateTime) {
  const width = 980;
  const height = 242;
  const padding = { top: 22, right: 24, bottom: 40, left: 58 };
  const plottedHeights = [
    ...points.map((point) => Number(point.height)),
    ...tideEvents.map((event) => Number.parseFloat(event.height)),
    Number(currentPoint.height)
  ].filter(Number.isFinite);
  const dataMin = Math.min(...plottedHeights);
  const dataMax = Math.max(...plottedHeights);
  const minHeight = Math.min(0, Math.floor(dataMin));
  const maxHeight = Math.max(1, Math.ceil(dataMax));

  const toTimeX = (time) => {
    const minutes = chartMinuteOffset(time, chartStartDateTime);
    if (minutes === null) return null;
    const ratio = (minutes - DAY_START_MINUTES) / (DAY_END_MINUTES - DAY_START_MINUTES);
    return padding.left + Math.max(0, Math.min(1, ratio)) * (width - padding.left - padding.right);
  };
  const toY = (value) => {
    const range = maxHeight - minHeight;
    const ratio = (value - minHeight) / range;
    return height - padding.bottom - ratio * (height - padding.top - padding.bottom);
  };

  const sampler = buildTideCycleSampler(points, currentPoint, tideEvents, chartStartDateTime);
  const sampleStepMinutes = 10;
  const sampledCoordinates = [];
  for (let minutes = DAY_START_MINUTES; minutes <= DAY_END_MINUTES; minutes += sampleStepMinutes) {
    const sampleTime = minutes === DAY_END_MINUTES ? DAY_END_MINUTES - 1 : minutes;
    sampledCoordinates.push({
      x: padding.left + (minutes / DAY_END_MINUTES) * (width - padding.left - padding.right),
      y: toY(sampler.sample(sampleTime))
    });
  }

  const line = buildSmoothPath(sampledCoordinates);

  const baseline = height - padding.bottom;
  const area = `${line} L ${sampledCoordinates[sampledCoordinates.length - 1].x} ${baseline} L ${sampledCoordinates[0].x} ${baseline} Z`;
  const currentMinutes = chartMinuteOffset(currentPoint.time, chartStartDateTime) ?? DAY_START_MINUTES;
  const current = {
    x: toTimeX(currentPoint.time) ?? padding.left,
    y: toY(sampler.sample(currentMinutes))
  };
  const eventMarkers = tideEvents.map((event) => ({
    ...event,
    x: toTimeX(event.sourceTime || event.time) ?? padding.left,
    y: toY(sampler.sample(chartMinuteOffset(event.sourceTime || event.time, chartStartDateTime) ?? DAY_START_MINUTES))
  }));

  return {
    width,
    height,
    padding,
    minHeight,
    maxHeight,
    coordinates: sampledCoordinates,
    line,
    area,
    current,
    eventMarkers
  };
}

function TideChart({ points, currentPoint, tideEvents, chartStartDateTime, markerLabel = "now" }) {
  const geometry = getChartGeometry(points, currentPoint, tideEvents, chartStartDateTime);
  const heightLabelStep = Math.max(1, Math.ceil((geometry.maxHeight - geometry.minHeight) / 4));
  const heightLabels = [];
  for (let height = geometry.maxHeight; height >= geometry.minHeight; height -= heightLabelStep) {
    heightLabels.push(height);
  }
  if (!heightLabels.includes(geometry.minHeight)) heightLabels.push(geometry.minHeight);
  const timeLabels = buildTimeTicks(chartStartDateTime).map((tick) => ({
    ...tick,
    x: geometry.padding.left + (tick.offset / DAY_END_MINUTES) * (geometry.width - geometry.padding.left - geometry.padding.right)
  }));

  return `
    <section class="chart-panel" aria-labelledby="chart-title">
      <div class="section-head">
        <h2 id="chart-title">Tide curve</h2>
      </div>
      <svg class="tide-chart" viewBox="0 0 ${geometry.width} ${geometry.height}" role="img" aria-label="24 hour tide height chart with ${markerLabel}, high tide, and low tide marked.">
        <defs>
          <linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1aa8ff" stop-opacity="0.46" />
            <stop offset="100%" stop-color="#1aa8ff" stop-opacity="0.03" />
          </linearGradient>
          <filter id="lineGlow" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x="0" y="0" width="${geometry.width}" height="${geometry.height}" rx="24" fill="rgba(3, 13, 24, .72)" />
        ${heightLabels.map((height) => {
          const y = geometry.height - geometry.padding.bottom - ((height - geometry.minHeight) / (geometry.maxHeight - geometry.minHeight)) * (geometry.height - geometry.padding.top - geometry.padding.bottom);
          return `
            <line x1="${geometry.padding.left}" x2="${geometry.width - geometry.padding.right}" y1="${y}" y2="${y}" class="grid-line" />
            <text x="18" y="${y + 4}" class="axis-label">${height} ft</text>
          `;
        }).join("")}
        ${timeLabels.map((tick) => `
          <line x1="${tick.x}" x2="${tick.x}" y1="${geometry.padding.top}" y2="${geometry.height - geometry.padding.bottom}" class="time-grid-line" />
        `).join("")}
        <path d="${geometry.area}" fill="url(#tideFill)" />
        <path d="${geometry.line}" class="tide-line" filter="url(#lineGlow)" />
        ${geometry.eventMarkers.map((event) => `
          <circle cx="${event.x}" cy="${event.y}" r="8.5" class="event-dot ${event.type.toLowerCase()}-dot" />
          <text x="${event.x}" y="${event.type === "HIGH" ? event.y - 15 : event.y + 25}" class="event-label ${event.type.toLowerCase()}-label" text-anchor="middle">${event.type}</text>
        `).join("")}
        <line x1="${geometry.current.x}" x2="${geometry.current.x}" y1="${geometry.padding.top}" y2="${geometry.height - geometry.padding.bottom}" class="current-line" />
        <text x="${geometry.current.x + 10}" y="${geometry.padding.top + 14}" class="now-label">${markerLabel}</text>
        <circle cx="${geometry.current.x}" cy="${geometry.current.y}" r="7.5" class="current-dot" />
        ${timeLabels.map((tick, index) => `
          <text x="${tick.x}" y="${geometry.height - 12}" class="time-label" text-anchor="${index === 0 ? "start" : index === timeLabels.length - 1 ? "end" : "middle"}">${tick.label}</text>
        `).join("")}
      </svg>
    </section>
  `;
}

function TideEventCards({ events }) {
  return `
    <section class="tide-events ${events.length > 2 ? "multi" : ""}" aria-label="High and low tide events">
      ${events.map((event) => `
        <article class="tide-event-card ${event.type.toLowerCase()}">
          <p>${event.type}</p>
          <strong>${event.time}</strong>
          <span>${event.height}</span>
        </article>
      `).join("")}
    </section>
  `;
}

function TideDashboard(data) {
  const directionIcon = data.tideDirection === "RISING" ? "risingArrow" : "fallingArrow";

  return `
    <section class="dashboard-card ${data.isToday ? "" : "future-date"}" aria-label="${data.isToday ? "Current" : "Future"} TideIQ conditions">
      <header class="dashboard-header">
        <div>
          <p class="brand">TideIQ</p>
          <p class="location">${data.location}</p>
        </div>
        <div class="header-meta">
          <time datetime="${data.currentTime}">${data.currentTime}</time>
          <nav class="date-browser" aria-label="Choose tide date">
            <span class="date-context">${data.isToday ? "Today" : formatSelectedDate(data.selectedDate, { month: "short", day: "numeric" })}</span>
            <button class="date-step" type="button" data-date-step="-1" aria-label="Previous day" ${data.isToday ? "disabled" : ""}>‹</button>
            <label class="date-picker-wrap" title="Choose date">
              <span class="sr-only">Tide date</span>
              <input id="tide-date" class="date-picker" type="date" value="${data.selectedDate}" min="${data.minDate}" max="${data.maxDate}" />
            </label>
            <button class="date-step" type="button" data-date-step="1" aria-label="Next day" ${data.isMaxDate ? "disabled" : ""}>›</button>
          </nav>
        </div>
      </header>

      ${data.isToday ? `
        <section class="tide-status" aria-label="${data.referenceLabel} status">
          <div>
            <p class="status-label">${data.referenceLabel}</p>
            <div class="status-row">
              <strong>${data.tideDirection}</strong>
              ${createIcon(directionIcon, "direction-icon")}
            </div>
          </div>
          <div class="height-readout">
            <span>${data.currentTideHeight}</span>
          </div>
        </section>

      ` : ""}

      <div class="next-tide-row">
        ${data.isToday ? `<p class="next-tide">Next: <strong class="${data.nextTide.type.toLowerCase()}">${data.nextTide.type}</strong> ${data.nextTide.time}</p>` : ""}
        <p class="tide-station" title="NOAA Station ${data.station.id}: ${data.station.name}">Station: <strong>${data.station.name.split(",")[0]}</strong></p>
      </div>

      <div class="dashboard-lower">
        ${TideChart({ points: data.tidePoints, currentPoint: data.currentPoint, tideEvents: data.tideEvents, chartStartDateTime: data.chartStartDateTime, markerLabel: data.chartMarkerLabel })}
        <div class="tide-summary">
          ${TideEventCards({ events: data.tideEvents })}
          <footer class="dashboard-footer">
            <span>Updated ${data.updatedAt}</span>
          </footer>
        </div>
      </div>
    </section>
  `;
}

function HourlyConditionCard(condition) {
  return `
    <article class="hourly-card" aria-label="${condition.time}: ${condition.condition}, ${condition.temperature}, wind ${condition.windSpeed}">
      <time>${condition.time}</time>
      ${createIcon("storm", "weather-icon")}
      <strong>${condition.temperature}</strong>
      <span>${condition.windSpeed}</span>
    </article>
  `;
}

function HourlyConditionsBar({ hourlyConditions }) {
  return `
    <section class="hourly-section" aria-labelledby="hourly-title">
      <div class="section-head">
        <h2 id="hourly-title">Hourly Conditions</h2>
        <span>Swipe</span>
      </div>
      <div class="hourly-scroll" tabindex="0" aria-label="Scrollable hourly weather conditions">
        ${hourlyConditions.map(HourlyConditionCard).join("")}
      </div>
    </section>
  `;
}

function DailyForecastPanel(data) {
  const dateLabel = formatSelectedDate(data.selectedDate, { weekday: "short", month: "short", day: "numeric" });
  let content = `
    <div class="forecast-empty">
      <strong>Forecast unavailable</strong>
      <span>Daily weather is available up to 16 days ahead.</span>
    </div>
  `;

  if (data.forecastLoading) {
    content = `
      <div class="forecast-empty" aria-live="polite">
        <strong>Loading forecast…</strong>
      </div>
    `;
  } else if (data.dailyForecast) {
    const forecast = data.dailyForecast;
    content = `
      <article class="daily-forecast-card" aria-label="${dateLabel}: ${forecast.label}, high ${forecast.high} degrees, low ${forecast.low} degrees">
        <div class="forecast-condition">
          <span class="forecast-icon" aria-hidden="true">${forecast.icon}</span>
          <div>
            <strong>${forecast.label}</strong>
            <span>${dateLabel}</span>
          </div>
        </div>
        <div class="forecast-temperatures">
          <div><span>High</span><strong>${forecast.high}°</strong></div>
          <div><span>Low</span><strong>${forecast.low}°</strong></div>
        </div>
        <div class="forecast-details">
          <span><strong>${forecast.precipitation}%</strong> rain</span>
          <span><strong>${forecast.wind} mph</strong> max wind</span>
        </div>
      </article>
    `;
  }

  return `
    <section class="daily-section" aria-labelledby="daily-title">
      <div class="section-head">
        <h2 id="daily-title">Daily Forecast</h2>
        <a class="forecast-source" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>
      </div>
      ${content}
    </section>
  `;
}

let stationToday = formatDateKey(getStationDateParts());
let maxForecastDate = addDaysToDateKey(stationToday, FUTURE_RANGE_DAYS);
let selectedDate = stationToday;
let refreshSequence = 0;
let refreshTimer = null;

function syncStationDate() {
  const nextStationToday = formatDateKey(getStationDateParts());
  if (nextStationToday === stationToday) return;

  if (selectedDate === stationToday) selectedDate = nextStationToday;
  stationToday = nextStationToday;
  maxForecastDate = addDaysToDateKey(stationToday, FUTURE_RANGE_DAYS);
}

function withDateContext(data) {
  syncStationDate();
  const isToday = selectedDate === stationToday;
  const stationNow = getStationDateParts();
  const defaultChartStart = isToday
    ? `${stationToday} ${String(stationNow.hour).padStart(2, "0")}:${String(stationNow.minute).padStart(2, "0")}`
    : `${selectedDate} 00:00`;
  const chartStartDateTime = data.chartStartDateTime || defaultChartStart;
  const contextualData = {
    ...data,
    selectedDate,
    selectedDateLabel: formatSelectedDate(selectedDate, { weekday: "long", month: "long", day: "numeric" }),
    minDate: stationToday,
    maxDate: maxForecastDate,
    isToday,
    isMaxDate: selectedDate === maxForecastDate,
    referenceLabel: isToday ? "Current tide" : "Tide at noon",
    chartMarkerLabel: isToday ? "now" : "noon",
    chartStartDateTime,
    chartEndDateTime: data.chartEndDateTime || addMinutesToStationDateTime(chartStartDateTime, DAY_END_MINUTES)
  };

  return isToday ? applyCurrentMarker(contextualData) : contextualData;
}

async function loadTideIqData() {
  const displayTime = getDisplayTime();

  try {
    const liveData = await getLiveTideData(tideIqData, selectedDate);
    let dailyForecast = null;
    if (!liveData.isToday) {
      try {
        dailyForecast = await fetchDailyForecast(selectedDate);
      } catch (forecastError) {
        console.error("TideIQ daily forecast refresh failed.", forecastError);
      }
    }
    return withDateContext({
      ...liveData,
      currentTime: displayTime,
      updatedAt: liveData.isToday ? displayTime : `${displayTime} · NOAA prediction`,
      dailyForecast,
      forecastLoading: false,
      hourlyConditions: buildCurrentHourlyConditions(liveData.hourlyConditions)
    });
  } catch (error) {
    console.error("TideIQ NOAA refresh failed; using mock fallback.", error);
    return withDateContext({
      ...tideIqData,
      currentTime: displayTime,
      updatedAt: `${displayTime} fallback`,
      dailyForecast: null,
      forecastLoading: false,
      hourlyConditions: buildCurrentHourlyConditions(tideIqData.hourlyConditions)
    });
  }
}

function getFallbackTideIqData() {
  const displayTime = getDisplayTime();
  return withDateContext({
    ...tideIqData,
    currentTime: displayTime,
    updatedAt: `${displayTime} loading`,
    dailyForecast: null,
    forecastLoading: false,
    hourlyConditions: buildCurrentHourlyConditions(tideIqData.hourlyConditions)
  });
}

function render(data) {
  app.innerHTML = `
    <div class="ambient" aria-hidden="true"></div>
    <div class="content-stack">
      ${TideDashboard(data)}
      ${data.isToday ? HourlyConditionsBar({ hourlyConditions: data.hourlyConditions }) : DailyForecastPanel(data)}
    </div>
  `;
}

async function refreshDashboard() {
  const sequence = ++refreshSequence;
  const data = await loadTideIqData();
  if (sequence !== refreshSequence) return;
  render(data);
}

function scheduleNextRefresh() {
  window.clearTimeout(refreshTimer);
  const delayUntilNextMinute = REFRESH_INTERVAL_MS - (Date.now() % REFRESH_INTERVAL_MS) + 100;
  refreshTimer = window.setTimeout(async () => {
    await refreshDashboard();
    scheduleNextRefresh();
  }, delayUntilNextMinute);
}

function refreshAfterResume() {
  if (document.hidden) return;
  refreshDashboard();
  scheduleNextRefresh();
}

function selectDate(nextDate) {
  if (nextDate < stationToday || nextDate > maxForecastDate || nextDate === selectedDate) return;
  selectedDate = nextDate;
  render(withDateContext({
    ...tideIqData,
    currentTime: getDisplayTime(),
    updatedAt: "Loading NOAA prediction",
    dailyForecast: null,
    forecastLoading: true,
    hourlyConditions: buildCurrentHourlyConditions(tideIqData.hourlyConditions)
  }));
  refreshDashboard();
}

app.addEventListener("click", (event) => {
  const stepButton = event.target.closest("[data-date-step]");
  if (stepButton) selectDate(addDaysToDateKey(selectedDate, Number(stepButton.dataset.dateStep)));
});

app.addEventListener("change", (event) => {
  if (event.target.matches("#tide-date")) selectDate(event.target.value);
});

document.addEventListener("visibilitychange", refreshAfterResume);
window.addEventListener("focus", refreshAfterResume);

render(getFallbackTideIqData());
refreshDashboard();
scheduleNextRefresh();
