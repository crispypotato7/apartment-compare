import Database from "better-sqlite3";

function normalizeBoolean(value) {
  if (typeof value === "string") {
    return /^(1|true|yes|on)$/i.test(value) ? 1 : 0;
  }

  return value ? 1 : 0;
}

function mapBedroomRow(row) {
  return {
    id: row.id,
    apartmentId: row.apartment_id,
    name: row.name,
    squareFootage: row.square_footage
  };
}

function ensureColumn(db, tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function mapApartmentRow(row, extras = {}) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    listingUrl: row.listing_url,
    address: row.address,
    neighborhood: row.neighborhood,
    bedroomsCount: row.bedrooms_count,
    bathroomsCount: row.bathrooms_count,
    totalSquareFootage: row.total_square_footage,
    monthlyRent: row.monthly_rent,
    hasDen: row.has_den,
    washerDryerInUnit: row.washer_dryer_in_unit,
    petsAllowed: row.pets_allowed,
    parking: row.parking,
    imageUrl: row.image_url,
    photoUrls: extras.photoUrls || [],
    floorPlanAnalysis: row.floorplan_analysis_json ? JSON.parse(row.floorplan_analysis_json) : null,
    notes: row.notes,
    importedPayloadJson: row.imported_payload_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    bedrooms: extras.bedrooms || [],
    customValues: extras.customValues || {},
    commutes: extras.commutes || {}
  };
}

function initSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS apartments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_url TEXT,
      address TEXT NOT NULL,
      neighborhood TEXT,
      bedrooms_count INTEGER,
      bathrooms_count REAL,
      total_square_footage REAL,
      monthly_rent REAL,
      has_den INTEGER NOT NULL DEFAULT 0,
      washer_dryer_in_unit INTEGER NOT NULL DEFAULT 0,
      pets_allowed INTEGER NOT NULL DEFAULT 0,
      parking TEXT,
      image_url TEXT,
      notes TEXT,
      imported_payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bedrooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apartment_id INTEGER NOT NULL,
      name TEXT,
      square_footage REAL,
      FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS apartment_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apartment_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      is_floorplan INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS commute_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS apartment_commutes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apartment_id INTEGER NOT NULL,
      commute_target_id INTEGER NOT NULL,
      minutes INTEGER,
      mode TEXT NOT NULL DEFAULT 'transit',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(apartment_id, commute_target_id, mode),
      FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
      FOREIGN KEY (commute_target_id) REFERENCES commute_targets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      field_key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      value_type TEXT NOT NULL DEFAULT 'text'
    );

    CREATE TABLE IF NOT EXISTS apartment_custom_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apartment_id INTEGER NOT NULL,
      custom_field_id INTEGER NOT NULL,
      value_text TEXT,
      UNIQUE(apartment_id, custom_field_id),
      FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
      FOREIGN KEY (custom_field_id) REFERENCES custom_fields(id) ON DELETE CASCADE
    );
  `);

  ensureColumn(db, "apartments", "floorplan_analysis_json", "TEXT");

  const seedTarget = db.prepare(`
    INSERT INTO commute_targets (key, label)
    VALUES (@key, @label)
    ON CONFLICT(key) DO NOTHING
  `);

  for (const target of [
    { key: "wicker_park_lutheran_church", label: "Wicker Park Lutheran Church" },
    { key: "logan_square_stan_mansion", label: "Logan Square Stan Mansion" },
    { key: "oak_park", label: "Oak Park" },
    { key: "trump_tower", label: "Trump Tower" }
  ]) {
    seedTarget.run(target);
  }
}

function slugifyKey(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function createDatabase(filename = "data/apartments.db") {
  const db = new Database(filename);
  initSchema(db);

  const insertApartment = db.prepare(`
    INSERT INTO apartments (
      listing_url,
      address,
      neighborhood,
      bedrooms_count,
      bathrooms_count,
      total_square_footage,
      monthly_rent,
      has_den,
      washer_dryer_in_unit,
      pets_allowed,
      parking,
      image_url,
      floorplan_analysis_json,
      notes,
      imported_payload_json
    ) VALUES (
      @listingUrl,
      @address,
      @neighborhood,
      @bedroomsCount,
      @bathroomsCount,
      @totalSquareFootage,
      @monthlyRent,
      @hasDen,
      @washerDryerInUnit,
      @petsAllowed,
      @parking,
      @imageUrl,
      @floorPlanAnalysisJson,
      @notes,
      @importedPayloadJson
    )
  `);

  const updateApartment = db.prepare(`
    UPDATE apartments
    SET
      listing_url = @listingUrl,
      address = @address,
      neighborhood = @neighborhood,
      bedrooms_count = @bedroomsCount,
      bathrooms_count = @bathroomsCount,
      total_square_footage = @totalSquareFootage,
      monthly_rent = @monthlyRent,
      has_den = @hasDen,
      washer_dryer_in_unit = @washerDryerInUnit,
      pets_allowed = @petsAllowed,
      parking = @parking,
      image_url = @imageUrl,
      floorplan_analysis_json = @floorPlanAnalysisJson,
      notes = @notes,
      imported_payload_json = @importedPayloadJson,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);

  const insertBedroom = db.prepare(`
    INSERT INTO bedrooms (apartment_id, name, square_footage)
    VALUES (@apartmentId, @name, @squareFootage)
  `);

  const insertPhoto = db.prepare(`
    INSERT INTO apartment_photos (apartment_id, url, position, is_floorplan)
    VALUES (@apartmentId, @url, @position, @isFloorplan)
  `);

  const deleteBedroomsByApartmentId = db.prepare(`
    DELETE FROM bedrooms
    WHERE apartment_id = ?
  `);

  const deletePhotosByApartmentId = db.prepare(`
    DELETE FROM apartment_photos
    WHERE apartment_id = ?
  `);

  const deleteApartmentByIdStmt = db.prepare(`
    DELETE FROM apartments
    WHERE id = ?
  `);

  const selectApartmentById = db.prepare(`
    SELECT *
    FROM apartments
    WHERE id = ?
  `);

  const selectApartmentRows = db.prepare(`
    SELECT *
    FROM apartments
    ORDER BY updated_at DESC, id DESC
  `);

  const selectBedroomsByApartmentId = db.prepare(`
    SELECT *
    FROM bedrooms
    WHERE apartment_id = ?
    ORDER BY id ASC
  `);

  const selectPhotosByApartmentId = db.prepare(`
    SELECT url
    FROM apartment_photos
    WHERE apartment_id = ?
    ORDER BY position ASC, id ASC
  `);

  const selectCustomFields = db.prepare(`
    SELECT id, field_key, label, value_type
    FROM custom_fields
    ORDER BY label COLLATE NOCASE ASC
  `);

  const selectCustomFieldByKey = db.prepare(`
    SELECT id, field_key, label, value_type
    FROM custom_fields
    WHERE field_key = ?
  `);

  const upsertCustomField = db.prepare(`
    INSERT INTO custom_fields (field_key, label, value_type)
    VALUES (@key, @label, @valueType)
    ON CONFLICT(field_key) DO UPDATE SET
      label = excluded.label,
      value_type = excluded.value_type
  `);

  const insertCustomValue = db.prepare(`
    INSERT INTO apartment_custom_values (apartment_id, custom_field_id, value_text)
    VALUES (@apartmentId, @customFieldId, @valueText)
  `);

  const deleteCustomValuesByApartmentId = db.prepare(`
    DELETE FROM apartment_custom_values
    WHERE apartment_id = ?
  `);

  const selectCustomValuesByApartmentId = db.prepare(`
    SELECT cf.field_key, acv.value_text
    FROM apartment_custom_values acv
    JOIN custom_fields cf ON cf.id = acv.custom_field_id
    WHERE acv.apartment_id = ?
  `);

  const selectCommuteTargets = db.prepare(`
    SELECT id, key, label
    FROM commute_targets
    ORDER BY id ASC
  `);

  const selectCommuteTargetByKey = db.prepare(`
    SELECT id, key, label
    FROM commute_targets
    WHERE key = ?
  `);

  const insertApartmentCommute = db.prepare(`
    INSERT INTO apartment_commutes (apartment_id, commute_target_id, minutes, mode)
    VALUES (@apartmentId, @commuteTargetId, @minutes, @mode)
  `);

  const deleteCommutesByApartmentId = db.prepare(`
    DELETE FROM apartment_commutes
    WHERE apartment_id = ?
  `);

  const selectCommutesByApartmentId = db.prepare(`
    SELECT ct.key, ct.label, ac.minutes, ac.mode
    FROM apartment_commutes ac
    JOIN commute_targets ct ON ct.id = ac.commute_target_id
    WHERE ac.apartment_id = ?
    ORDER BY ct.id ASC
  `);

  function normalizeApartmentPayload(apartment) {
    return {
      id: apartment.id ? Number(apartment.id) : null,
      listingUrl: apartment.listingUrl || null,
      address: apartment.address,
      neighborhood: apartment.neighborhood || null,
      bedroomsCount: apartment.bedroomsCount ?? null,
      bathroomsCount: apartment.bathroomsCount ?? null,
      totalSquareFootage: apartment.totalSquareFootage ?? null,
      monthlyRent: apartment.monthlyRent ?? null,
      hasDen: normalizeBoolean(apartment.hasDen),
      washerDryerInUnit: normalizeBoolean(apartment.washerDryerInUnit),
      petsAllowed: normalizeBoolean(apartment.petsAllowed),
      parking: apartment.parking || null,
      imageUrl: apartment.imageUrl || null,
      floorPlanAnalysisJson: apartment.floorPlanAnalysis ? JSON.stringify(apartment.floorPlanAnalysis) : null,
      notes: apartment.notes || null,
      importedPayloadJson: apartment.importedPayloadJson || null
    };
  }

  function createCustomField(input) {
    const key = input.key || slugifyKey(input.label);
    if (!key) {
      throw new Error("Custom field key is required");
    }

    upsertCustomField.run({
      key,
      label: input.label || key,
      valueType: input.valueType || "text"
    });

    const row = selectCustomFieldByKey.get(key);
    return {
      id: row.id,
      key: row.field_key,
      label: row.label,
      valueType: row.value_type
    };
  }

  function mapCustomValues(apartmentId) {
    const values = {};

    for (const row of selectCustomValuesByApartmentId.all(apartmentId)) {
      values[row.field_key] = row.value_text;
    }

    return values;
  }

  function mapCommutes(apartmentId) {
    const commutes = {};

    for (const row of selectCommutesByApartmentId.all(apartmentId)) {
      commutes[row.key] = {
        label: row.label,
        minutes: row.minutes,
        mode: row.mode
      };
    }

    return commutes;
  }

  function mapPhotoUrls(apartmentId) {
    return selectPhotosByApartmentId.all(apartmentId).map((row) => row.url);
  }

  const saveApartmentTx = db.transaction((apartment) => {
    const payload = normalizeApartmentPayload(apartment);
    let apartmentId = payload.id;

    if (apartmentId) {
      updateApartment.run(payload);
      deleteBedroomsByApartmentId.run(apartmentId);
      deletePhotosByApartmentId.run(apartmentId);
      deleteCustomValuesByApartmentId.run(apartmentId);
      deleteCommutesByApartmentId.run(apartmentId);
    } else {
      const result = insertApartment.run(payload);
      apartmentId = Number(result.lastInsertRowid);
    }

    for (const [index, bedroom] of (apartment.bedrooms || []).entries()) {
      insertBedroom.run({
        apartmentId,
        name: bedroom.name || `Bedroom ${index + 1}`,
        squareFootage: bedroom.squareFootage ?? null
      });
    }

    for (const [index, url] of (apartment.photoUrls || []).entries()) {
      if (!url) {
        continue;
      }

      insertPhoto.run({
        apartmentId,
        url,
        position: index,
        isFloorplan: 0
      });
    }

    for (const [key, value] of Object.entries(apartment.customValues || {})) {
      const field = createCustomField({ key, label: key.replace(/_/g, " "), valueType: "text" });
      insertCustomValue.run({
        apartmentId,
        customFieldId: field.id,
        valueText: value == null ? "" : String(value)
      });
    }

    for (const [key, rawCommute] of Object.entries(apartment.commutes || {})) {
      const commuteTarget = selectCommuteTargetByKey.get(key);
      if (!commuteTarget) {
        continue;
      }

      const minutes = typeof rawCommute === "object" ? rawCommute.minutes : rawCommute;
      if (minutes == null || minutes === "") {
        continue;
      }

      insertApartmentCommute.run({
        apartmentId,
        commuteTargetId: commuteTarget.id,
        minutes: Number(minutes),
        mode: typeof rawCommute === "object" && rawCommute.mode ? rawCommute.mode : "transit"
      });
    }

    return apartmentId;
  });

  const deleteApartmentTx = db.transaction((id) => {
    deleteApartmentByIdStmt.run(id);
  });

  function getApartmentById(id) {
    const row = selectApartmentById.get(id);
    if (!row) {
      return null;
    }

    return mapApartmentRow(row, {
      bedrooms: selectBedroomsByApartmentId.all(id).map(mapBedroomRow),
      photoUrls: mapPhotoUrls(id),
      customValues: mapCustomValues(id),
      commutes: mapCommutes(id)
    });
  }

  function listApartments() {
    return selectApartmentRows.all().map((row) => getApartmentById(row.id));
  }

  function listCustomFields() {
    return selectCustomFields.all().map((row) => ({
      id: row.id,
      key: row.field_key,
      label: row.label,
      valueType: row.value_type
    }));
  }

  function listCommuteTargets() {
    return selectCommuteTargets.all().map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label
    }));
  }

  return {
    saveApartment(apartment) {
      const id = saveApartmentTx(apartment);
      return getApartmentById(id);
    },
    deleteApartmentById(id) {
      deleteApartmentTx(id);
    },
    getApartmentById,
    listApartments,
    createCustomField,
    listCustomFields,
    listCommuteTargets,
    close() {
      db.close();
    }
  };
}
