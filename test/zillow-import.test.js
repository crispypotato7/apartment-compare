import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import request from "supertest";

import { parseZillowListingHtml } from "../src/services/zillow.js";
import { importZillowListing } from "../src/services/zillow.js";
import { createApp } from "../src/app.js";

const fixtureHtml = fs.readFileSync(new URL("./fixtures/zillow-listing.html", import.meta.url), "utf8");
const liveShapeFixtureHtml = fs.readFileSync(new URL("./fixtures/zillow-live-shape.html", import.meta.url), "utf8");
const liveZillowUrl = "https://www.zillow.com/homedetails/1240-W-Cottage-Pl-Chicago-IL-60607/60270289_zpid/?utm_campaign=iosappmessage&utm_medium=referral&utm_source=txtshare";

test("imports Zillow listing data from fixture html", () => {
  const listing = parseZillowListingHtml(fixtureHtml, "https://www.zillow.com/homedetails/1234-W-Example-St-Chicago-IL-60647/123456_zpid/");

  assert.equal(listing.address, "1234 W Example St, Chicago, IL 60647");
  assert.equal(listing.neighborhood, "Logan Square");
  assert.equal(listing.bedroomsCount, 3);
  assert.equal(listing.bathroomsCount, 2.5);
  assert.equal(listing.totalSquareFootage, 1800);
  assert.equal(listing.monthlyRent, 4200);
  assert.equal(listing.washerDryerInUnit, 1);
  assert.equal(listing.petsAllowed, 1);
  assert.equal(listing.parking, "Detached garage");
  assert.match(listing.imageUrl, /zillowstatic/);
  assert.equal(listing.photoUrls.length, 1);
});

test("imports Zillow listing data through the API", async () => {
  const app = createApp();
  const response = await request(app)
    .post("/api/import/zillow")
    .send({
      url: "https://www.zillow.com/homedetails/1234-W-Example-St-Chicago-IL-60647/123456_zpid/",
      html: fixtureHtml
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.listing.address, "1234 W Example St, Chicago, IL 60647");
  assert.equal(response.body.listing.monthlyRent, 4200);
});

test("imports Zillow listing data from Zillow's gdpClientCache shape with neighborhood fallback", () => {
  const listing = parseZillowListingHtml(liveShapeFixtureHtml, liveZillowUrl);

  assert.equal(listing.address, "1240 W Cottage Pl, Chicago, IL 60607");
  assert.equal(listing.neighborhood, "Near West Side");
  assert.equal(listing.monthlyRent, 4800);
  assert.equal(listing.bedroomsCount, 3);
  assert.equal(listing.bathroomsCount, 3);
  assert.equal(listing.washerDryerInUnit, 1);
  assert.equal(listing.petsAllowed, 1);
  assert.match(String(listing.parking || ""), /garage/i);
  assert.match(String(listing.imageUrl || ""), /zillowstatic/);
  assert.equal(listing.photoUrls.length, 1);
});

test("imports Zillow listing data from the live listing URL", {
  skip: !process.env.LIVE_ZILLOW_TEST,
  timeout: 30_000
}, async () => {
  let listing;

  try {
    listing = await importZillowListing({
      url: process.env.LIVE_ZILLOW_URL || liveZillowUrl
    });
  } catch (error) {
    assert.match(
      error instanceof Error ? error.message : String(error),
      /captcha/i
    );
    return;
  }

  assert.equal(listing.address, "1240 W Cottage Pl, Chicago, IL 60607");
  assert.equal(listing.monthlyRent, 4800);
  assert.equal(listing.bedroomsCount, 3);
  assert.equal(listing.bathroomsCount, 3);
  assert.equal(listing.washerDryerInUnit, 1);
  assert.equal(listing.petsAllowed, 1);
  assert.match(String(listing.parking || ""), /garage/i);
  assert.ok(listing.imageUrl);
  assert.ok(Array.isArray(listing.photoUrls));
  assert.ok(listing.photoUrls.length >= 1);
});
