import { buildComparisonCards } from "./comparison.js";
import {
  applyFloorPlanBedrooms,
  formatRoomDimensions,
  getDetectedBedroomRooms,
  normalizePhotoUrls
} from "./listing-ui.js";

const state = {
  apartments: [],
  customFields: [],
  commuteTargets: [],
  selectedIds: new Set(),
  editingId: null,
  draftPhotoUrls: [],
  floorPlanReview: null
};

const elements = {
  importForm: document.querySelector("#import-form"),
  importUrl: document.querySelector("#import-url"),
  importStatus: document.querySelector("#import-status"),
  apartmentForm: document.querySelector("#apartment-form"),
  apartmentId: document.querySelector("#apartment-id"),
  listingUrl: document.querySelector("#listing-url"),
  address: document.querySelector("#address"),
  neighborhood: document.querySelector("#neighborhood"),
  monthlyRent: document.querySelector("#monthly-rent"),
  bedroomsCount: document.querySelector("#bedrooms-count"),
  bathroomsCount: document.querySelector("#bathrooms-count"),
  totalSquareFootage: document.querySelector("#total-square-footage"),
  parking: document.querySelector("#parking"),
  imageUrl: document.querySelector("#image-url"),
  hasDen: document.querySelector("#has-den"),
  washerDryer: document.querySelector("#washer-dryer"),
  petsAllowed: document.querySelector("#pets-allowed"),
  notes: document.querySelector("#notes"),
  photoGallery: document.querySelector("#photo-gallery"),
  analyzeFloorplan: document.querySelector("#analyze-floorplan"),
  applyFloorplan: document.querySelector("#apply-floorplan"),
  floorplanStatus: document.querySelector("#floorplan-status"),
  floorplanPreview: document.querySelector("#floorplan-preview"),
  bedroomFields: document.querySelector("#bedroom-fields"),
  commuteFields: document.querySelector("#commute-fields"),
  customFactorFields: document.querySelector("#custom-factor-fields"),
  formStatus: document.querySelector("#form-status"),
  customFieldForm: document.querySelector("#custom-field-form"),
  customFieldKey: document.querySelector("#custom-field-key"),
  customFieldLabel: document.querySelector("#custom-field-label"),
  customFieldType: document.querySelector("#custom-field-type"),
  customFieldStatus: document.querySelector("#custom-field-status"),
  apartmentsList: document.querySelector("#apartments-list"),
  comparisonView: document.querySelector("#comparison-view"),
  resetForm: document.querySelector("#reset-form")
};

function setStatus(element, message, type = "") {
  element.textContent = message || "";
  element.className = `status ${type}`.trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function fetchJson(url, options) {
  const response = await fetch(url, {
    headers: {
      "content-type": "application/json"
    },
    ...options
  });

  if (!response.ok) {
    let errorMessage = "Request failed";
    try {
      const payload = await response.json();
      errorMessage = payload.error || errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function bedroomInputValues() {
  return Array.from(elements.bedroomFields.querySelectorAll(".bedroom-row")).map((row) => ({
    name: row.querySelector("[data-role='name']").value,
    squareFootage: row.querySelector("[data-role='sqft']").value
  }));
}

function renderBedroomFields(count = Number(elements.bedroomsCount.value || 0)) {
  const existing = bedroomInputValues();
  const normalizedCount = Math.max(0, Number(count) || 0);
  elements.bedroomFields.innerHTML = "";

  for (let index = 0; index < normalizedCount; index += 1) {
    const row = document.createElement("div");
    row.className = "bedroom-row";
    row.innerHTML = `
      <label>
        <span>Bedroom ${index + 1} name</span>
        <input data-role="name" value="${escapeHtml(existing[index]?.name || `Bedroom ${index + 1}`)}" />
      </label>
      <label>
        <span>Bedroom ${index + 1} sq ft</span>
        <input data-role="sqft" type="number" min="0" step="1" value="${escapeHtml(existing[index]?.squareFootage || "")}" />
      </label>
    `;
    elements.bedroomFields.append(row);
  }
}

function writeBedroomRows(bedrooms) {
  renderBedroomFields(bedrooms.length);
  Array.from(elements.bedroomFields.querySelectorAll(".bedroom-row")).forEach((row, index) => {
    row.querySelector("[data-role='name']").value = bedrooms[index]?.name || `Bedroom ${index + 1}`;
    row.querySelector("[data-role='sqft']").value = bedrooms[index]?.squareFootage ?? "";
  });
}

function renderCommuteFields() {
  elements.commuteFields.innerHTML = "";

  state.commuteTargets.forEach((target) => {
    const label = document.createElement("label");
    label.innerHTML = `
      <span>${escapeHtml(target.label)} (minutes)</span>
      <input data-commute-key="${escapeHtml(target.key)}" type="number" min="0" step="1" />
    `;
    elements.commuteFields.append(label);
  });
}

function renderCustomFactorFields() {
  elements.customFactorFields.innerHTML = "";

  if (state.customFields.length === 0) {
    elements.customFactorFields.innerHTML = `<p class="metric">No custom factors yet.</p>`;
    return;
  }

  state.customFields.forEach((field) => {
    const label = document.createElement("label");
    label.className = "custom-input-row";
    label.innerHTML = `
      <span>${escapeHtml(field.label)}</span>
      <input data-custom-key="${escapeHtml(field.key)}" placeholder="${escapeHtml(field.label)}" />
    `;
    elements.customFactorFields.append(label);
  });
}

function formatCurrency(value) {
  if (value == null || value === "") {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatBoolean(value) {
  return value ? "Yes" : "No";
}

function rentShareSummary(apartment) {
  if (!apartment.rentShares?.length) {
    return "Add bedroom sizes";
  }

  return apartment.rentShares
    .map((share) => `${share.name}: ${formatCurrency(share.rentShare)}`)
    .join(" | ");
}

function selectedApartments() {
  return state.apartments.filter((apartment) => state.selectedIds.has(apartment.id));
}

function renderComparison() {
  const apartments = selectedApartments();
  if (apartments.length === 0) {
    elements.comparisonView.className = "comparison-empty";
    elements.comparisonView.textContent = "Select apartments to compare.";
    return;
  }

  const cards = buildComparisonCards({
    apartments,
    commuteTargets: state.commuteTargets,
    customFields: state.customFields
  });

  const wrapper = document.createElement("div");
  wrapper.className = "comparison-card-grid";

  cards.forEach((card) => {
    const article = document.createElement("article");
    article.className = "comparison-card";
    article.innerHTML = `
      <header class="comparison-card-head">
        <h3>${escapeHtml(card.title)}</h3>
        <p class="metric">${escapeHtml(card.subtitle || "")}</p>
      </header>
      <div class="comparison-sections">
        ${card.sections.map((section) => `
          <section class="comparison-section">
            <h4>${escapeHtml(section.title)}</h4>
            <dl class="comparison-list">
              ${section.rows.map((row) => `
                <div class="comparison-item">
                  <dt>${escapeHtml(row.label)}</dt>
                  <dd>${escapeHtml(row.value)}</dd>
                </div>
              `).join("")}
            </dl>
          </section>
        `).join("")}
      </div>
    `;
    wrapper.append(article);
  });

  elements.comparisonView.className = "";
  elements.comparisonView.innerHTML = "";
  elements.comparisonView.append(wrapper);
}

function setDraftPhotos(photoUrls = [], preferredImageUrl = "") {
  state.draftPhotoUrls = normalizePhotoUrls({
    imageUrl: preferredImageUrl,
    photoUrls
  });

  elements.imageUrl.value = preferredImageUrl || state.draftPhotoUrls[0] || "";
  renderPhotoGallery();
}

function renderPhotoGallery() {
  state.draftPhotoUrls = normalizePhotoUrls({
    imageUrl: elements.imageUrl.value.trim(),
    photoUrls: state.draftPhotoUrls
  });

  if (!state.draftPhotoUrls.length) {
    elements.photoGallery.className = "photo-gallery-empty";
    elements.photoGallery.textContent = "Import a Zillow listing to load its photo gallery.";
    return;
  }

  if (!elements.imageUrl.value.trim()) {
    elements.imageUrl.value = state.draftPhotoUrls[0];
  }

  const selectedUrl = elements.imageUrl.value.trim();

  elements.photoGallery.className = "photo-gallery";
  elements.photoGallery.innerHTML = `
    <div class="photo-gallery-main">
      <img src="${escapeHtml(selectedUrl)}" alt="Selected apartment photo" />
    </div>
    <div class="photo-gallery-meta">
      <span class="badge">${state.draftPhotoUrls.length} photos</span>
      <span class="metric">The selected photo becomes the saved card cover image.</span>
    </div>
    <div class="photo-gallery-strip">
      ${state.draftPhotoUrls.map((photoUrl, index) => `
        <button
          class="thumbnail-button ${photoUrl === selectedUrl ? "is-selected" : ""}"
          type="button"
          data-photo-index="${index}"
          aria-label="Choose photo ${index + 1} as cover"
        >
          <img src="${escapeHtml(photoUrl)}" alt="Apartment photo ${index + 1}" />
        </button>
      `).join("")}
    </div>
  `;
}

function renderFloorPlanAnalysis() {
  const review = state.floorPlanReview;
  const analysis = review?.analysis || null;
  const detectedBedrooms = getDetectedBedroomRooms(analysis);
  elements.applyFloorplan.disabled = detectedBedrooms.length === 0;

  if (!analysis) {
    elements.floorplanPreview.className = "floorplan-empty";
    elements.floorplanPreview.textContent = "No floor plan analysis yet.";
    return;
  }

  const selectedPhotoUrl = review?.selectedPhotoUrl || analysis.selectedPhotoUrl || "";
  const attemptCount = Array.isArray(review?.attempts) ? review.attempts.length : 0;
  const likelyText = analysis.isLikelyFloorPlan ? "Likely floor plan detected" : "No clear floor plan found";

  elements.floorplanPreview.className = "floorplan-preview";
  elements.floorplanPreview.innerHTML = `
    ${selectedPhotoUrl ? `
      <div class="floorplan-photo">
        <img src="${escapeHtml(selectedPhotoUrl)}" alt="Detected floor plan candidate" />
      </div>
    ` : ""}
    <div class="badge-row">
      <span class="badge">${escapeHtml(likelyText)}</span>
      <span class="badge">${detectedBedrooms.length} bedroom sizes found</span>
      ${attemptCount ? `<span class="badge">${attemptCount} photos scanned</span>` : ""}
    </div>
    ${
      analysis.rooms?.length
        ? `<div class="floorplan-room-list">
            ${analysis.rooms.map((room) => `
              <div class="floorplan-room-card">
                <strong>${escapeHtml(room.label || "Room")}</strong>
                <span>${escapeHtml(formatRoomDimensions(room) || "Dimensions not parsed")}</span>
                <span>${escapeHtml(room.areaSquareFeet ? `${room.areaSquareFeet} sq ft` : "Area not available")}</span>
              </div>
            `).join("")}
          </div>`
        : `<p class="metric">No room dimensions were extracted from the photos. You can still fill bedroom sizes manually.</p>`
    }
  `;
}

function populateForm(apartment) {
  state.editingId = apartment.id || null;
  elements.apartmentId.value = apartment.id || "";
  elements.listingUrl.value = apartment.listingUrl || "";
  elements.address.value = apartment.address || "";
  elements.neighborhood.value = apartment.neighborhood || "";
  elements.monthlyRent.value = apartment.monthlyRent || "";
  elements.bedroomsCount.value = apartment.bedroomsCount || 0;
  elements.bathroomsCount.value = apartment.bathroomsCount || "";
  elements.totalSquareFootage.value = apartment.totalSquareFootage || "";
  elements.parking.value = apartment.parking || "";
  elements.hasDen.checked = Boolean(apartment.hasDen);
  elements.washerDryer.checked = Boolean(apartment.washerDryerInUnit);
  elements.petsAllowed.checked = Boolean(apartment.petsAllowed);
  elements.notes.value = apartment.notes || "";

  setDraftPhotos(apartment.photoUrls || [], apartment.imageUrl || "");

  state.floorPlanReview = apartment.floorPlanAnalysis
    ? {
        selectedPhotoUrl: apartment.floorPlanAnalysis.selectedPhotoUrl || null,
        analysis: apartment.floorPlanAnalysis,
        attempts: apartment.floorPlanAnalysis.attempts || []
      }
    : null;
  renderFloorPlanAnalysis();
  setStatus(elements.floorplanStatus, "");

  writeBedroomRows(
    Array.from({ length: Number(apartment.bedroomsCount) || 0 }, (_value, index) => ({
      name: apartment.bedrooms?.[index]?.name || `Bedroom ${index + 1}`,
      squareFootage: apartment.bedrooms?.[index]?.squareFootage ?? null
    }))
  );

  state.commuteTargets.forEach((target) => {
    const input = elements.commuteFields.querySelector(`[data-commute-key="${target.key}"]`);
    if (input) {
      input.value = apartment.commutes?.[target.key]?.minutes || "";
    }
  });

  state.customFields.forEach((field) => {
    const input = elements.customFactorFields.querySelector(`[data-custom-key="${field.key}"]`);
    if (input) {
      input.value = apartment.customValues?.[field.key] || "";
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  state.editingId = null;
  state.draftPhotoUrls = [];
  state.floorPlanReview = null;
  elements.apartmentForm.reset();
  elements.apartmentId.value = "";
  elements.bedroomsCount.value = 3;
  renderBedroomFields(3);
  renderCommuteFields();
  renderCustomFactorFields();
  renderPhotoGallery();
  renderFloorPlanAnalysis();
  setStatus(elements.floorplanStatus, "");
  setStatus(elements.formStatus, "");
}

function buildPhotoStrip(photoUrls, address) {
  if (!photoUrls.length) {
    return "";
  }

  return `
    <div class="card-photo-strip">
      ${photoUrls.map((photoUrl, index) => `
        <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(address)} photo ${index + 1}" />
      `).join("")}
    </div>
  `;
}

function renderApartments() {
  elements.apartmentsList.innerHTML = "";

  if (state.apartments.length === 0) {
    elements.apartmentsList.innerHTML = `<p class="metric">No apartments saved yet.</p>`;
    renderComparison();
    return;
  }

  state.apartments.forEach((apartment) => {
    const photoUrls = normalizePhotoUrls({
      imageUrl: apartment.imageUrl || "",
      photoUrls: apartment.photoUrls || []
    });
    const coverPhoto = photoUrls[0] || "";
    const card = document.createElement("article");
    card.className = "apartment-card";
    card.innerHTML = `
      ${coverPhoto ? `<img src="${escapeHtml(coverPhoto)}" alt="${escapeHtml(apartment.address)}" />` : ""}
      <div class="card-top">
        <div>
          <h3>${escapeHtml(apartment.address)}</h3>
          <p class="metric">${escapeHtml(apartment.neighborhood || "Neighborhood TBD")}</p>
        </div>
        <label class="checkbox">
          <input type="checkbox" data-compare-id="${apartment.id}" ${state.selectedIds.has(apartment.id) ? "checked" : ""} />
          <span>Compare</span>
        </label>
      </div>
      <div class="badge-row">
        <span class="badge">${escapeHtml(formatCurrency(apartment.monthlyRent))}</span>
        <span class="badge">${escapeHtml(`${apartment.bedroomsCount || "?"} bd`)}</span>
        <span class="badge">${escapeHtml(`${apartment.bathroomsCount || "?"} ba`)}</span>
        <span class="badge">${escapeHtml(`${apartment.totalSquareFootage || "?"} sq ft`)}</span>
        ${photoUrls.length ? `<span class="badge">${escapeHtml(`${photoUrls.length} photos`)}</span>` : ""}
      </div>
      ${buildPhotoStrip(photoUrls, apartment.address)}
      <div class="metric-list">
        <div class="metric">Rent split: ${escapeHtml(rentShareSummary(apartment))}</div>
        <div class="metric">Parking: ${escapeHtml(apartment.parking || "—")}</div>
        <div class="metric">Pets: ${escapeHtml(formatBoolean(apartment.petsAllowed))}</div>
      </div>
      <div class="button-row">
        <button class="button ghost" type="button" data-edit-id="${apartment.id}">Edit</button>
        <button class="button danger" type="button" data-delete-id="${apartment.id}">Delete</button>
      </div>
    `;
    elements.apartmentsList.append(card);
  });

  renderComparison();
}

async function loadData() {
  const [apartmentsPayload, customFieldsPayload, commuteTargetsPayload] = await Promise.all([
    fetchJson("/api/apartments"),
    fetchJson("/api/custom-fields"),
    fetchJson("/api/commute-targets")
  ]);

  state.apartments = apartmentsPayload.apartments;
  state.customFields = customFieldsPayload.customFields;
  state.commuteTargets = commuteTargetsPayload.commuteTargets;
  state.selectedIds = new Set(
    [...state.selectedIds].filter((id) => state.apartments.some((apartment) => apartment.id === id))
  );

  renderCommuteFields();
  renderCustomFactorFields();
  renderApartments();
}

function collectApartmentPayload() {
  const bedrooms = Array.from(elements.bedroomFields.querySelectorAll(".bedroom-row")).map((row, index) => ({
    name: row.querySelector("[data-role='name']").value || `Bedroom ${index + 1}`,
    squareFootage: row.querySelector("[data-role='sqft']").value ? Number(row.querySelector("[data-role='sqft']").value) : null
  }));

  const customValues = {};
  state.customFields.forEach((field) => {
    const input = elements.customFactorFields.querySelector(`[data-custom-key="${field.key}"]`);
    if (input && input.value.trim()) {
      customValues[field.key] = input.value.trim();
    }
  });

  const commutes = {};
  state.commuteTargets.forEach((target) => {
    const input = elements.commuteFields.querySelector(`[data-commute-key="${target.key}"]`);
    if (input && input.value !== "") {
      commutes[target.key] = { minutes: Number(input.value), mode: "transit" };
    }
  });

  return {
    id: elements.apartmentId.value || undefined,
    listingUrl: elements.listingUrl.value.trim(),
    address: elements.address.value.trim(),
    neighborhood: elements.neighborhood.value.trim(),
    monthlyRent: elements.monthlyRent.value ? Number(elements.monthlyRent.value) : null,
    bedroomsCount: elements.bedroomsCount.value ? Number(elements.bedroomsCount.value) : null,
    bathroomsCount: elements.bathroomsCount.value ? Number(elements.bathroomsCount.value) : null,
    totalSquareFootage: elements.totalSquareFootage.value ? Number(elements.totalSquareFootage.value) : null,
    parking: elements.parking.value.trim(),
    imageUrl: elements.imageUrl.value.trim(),
    photoUrls: state.draftPhotoUrls,
    floorPlanAnalysis: state.floorPlanReview
      ? {
          ...state.floorPlanReview.analysis,
          selectedPhotoUrl: state.floorPlanReview.selectedPhotoUrl || null,
          attempts: state.floorPlanReview.attempts || []
        }
      : null,
    hasDen: elements.hasDen.checked,
    washerDryerInUnit: elements.washerDryer.checked,
    petsAllowed: elements.petsAllowed.checked,
    notes: elements.notes.value.trim(),
    bedrooms,
    customValues,
    commutes
  };
}

elements.bedroomsCount.addEventListener("change", () => {
  renderBedroomFields(elements.bedroomsCount.value);
});

elements.imageUrl.addEventListener("change", () => {
  setDraftPhotos(state.draftPhotoUrls, elements.imageUrl.value.trim());
});

elements.importForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(elements.importStatus, "Importing...");

  try {
    const payload = await fetchJson("/api/import/zillow", {
      method: "POST",
      body: JSON.stringify({ url: elements.importUrl.value.trim() })
    });
    populateForm(payload.listing);
    setStatus(
      elements.importStatus,
      `Listing imported with ${normalizePhotoUrls(payload.listing).length} photos. Review and fill missing details before saving.`,
      "success"
    );
  } catch (error) {
    setStatus(elements.importStatus, error.message, "error");
  }
});

elements.analyzeFloorplan.addEventListener("click", async () => {
  if (!state.draftPhotoUrls.length) {
    setStatus(elements.floorplanStatus, "Import a Zillow listing or add photos first.", "error");
    return;
  }

  elements.analyzeFloorplan.disabled = true;
  setStatus(elements.floorplanStatus, "Analyzing up to 12 photos. This can take a minute.", "");

  try {
    const review = await fetchJson("/api/floorplans/analyze", {
      method: "POST",
      body: JSON.stringify({ photoUrls: state.draftPhotoUrls })
    });
    state.floorPlanReview = review;
    renderFloorPlanAnalysis();
    setStatus(
      elements.floorplanStatus,
      review.analysis?.isLikelyFloorPlan
        ? "Floor plan candidate found. Review the extracted sizes before applying them."
        : "No clear floor plan was found. You can still enter room sizes manually.",
      review.analysis?.isLikelyFloorPlan ? "success" : ""
    );
  } catch (error) {
    setStatus(elements.floorplanStatus, error.message, "error");
  } finally {
    elements.analyzeFloorplan.disabled = false;
  }
});

elements.applyFloorplan.addEventListener("click", () => {
  if (!state.floorPlanReview?.analysis) {
    return;
  }

  const nextBedrooms = applyFloorPlanBedrooms({
    bedroomCount: elements.bedroomsCount.value,
    existingBedrooms: bedroomInputValues().map((bedroom) => ({
      name: bedroom.name,
      squareFootage: bedroom.squareFootage ? Number(bedroom.squareFootage) : null
    })),
    floorPlanAnalysis: state.floorPlanReview.analysis
  });

  if (!nextBedrooms.length) {
    setStatus(elements.floorplanStatus, "No bedroom sizes were extracted to apply.", "error");
    return;
  }

  elements.bedroomsCount.value = nextBedrooms.length;
  writeBedroomRows(nextBedrooms);
  setStatus(elements.floorplanStatus, "Bedroom sizes copied into the form. Review them before saving.", "success");
});

elements.apartmentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(elements.formStatus, "Saving...");

  try {
    const payload = collectApartmentPayload();
    const isEditing = Boolean(state.editingId);
    await fetchJson(isEditing ? `/api/apartments/${state.editingId}` : "/api/apartments", {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    await loadData();
    resetForm();
    setStatus(elements.formStatus, "Apartment saved locally.", "success");
  } catch (error) {
    setStatus(elements.formStatus, error.message, "error");
  }
});

elements.customFieldForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(elements.customFieldStatus, "Saving...");

  try {
    await fetchJson("/api/custom-fields", {
      method: "POST",
      body: JSON.stringify({
        key: elements.customFieldKey.value.trim(),
        label: elements.customFieldLabel.value.trim(),
        valueType: elements.customFieldType.value
      })
    });
    elements.customFieldForm.reset();
    await loadData();
    setStatus(elements.customFieldStatus, "Custom factor saved.", "success");
  } catch (error) {
    setStatus(elements.customFieldStatus, error.message, "error");
  }
});

elements.resetForm.addEventListener("click", resetForm);

elements.photoGallery.addEventListener("click", (event) => {
  const button = event.target.closest("[data-photo-index]");
  if (!button) {
    return;
  }

  const photoUrl = state.draftPhotoUrls[Number(button.getAttribute("data-photo-index"))];
  if (!photoUrl) {
    return;
  }

  setDraftPhotos(state.draftPhotoUrls, photoUrl);
});

elements.apartmentsList.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-compare-id]");
  if (!checkbox) {
    return;
  }
  const apartmentId = Number(checkbox.getAttribute("data-compare-id"));
  if (checkbox.checked) {
    state.selectedIds.add(apartmentId);
  } else {
    state.selectedIds.delete(apartmentId);
  }
  renderComparison();
});

elements.apartmentsList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-id]");
  if (editButton) {
    const apartment = state.apartments.find((item) => item.id === Number(editButton.getAttribute("data-edit-id")));
    if (apartment) {
      populateForm(apartment);
    }
    return;
  }

  const deleteButton = event.target.closest("[data-delete-id]");
  if (!deleteButton) {
    return;
  }

  const apartmentId = Number(deleteButton.getAttribute("data-delete-id"));
  const apartment = state.apartments.find((item) => item.id === apartmentId);
  const shouldDelete = window.confirm?.(`Delete ${apartment?.address || "this listing"}?`) ?? true;

  if (!shouldDelete) {
    return;
  }

  deleteButton.disabled = true;
  setStatus(elements.formStatus, "Deleting listing...");

  try {
    await fetchJson(`/api/apartments/${apartmentId}`, {
      method: "DELETE"
    });

    if (state.editingId === apartmentId) {
      resetForm();
    }

    await loadData();
    setStatus(elements.formStatus, "Listing deleted.", "success");
  } catch (error) {
    deleteButton.disabled = false;
    setStatus(elements.formStatus, error.message, "error");
  }
});

loadData()
  .then(() => {
    resetForm();
  })
  .catch((error) => {
    setStatus(elements.formStatus, error.message, "error");
  });
