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

function formatCommute(commute) {
  return commute?.minutes != null ? `${commute.minutes} min` : "—";
}

function rentShareSummary(apartment) {
  if (!apartment.rentShares?.length) {
    return "Add bedroom sizes";
  }

  return apartment.rentShares
    .map((share) => `${share.name}: ${formatCurrency(share.rentShare)}`)
    .join(" | ");
}

export function buildComparisonCards({ apartments, commuteTargets, customFields }) {
  return apartments.map((apartment) => ({
    id: apartment.id,
    title: apartment.address || "Untitled apartment",
    subtitle: [apartment.neighborhood, formatCurrency(apartment.monthlyRent)].filter(Boolean).join(" • "),
    sections: [
      {
        title: "Basics",
        rows: [
          { label: "Address", value: apartment.address || "—" },
          { label: "Neighborhood", value: apartment.neighborhood || "—" },
          { label: "Rent", value: formatCurrency(apartment.monthlyRent) },
          { label: "Bedrooms", value: apartment.bedroomsCount || "—" },
          { label: "Bathrooms", value: apartment.bathroomsCount || "—" },
          { label: "Sq Ft", value: apartment.totalSquareFootage || "—" }
        ]
      },
      {
        title: "Features",
        rows: [
          { label: "Washer/Dryer", value: formatBoolean(apartment.washerDryerInUnit) },
          { label: "Pets", value: formatBoolean(apartment.petsAllowed) },
          { label: "Parking", value: apartment.parking || "—" },
          { label: "Den", value: formatBoolean(apartment.hasDen) },
          { label: "Rent split", value: rentShareSummary(apartment) }
        ]
      },
      {
        title: "Commutes",
        rows: commuteTargets.map((target) => ({
          label: target.label,
          value: formatCommute(apartment.commutes?.[target.key])
        }))
      },
      {
        title: "Custom Factors",
        rows: customFields.length > 0
          ? customFields.map((field) => ({
            label: field.label,
            value: apartment.customValues?.[field.key] || "—"
          }))
          : [{ label: "Custom factors", value: "No custom factors yet" }]
      }
    ]
  }));
}
