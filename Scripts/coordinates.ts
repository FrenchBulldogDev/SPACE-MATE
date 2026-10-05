type CoordinateInput = number | string;
type CoordinateAxis = "latitude" | "longitude";

function parseCoordinate(value: CoordinateInput, axis: CoordinateAxis): number | null {
  const maxDegrees = axis === "latitude" ? 90 : 180;
  if (typeof value === "number") {
    return Number.isFinite(value) && Math.abs(value) <= maxDegrees ? value : null;
  }

  const normalized = value.trim().toUpperCase();
  const prefixMatch = normalized.match(/^(NORTH|SOUTH|EAST|WEST|N|S|E|W)\b\s*/);
  const suffixMatch = normalized.match(/\b(NORTH|SOUTH|EAST|WEST|N|S|E|W)$/);
  const direction = prefixMatch?.[1] ?? suffixMatch?.[1];
  let coordinateText = prefixMatch
    ? normalized.slice(prefixMatch[0].length)
    : suffixMatch
      ? normalized.slice(0, suffixMatch.index).trim()
      : normalized;

  const isLatitude = axis === "latitude";
  const positiveDirection = isLatitude ? ["N", "NORTH"] : ["E", "EAST"];
  const negativeDirection = isLatitude ? ["S", "SOUTH"] : ["W", "WEST"];
  if (direction && !positiveDirection.includes(direction) && !negativeDirection.includes(direction)) {
    return null;
  }

  coordinateText = coordinateText.replace(/[\u00B0\u00BA\u02DA\u0027\u2019\u2032\u0022\u201D\u2033:]/g, " ").trim();
  const parts = coordinateText.split(/\s+/);
  if (
    parts.length < 1 ||
    parts.length > 3 ||
    parts.some((part) => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(part))
  ) {
    return null;
  }

  const [degrees = 0, minutes = 0, seconds = 0] = parts.map(Number);
  if (minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) {
    return null;
  }

  const magnitude = Math.abs(degrees) + minutes / 60 + seconds / 3600;
  if (magnitude > maxDegrees || (magnitude === maxDegrees && (minutes !== 0 || seconds !== 0))) {
    return null;
  }

  if (direction) {
    const directionIsNegative = negativeDirection.includes(direction);
    if ((degrees < 0 && !directionIsNegative) || (degrees > 0 && directionIsNegative)) {
      return null;
    }
    return directionIsNegative ? -magnitude : magnitude;
  }

  return degrees < 0 ? -magnitude : magnitude;
}

function EarthCoordinates(latitude: number, longitude: number): { x: number; y: number } {
  return {
    x: (longitude + 180) / 360,
    y: (90 - latitude) / 180,
  };
}

function MoonCoordinates(latitude: number, longitude: number): { x: number; y: number } {
  return {
    x: (longitude + 180) / 360,
    y: (90 - latitude) / 180,
  };
}


function drawCoordinates(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  latitudeInput: CoordinateInput,
  longitudeInput: CoordinateInput,
  type: "moon" | "earth"
): void {
  const latitude = parseCoordinate(latitudeInput, "latitude");
  const longitude = parseCoordinate(longitudeInput, "longitude");
  if (
    latitude === null ||
    longitude === null ||
    width <= 0 ||
    height <= 0
  ) {
    return;
  }

  const equatorY = height / 2;
  const primeMeridianX = width / 2;
  ctx.strokeStyle = "red";
  ctx.beginPath();
  ctx.moveTo(0, equatorY);
  ctx.lineTo(width, equatorY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(primeMeridianX, 0);
  ctx.lineTo(primeMeridianX, height);
  ctx.stroke();

  const coordinates = type === "moon"
    ? MoonCoordinates(latitude, longitude)
    : EarthCoordinates(latitude, longitude);
  const radius = 5;
  ctx.beginPath();
  ctx.fillStyle = "red";
  ctx.arc(coordinates.x * width, coordinates.y * height, radius, 0, Math.PI * 2);
  ctx.fill();
}