import * as cheerio from "cheerio";

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isZillowCaptchaPage(html) {
  if (!html) {
    return false;
  }

  return (
    html.includes("px-captcha") ||
    html.includes("Press & Hold to confirm you are") ||
    html.includes("Access to this page has been denied")
  );
}

function flattenJsonCandidates(value, results = []) {
  if (!value || typeof value !== "object") {
    return results;
  }

  results.push(value);

  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        flattenJsonCandidates(item, results);
      }
    } else if (child && typeof child === "object") {
      flattenJsonCandidates(child, results);
    }
  }

  return results;
}

function toAbsoluteZillowUrl(url) {
  if (!url) {
    return null;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith("/")) {
    return `https://www.zillow.com${url}`;
  }

  return url;
}

function normalizeAddress(address) {
  if (!address) {
    return null;
  }

  const street = address.streetAddress || address.street || address.line1 || "";
  const city = address.addressLocality || address.city || "";
  const state = address.addressRegion || address.state || "";
  const zip = address.postalCode || address.zipcode || address.zip || "";
  const locality = [city, state].filter(Boolean).join(", ");
  const trailing = [locality, zip].filter(Boolean).join(" ");

  if (street && trailing) {
    return `${street}, ${trailing}`;
  }

  return street || trailing || null;
}

function extractNeighborhood(listingData = {}) {
  return (
    listingData?.address?.neighborhood ||
    listingData?.neighborhoodRegion?.name ||
    listingData?.parentRegion?.name ||
    null
  );
}

function extractLdJsonData($) {
  const scripts = $('script[type="application/ld+json"]')
    .map((_, element) => $(element).contents().text())
    .get();

  for (const raw of scripts) {
    const parsed = safeParseJson(raw.trim());
    const candidates = Array.isArray(parsed) ? parsed : [parsed];

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object") {
        continue;
      }

      if (candidate.address || candidate.floorSize || candidate.numberOfBathroomsTotal) {
        return candidate;
      }
    }
  }

  return null;
}

function extractNextListingData($) {
  const nextDataRaw = $("#__NEXT_DATA__").contents().text();
  if (!nextDataRaw) {
    return null;
  }

  const nextData = safeParseJson(nextDataRaw.trim());
  const gdpClientCacheRaw = nextData?.props?.pageProps?.componentProps?.gdpClientCache;

  if (typeof gdpClientCacheRaw === "string") {
    const gdpClientCache = safeParseJson(gdpClientCacheRaw);
    if (gdpClientCache && typeof gdpClientCache === "object") {
      const firstEntry = Object.values(gdpClientCache)[0];
      const property = firstEntry?.property;
      if (property && typeof property === "object") {
        return property;
      }
    }
  }

  const candidates = flattenJsonCandidates(nextData);

  return candidates.find((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return false;
    }

    return (
      ("price" in candidate || "livingArea" in candidate || "resoFacts" in candidate) &&
      ("address" in candidate || "hdpUrl" in candidate)
    );
  }) || null;
}

function firstPhotoUrl(listingData) {
  const photo = listingData?.carouselPhotos?.[0];
  return (
    listingData?.responsivePhotos?.[0]?.mixedSources?.jpeg?.[0]?.url ||
    listingData?.responsivePhotos?.[0]?.mixedSources?.webp?.[0]?.url ||
    listingData?.responsivePhotos?.[0]?.url ||
    photo?.mixedSources?.jpeg?.[0]?.url ||
    photo?.mixedSources?.webp?.[0]?.url ||
    photo?.url ||
    null
  );
}

function collectPhotoUrls(listingData, ldJson) {
  const urls = [];
  const pushUrl = (value) => {
    if (value && !urls.includes(value)) {
      urls.push(value);
    }
  };

  for (const photo of listingData?.responsivePhotos || []) {
    pushUrl(photo?.mixedSources?.jpeg?.[0]?.url);
    pushUrl(photo?.mixedSources?.webp?.[0]?.url);
    pushUrl(photo?.url);
  }

  for (const photo of listingData?.carouselPhotos || []) {
    pushUrl(photo?.mixedSources?.jpeg?.[0]?.url);
    pushUrl(photo?.mixedSources?.webp?.[0]?.url);
    pushUrl(photo?.url);
  }

  if (Array.isArray(ldJson?.image)) {
    for (const image of ldJson.image) {
      pushUrl(image);
    }
  } else {
    pushUrl(ldJson?.image);
  }

  return urls;
}

function inferWasherDryer(resoFacts = {}) {
  const features = resoFacts.laundryFeatures || [];
  const serialized = Array.isArray(features) ? features.join(" ").toLowerCase() : String(features).toLowerCase();
  return /washer|dryer|in unit/.test(serialized) ? 1 : 0;
}

function inferPetsAllowed(resoFacts = {}) {
  const pets = resoFacts.petsAllowed ?? resoFacts.allowedPets;
  if (Array.isArray(pets)) {
    return pets.length > 0 ? 1 : 0;
  }

  if (typeof pets === "boolean") {
    return pets ? 1 : 0;
  }

  if (typeof resoFacts.hasPetsAllowed === "boolean") {
    return resoFacts.hasPetsAllowed ? 1 : 0;
  }

  return pets ? 1 : 0;
}

function inferParking(resoFacts = {}) {
  const parkingFeatures = resoFacts.parkingFeatures;
  if (Array.isArray(parkingFeatures) && parkingFeatures.length > 0) {
    return parkingFeatures.join(", ");
  }

  if (typeof parkingFeatures === "string" && parkingFeatures.trim()) {
    return parkingFeatures;
  }

  return null;
}

export function parseZillowListingHtml(html, fallbackUrl = null) {
  const $ = cheerio.load(html);
  const ldJson = extractLdJsonData($);
  const listingData = extractNextListingData($);
  const resoFacts = listingData?.resoFacts || {};
  const address = listingData?.address || ldJson?.address || {};

  return {
    listingUrl: toAbsoluteZillowUrl(listingData?.hdpUrl || ldJson?.url || fallbackUrl),
    address: normalizeAddress(address),
    neighborhood: extractNeighborhood(listingData),
    bedroomsCount: Number(
      listingData?.resoFacts?.bedrooms ??
        listingData?.bedrooms ??
        ldJson?.numberOfRooms ??
        0
    ) || null,
    bathroomsCount: Number(
      listingData?.resoFacts?.bathrooms ??
        listingData?.bathrooms ??
        ldJson?.numberOfBathroomsTotal ??
        0
    ) || null,
    totalSquareFootage: Number(
      listingData?.livingArea ??
        ldJson?.floorSize?.value ??
        0
    ) || null,
    monthlyRent: Number(listingData?.price ?? 0) || null,
    washerDryerInUnit: inferWasherDryer(resoFacts),
    petsAllowed: inferPetsAllowed(resoFacts),
    parking: inferParking(resoFacts),
    imageUrl: firstPhotoUrl(listingData) || (Array.isArray(ldJson?.image) ? ldJson.image[0] : ldJson?.image || null),
    photoUrls: collectPhotoUrls(listingData, ldJson),
    importedPayloadJson: JSON.stringify({
      ldJson,
      listingData
    })
  };
}

export async function importZillowListing({ url, html } = {}) {
  if (!url && !html) {
    throw new Error("A Zillow URL or HTML payload is required");
  }

  let htmlToParse = html;

  if (!htmlToParse) {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 ApartmentCompare/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`Zillow request failed with status ${response.status}`);
    }

    htmlToParse = await response.text();
  }

  if (isZillowCaptchaPage(htmlToParse)) {
    throw new Error("Zillow blocked automated access with a captcha page");
  }

  const listing = parseZillowListingHtml(htmlToParse, url);

  if (!listing.address) {
    throw new Error("Could not extract listing details from Zillow HTML");
  }

  return listing;
}
