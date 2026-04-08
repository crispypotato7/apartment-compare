import test from "node:test";
import assert from "node:assert/strict";

import { calculateWeightedBedroomRents } from "../src/lib/calc.js";
import { createDatabase } from "../src/db/database.js";

test("weighted bedroom rents use bedroom sizes plus equal common-area share", () => {
  const shares = calculateWeightedBedroomRents({
    rent: 4200,
    totalSquareFootage: 1800,
    bedrooms: [
      { name: "Bedroom 1", squareFootage: 220 },
      { name: "Bedroom 2", squareFootage: 180 },
      { name: "Bedroom 3", squareFootage: 160 }
    ]
  });

  assert.equal(shares.length, 3);
  assert.deepEqual(
    shares.map((share) => ({
      name: share.name,
      rentShare: share.rentShare
    })),
    [
      { name: "Bedroom 1", rentShare: 1477.78 },
      { name: "Bedroom 2", rentShare: 1384.44 },
      { name: "Bedroom 3", rentShare: 1337.78 }
    ]
  );
});

test("persists apartments with bedroom details in sqlite", () => {
  const db = createDatabase(":memory:");

  const saved = db.saveApartment({
    listingUrl: "https://www.zillow.com/homedetails/example",
    address: "1234 W Example St, Chicago, IL 60647",
    neighborhood: "Logan Square",
    bedroomsCount: 3,
    bathroomsCount: 2,
    totalSquareFootage: 1800,
    monthlyRent: 4200,
    hasDen: 1,
    washerDryerInUnit: 1,
    petsAllowed: 1,
    parking: "Street permit",
    bedrooms: [
      { name: "Bedroom 1", squareFootage: 220 },
      { name: "Bedroom 2", squareFootage: 180 },
      { name: "Bedroom 3", squareFootage: 160 }
    ]
  });

  const apartment = db.getApartmentById(saved.id);

  assert.equal(apartment.address, "1234 W Example St, Chicago, IL 60647");
  assert.equal(apartment.bedroomsCount, 3);
  assert.equal(apartment.monthlyRent, 4200);
  assert.equal(apartment.bedrooms.length, 3);
  assert.equal(apartment.bedrooms[0].name, "Bedroom 1");
  assert.equal(apartment.bedrooms[0].squareFootage, 220);
});
