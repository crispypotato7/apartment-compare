function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateWeightedBedroomRents(apartment) {
  const bedrooms = Array.isArray(apartment.bedrooms) ? apartment.bedrooms : [];
  const monthlyRent = Number(apartment.rent || apartment.monthlyRent || 0);
  const totalSquareFootage = Number(apartment.totalSquareFootage || 0);

  if (bedrooms.length === 0) {
    return [];
  }

  const bedroomSizes = bedrooms.map((bedroom) => Number(bedroom.squareFootage || 0));
  const totalBedroomSquareFootage = bedroomSizes.reduce((sum, size) => sum + size, 0);

  if (monthlyRent <= 0) {
    return bedrooms.map((bedroom) => ({
      name: bedroom.name || `Bedroom`,
      squareFootage: Number(bedroom.squareFootage || 0),
      effectiveSquareFootage: 0,
      rentShare: 0
    }));
  }

  let effectiveSizes;

  if (totalSquareFootage > 0 && totalBedroomSquareFootage > 0 && totalSquareFootage >= totalBedroomSquareFootage) {
    const commonAreaShare = (totalSquareFootage - totalBedroomSquareFootage) / bedrooms.length;
    effectiveSizes = bedroomSizes.map((size) => size + commonAreaShare);
  } else if (totalBedroomSquareFootage > 0) {
    effectiveSizes = bedroomSizes;
  } else {
    effectiveSizes = bedrooms.map(() => 1);
  }

  const effectiveTotal = effectiveSizes.reduce((sum, size) => sum + size, 0);

  return bedrooms.map((bedroom, index) => ({
    name: bedroom.name || `Bedroom ${index + 1}`,
    squareFootage: bedroomSizes[index],
    effectiveSquareFootage: roundCurrency(effectiveSizes[index]),
    rentShare: roundCurrency((monthlyRent * effectiveSizes[index]) / effectiveTotal)
  }));
}
