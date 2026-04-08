function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function areaSquareFeet(widthFeet, widthInches, heightFeet, heightInches) {
  const width = widthFeet + (widthInches / 12);
  const height = heightFeet + (heightInches / 12);
  return Math.round(width * height);
}

function parseRoomMatch(match) {
  const [, rawLabel, widthFeet, widthInches = "0", heightFeet, heightInches = "0"] = match;
  return {
    label: rawLabel.trim().replace(/\s+/g, " ").toUpperCase(),
    widthFeet: Number(widthFeet),
    widthInches: Number(widthInches),
    heightFeet: Number(heightFeet),
    heightInches: Number(heightInches),
    areaSquareFeet: areaSquareFeet(Number(widthFeet), Number(widthInches), Number(heightFeet), Number(heightInches))
  };
}

export function analyzeFloorPlanText(rawText) {
  const text = normalizeWhitespace(rawText);
  const roomPattern = /\b([A-Z][A-Z0-9 /#.-]{2,}?)\s+(\d{1,2})[' ](?:\s*(\d{1,2}))?(?:["”]|IN)?\s*[xX]\s*(\d{1,2})[' ](?:\s*(\d{1,2}))?(?:["”]|IN)?\b/g;
  const rooms = [];

  let match;
  while ((match = roomPattern.exec(text.toUpperCase())) !== null) {
    rooms.push(parseRoomMatch(match));
  }

  const isLikelyFloorPlan =
    /floor ?plan|bedroom|bath|living|kitchen|closet/.test(text.toLowerCase()) &&
    rooms.length > 0;

  return {
    isLikelyFloorPlan,
    rooms,
    rawText: text
  };
}

async function recognizeImageText(photoUrl) {
  const response = await fetch(photoUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image ${photoUrl}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");

  try {
    const result = await worker.recognize(Buffer.from(arrayBuffer));
    return result.data.text || "";
  } finally {
    await worker.terminate();
  }
}

export async function analyzeFloorPlans(photoUrls = []) {
  const uniqueUrls = Array.from(new Set((photoUrls || []).filter(Boolean))).slice(0, 12);
  const attempts = [];

  for (const photoUrl of uniqueUrls) {
    try {
      const text = await recognizeImageText(photoUrl);
      const analysis = analyzeFloorPlanText(text);
      attempts.push({
        photoUrl,
        analysis
      });

      if (analysis.isLikelyFloorPlan) {
        return {
          selectedPhotoUrl: photoUrl,
          analysis,
          attempts
        };
      }
    } catch (error) {
      attempts.push({
        photoUrl,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    selectedPhotoUrl: null,
    analysis: {
      isLikelyFloorPlan: false,
      rooms: [],
      rawText: ""
    },
    attempts
  };
}
