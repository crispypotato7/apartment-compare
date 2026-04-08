function roomSortValue(label, index) {
  const match = String(label || "").match(/(\d+)/);
  if (match) {
    return Number(match[1]);
  }

  return 1000 + index;
}

export function normalizePhotoUrls({ imageUrl = "", photoUrls = [] } = {}) {
  const urls = [];

  for (const value of [imageUrl, ...(photoUrls || [])]) {
    const url = String(value || "").trim();
    if (!url || urls.includes(url)) {
      continue;
    }
    urls.push(url);
  }

  return urls;
}

export function getDetectedBedroomRooms(floorPlanAnalysis) {
  const rooms = Array.isArray(floorPlanAnalysis?.rooms) ? floorPlanAnalysis.rooms : [];

  return rooms
    .map((room, index) => ({ room, index }))
    .filter(({ room }) => {
      const label = String(room?.label || "");
      return /bed(room)?|primary|master/i.test(label) && Number(room?.areaSquareFeet) > 0;
    })
    .sort((left, right) => roomSortValue(left.room.label, left.index) - roomSortValue(right.room.label, right.index))
    .map(({ room }) => room);
}

export function applyFloorPlanBedrooms({
  bedroomCount = 0,
  existingBedrooms = [],
  floorPlanAnalysis = null
} = {}) {
  const detectedBedrooms = getDetectedBedroomRooms(floorPlanAnalysis);
  const totalBedrooms = Math.max(Number(bedroomCount) || 0, detectedBedrooms.length);

  return Array.from({ length: totalBedrooms }, (_value, index) => ({
    name: existingBedrooms[index]?.name || `Bedroom ${index + 1}`,
    squareFootage: detectedBedrooms[index]?.areaSquareFeet ?? existingBedrooms[index]?.squareFootage ?? null
  }));
}

export function formatRoomDimensions(room) {
  if (!room || room.widthFeet == null || room.heightFeet == null) {
    return "";
  }

  const widthInches = Number(room.widthInches || 0);
  const heightInches = Number(room.heightInches || 0);
  return `${room.widthFeet}'${widthInches}" x ${room.heightFeet}'${heightInches}"`;
}
