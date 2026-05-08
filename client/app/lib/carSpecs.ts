export type VehicleCategory =
  | 'Limuzine'
  | 'SUV'
  | 'Kupe'
  | 'Kabriolet'
  | 'Familjare'
  | 'Elektrike';

export type Transmission = 'Automatik' | 'Manual';

export type FuelType = 'Benzine' | 'Naft' | 'Elektrik' | 'Hibrid';

export const VEHICLE_CATEGORIES: VehicleCategory[] = [
  'Limuzine',
  'SUV',
  'Kupe',
  'Kabriolet',
  'Familjare',
  'Elektrike',
];

export const TRANSMISSIONS: Transmission[] = ['Automatik', 'Manual'];

export const FUEL_TYPES: FuelType[] = ['Benzine', 'Naft', 'Elektrik', 'Hibrid'];

export const PRICE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '0 - 50 Lek', min: 0, max: 50 },
  { label: '50 - 100 Lek', min: 50, max: 100 },
  { label: '100 - 150 Lek', min: 100, max: 150 },
  { label: '150 - 200 Lek', min: 150, max: 200 },
  { label: '200+ Lek', min: 200, max: Number.POSITIVE_INFINITY },
];

export const FEATURES = [
  'Cruise Control',
  'Sensor shiu',
  'Kontroll terheqje',
] as const;
export type Feature = typeof FEATURES[number];

export const EXTRAS: { key: string; label: string; pricePerDay: number }[] = [
  { key: 'baby_seat', label: 'Ulese per femije', pricePerDay: 500 },
  { key: 'abroad_fee', label: 'Tarife per udhetim jashte vendit', pricePerDay: 0 },
];

export type CarSpecs = {
  seats: number;
  suitcases: number;
  transmission: Transmission;
  vehicleCategory: VehicleCategory;
  fuel: FuelType;
  year: number;
  mileage: number;
  cityConsumption: number;
  highwayConsumption: number;
  features: Feature[];
};

export function getCarSpecs(productId: number | string): CarSpecs {
  const seed = typeof productId === 'string' ? hashString(productId) : (productId || 0);
  const abs = Math.abs(seed) || 1;
  return {
    seats: 4 + (abs % 3),
    suitcases: 1 + ((abs >> 1) % 3),
    transmission: TRANSMISSIONS[abs % TRANSMISSIONS.length],
    vehicleCategory: VEHICLE_CATEGORIES[abs % VEHICLE_CATEGORIES.length],
    fuel: FUEL_TYPES[(abs >> 2) % FUEL_TYPES.length],
    year: 2020 + (abs % 6),
    mileage: ((abs * 137) % 50) * 1000,
    cityConsumption: 6 + (abs % 6),
    highwayConsumption: 4 + ((abs >> 1) % 5),
    features: FEATURES.filter((_, i) => ((abs + i) % 3) !== 0),
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

export function priceBucketLabel(price: number): string {
  for (const b of PRICE_BUCKETS) {
    if (price >= b.min && price < b.max) return b.label;
  }
  return PRICE_BUCKETS[PRICE_BUCKETS.length - 1].label;
}
