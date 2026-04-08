import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/app.js";

test("serves the app shell", async () => {
  const app = createApp();
  const response = await request(app).get("/");

  assert.equal(response.status, 200);
  assert.match(response.text, /Apartment Compare/i);
});

test("serves gallery and floor-plan review controls in the app shell", async () => {
  const app = createApp();
  const response = await request(app).get("/");

  assert.equal(response.status, 200);
  assert.match(response.text, /Photo Gallery/i);
  assert.match(response.text, /Analyze Photos for Floor Plan/i);
  assert.match(response.text, /Extracted bedroom sizes never save automatically/i);
});
