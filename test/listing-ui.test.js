import test from "node:test";
import assert from "node:assert/strict";

import {
  applyFloorPlanBedrooms,
  normalizePhotoUrls
} from "../public/listing-ui.js";

test("normalizes gallery photo urls with the primary image first and no duplicates", () => {
  const photoUrls = normalizePhotoUrls({
    imageUrl: "https://photos.zillowstatic.com/fp/cover.jpg",
    photoUrls: [
      "https://photos.zillowstatic.com/fp/gallery-1.jpg",
      "https://photos.zillowstatic.com/fp/cover.jpg",
      "",
      "https://photos.zillowstatic.com/fp/gallery-2.jpg"
    ]
  });

  assert.deepEqual(photoUrls, [
    "https://photos.zillowstatic.com/fp/cover.jpg",
    "https://photos.zillowstatic.com/fp/gallery-1.jpg",
    "https://photos.zillowstatic.com/fp/gallery-2.jpg"
  ]);
});

test("maps extracted floor-plan bedrooms onto the current bedroom rows", () => {
  const bedrooms = applyFloorPlanBedrooms({
    bedroomCount: 3,
    existingBedrooms: [
      { name: "Primary", squareFootage: null },
      { name: "Office", squareFootage: 88 }
    ],
    floorPlanAnalysis: {
      isLikelyFloorPlan: true,
      rooms: [
        { label: "BEDROOM 1", areaSquareFeet: 126 },
        { label: "KITCHEN", areaSquareFeet: 90 },
        { label: "BEDROOM 2", areaSquareFeet: 110 },
        { label: "BEDROOM 3", areaSquareFeet: 101 }
      ]
    }
  });

  assert.deepEqual(bedrooms, [
    { name: "Primary", squareFootage: 126 },
    { name: "Office", squareFootage: 110 },
    { name: "Bedroom 3", squareFootage: 101 }
  ]);
});
