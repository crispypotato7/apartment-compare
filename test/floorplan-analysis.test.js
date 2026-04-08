import test from "node:test";
import assert from "node:assert/strict";

import { analyzeFloorPlanText } from "../src/services/floorplan.js";

test("extracts room dimensions from OCR-like floor plan text", () => {
  const analysis = analyzeFloorPlanText(`
    FLOOR PLAN
    BEDROOM 1 12'0" x 10'6"
    BEDROOM 2 11'0" x 10'0"
    BEDROOM 3 10'8" x 9'4"
    LIVING ROOM 18'0" x 14'0"
  `);

  assert.equal(analysis.isLikelyFloorPlan, true);
  assert.equal(analysis.rooms.length, 4);
  assert.deepEqual(analysis.rooms[0], {
    label: "BEDROOM 1",
    widthFeet: 12,
    widthInches: 0,
    heightFeet: 10,
    heightInches: 6,
    areaSquareFeet: 126
  });
});
