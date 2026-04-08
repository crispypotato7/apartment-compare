import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDatabase } from "./db/database.js";
import { calculateWeightedBedroomRents } from "./lib/calc.js";
import { analyzeFloorPlans } from "./services/floorplan.js";
import { importZillowListing } from "./services/zillow.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

function escapeCsv(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function apartmentToCsvRow(apartment) {
  return [
    apartment.id,
    apartment.address,
    apartment.neighborhood,
    apartment.listingUrl,
    apartment.bedroomsCount,
    apartment.bathroomsCount,
    apartment.totalSquareFootage,
    apartment.monthlyRent,
    apartment.hasDen,
    apartment.washerDryerInUnit,
    apartment.petsAllowed,
    apartment.parking,
    apartment.imageUrl,
    apartment.notes,
    JSON.stringify(apartment.bedrooms || []),
    JSON.stringify(apartment.rentShares || []),
    JSON.stringify(apartment.commutes || {}),
    JSON.stringify(apartment.customValues || {})
  ].map(escapeCsv).join(",");
}

function serializeApartment(apartment) {
  return {
    ...apartment,
    rentShares: calculateWeightedBedroomRents(apartment)
  };
}

export function createApp(options = {}) {
  const app = express();
  const db = options.db || createDatabase(":memory:");
  const floorPlanService = options.floorPlanService || { analyzeFloorPlans };

  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(publicDir));

  app.get("/api/apartments", (_request, response) => {
    const apartments = db.listApartments().map(serializeApartment);
    response.json({ apartments });
  });

  app.get("/api/apartments/:id", (request, response) => {
    const apartment = db.getApartmentById(Number(request.params.id));
    if (!apartment) {
      response.status(404).json({ error: "Apartment not found" });
      return;
    }

    response.json({ apartment: serializeApartment(apartment) });
  });

  app.post("/api/apartments", (request, response) => {
    try {
      if (!request.body?.address) {
        response.status(400).json({ error: "Address is required" });
        return;
      }

      const apartment = db.saveApartment(request.body);
      response.status(201).json({ apartment: serializeApartment(apartment) });
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : "Failed to save apartment"
      });
    }
  });

  app.put("/api/apartments/:id", (request, response) => {
    try {
      const apartment = db.saveApartment({
        ...request.body,
        id: Number(request.params.id)
      });

      response.json({ apartment: serializeApartment(apartment) });
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : "Failed to update apartment"
      });
    }
  });

  app.delete("/api/apartments/:id", (request, response) => {
    db.deleteApartmentById(Number(request.params.id));
    response.status(204).end();
  });

  app.get("/api/custom-fields", (_request, response) => {
    response.json({ customFields: db.listCustomFields() });
  });

  app.post("/api/custom-fields", (request, response) => {
    try {
      const customField = db.createCustomField(request.body || {});
      response.status(201).json({ customField });
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : "Failed to save custom field"
      });
    }
  });

  app.get("/api/commute-targets", (_request, response) => {
    response.json({ commuteTargets: db.listCommuteTargets() });
  });

  app.get("/api/export/csv", (_request, response) => {
    const apartments = db.listApartments().map(serializeApartment);
    const header = [
      "id",
      "address",
      "neighborhood",
      "listingUrl",
      "bedroomsCount",
      "bathroomsCount",
      "totalSquareFootage",
      "monthlyRent",
      "hasDen",
      "washerDryerInUnit",
      "petsAllowed",
      "parking",
      "imageUrl",
      "notes",
      "bedroomsJson",
      "rentSharesJson",
      "commutesJson",
      "customValuesJson"
    ].join(",");

    const csv = [header, ...apartments.map(apartmentToCsvRow)].join("\n");
    response.setHeader("content-type", "text/csv; charset=utf-8");
    response.setHeader("content-disposition", 'attachment; filename="apartments.csv"');
    response.send(csv);
  });

  app.post("/api/import/zillow", async (request, response) => {
    try {
      const listing = await importZillowListing({
        url: request.body?.url,
        html: request.body?.html
      });

      response.json({ listing });
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : "Failed to import Zillow listing"
      });
    }
  });

  app.post("/api/floorplans/analyze", async (request, response) => {
    try {
      const result = await floorPlanService.analyzeFloorPlans(request.body?.photoUrls || []);
      response.json(result);
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : "Failed to analyze floor plan photos"
      });
    }
  });

  app.use((_request, response) => {
    response.sendFile(path.join(publicDir, "index.html"));
  });

  return app;
}
