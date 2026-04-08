import test from "node:test";
import assert from "node:assert/strict";

import { buildComparisonCards } from "../public/comparison.js";

test("builds grouped comparison cards that stay readable without a wide table", () => {
  const cards = buildComparisonCards({
    apartments: [
      {
        id: 1,
        address: "1234 W Example St, Chicago, IL 60647",
        neighborhood: "Logan Square",
        monthlyRent: 4200,
        bedroomsCount: 3,
        bathroomsCount: 2,
        totalSquareFootage: 1800,
        washerDryerInUnit: 1,
        petsAllowed: 1,
        parking: "Garage",
        hasDen: 0,
        rentShares: [
          { name: "Bedroom 1", rentShare: 1477.78 },
          { name: "Bedroom 2", rentShare: 1384.44 }
        ],
        commutes: {
          oak_park: { minutes: 40 }
        },
        customValues: {
          sunlight: "Great south light"
        }
      }
    ],
    commuteTargets: [
      { key: "oak_park", label: "Oak Park" }
    ],
    customFields: [
      { key: "sunlight", label: "Sunlight" }
    ]
  });

  assert.equal(cards.length, 1);
  assert.equal(cards[0].title, "1234 W Example St, Chicago, IL 60647");
  assert.equal(cards[0].sections.length, 4);
  assert.equal(cards[0].sections[0].title, "Basics");
  assert.equal(cards[0].sections[1].rows[4].label, "Rent split");
  assert.equal(cards[0].sections[2].rows[0].value, "40 min");
  assert.equal(cards[0].sections[3].rows[0].value, "Great south light");
});
