import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/app.js";
import { createDatabase } from "../src/db/database.js";

test("lists apartments for comparison", async () => {
  const db = createDatabase(":memory:");
  db.saveApartment({
    address: "1234 W Example St, Chicago, IL 60647",
    neighborhood: "Logan Square",
    bedroomsCount: 3,
    bathroomsCount: 2,
    totalSquareFootage: 1800,
    monthlyRent: 4200,
    bedrooms: [
      { name: "Bedroom 1", squareFootage: 220 },
      { name: "Bedroom 2", squareFootage: 180 },
      { name: "Bedroom 3", squareFootage: 160 }
    ]
  });

  const app = createApp({ db });
  const response = await request(app).get("/api/apartments");

  assert.equal(response.status, 200);
  assert.equal(response.body.apartments.length, 1);
  assert.equal(response.body.apartments[0].rentShares.length, 3);
  assert.equal(response.body.apartments[0].address, "1234 W Example St, Chicago, IL 60647");
});

test("stores custom factors and apartment values", async () => {
  const db = createDatabase(":memory:");
  const app = createApp({ db });

  const customFieldResponse = await request(app)
    .post("/api/custom-fields")
    .send({
      key: "sunlight",
      label: "Sunlight",
      valueType: "text"
    });

  assert.equal(customFieldResponse.status, 201);

  const apartmentResponse = await request(app)
    .post("/api/apartments")
    .send({
      address: "5678 N Sample Ave, Chicago, IL 60618",
      neighborhood: "North Center",
      bedroomsCount: 4,
      bathroomsCount: 2,
      totalSquareFootage: 2100,
      monthlyRent: 5200,
      customValues: {
        sunlight: "South-facing living room"
      }
    });

  assert.equal(apartmentResponse.status, 201);
  assert.equal(apartmentResponse.body.apartment.customValues.sunlight, "South-facing living room");

  const listResponse = await request(app).get("/api/custom-fields");

  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.customFields.length, 1);
  assert.equal(listResponse.body.customFields[0].key, "sunlight");
});

test("stores gallery photo urls and deletes saved listings", async () => {
  const db = createDatabase(":memory:");
  const app = createApp({ db });

  const createResponse = await request(app)
    .post("/api/apartments")
    .send({
      address: "1240 W Cottage Pl, Chicago, IL 60607",
      neighborhood: "Near West Side",
      bedroomsCount: 3,
      bathroomsCount: 3,
      monthlyRent: 4800,
      imageUrl: "https://photos.zillowstatic.com/fp/main-photo.jpg",
      photoUrls: [
        "https://photos.zillowstatic.com/fp/main-photo.jpg",
        "https://photos.zillowstatic.com/fp/floorplan-photo.jpg"
      ]
    });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.apartment.photoUrls.length, 2);

  const deleteResponse = await request(app).delete(`/api/apartments/${createResponse.body.apartment.id}`);
  assert.equal(deleteResponse.status, 204);

  const listResponse = await request(app).get("/api/apartments");
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.apartments.length, 0);
});

test("analyzes floor plan photos through the API", async () => {
  const db = createDatabase(":memory:");
  const floorPlanService = {
    analyzeFloorPlans: async () => ({
      selectedPhotoUrl: "https://photos.zillowstatic.com/fp/floorplan-photo.jpg",
      analysis: {
        isLikelyFloorPlan: true,
        rooms: [
          {
            label: "BEDROOM 1",
            widthFeet: 12,
            widthInches: 0,
            heightFeet: 10,
            heightInches: 6,
            areaSquareFeet: 126
          }
        ]
      }
    })
  };
  const app = createApp({ db, floorPlanService });

  const response = await request(app)
    .post("/api/floorplans/analyze")
    .send({
      photoUrls: [
        "https://photos.zillowstatic.com/fp/main-photo.jpg",
        "https://photos.zillowstatic.com/fp/floorplan-photo.jpg"
      ]
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.selectedPhotoUrl, "https://photos.zillowstatic.com/fp/floorplan-photo.jpg");
  assert.equal(response.body.analysis.rooms[0].label, "BEDROOM 1");
});
