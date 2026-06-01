export type Listing = {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotAcres: number | null;
  yearBuilt: number | null;
  propertyType: string;
  isLand: boolean;
  lat: number;
  lng: number;
  url: string | null;
  source: string;
  mlsId: string | null;
  ridgewoodMiles: number;
  ridgewoodHours: number;
  skiMiles: number;
  skiHours: number;
  skiName: string;
};

export type ListingsData = {
  generatedAt: string | null;
  count: number;
  perState?: Record<string, number>;
  filters?: {
    maxPrice: number;
    minAcres: number;
    states: string[];
  };
  listings: Listing[];
};

export type Resort = {
  name: string;
  state: string;
  lat: number;
  lng: number;
};

export type PropertyType = "all" | "house" | "land";

export type SortKey =
  | "ridgewoodHoursAsc"
  | "skiHoursAsc"
  | "priceAsc"
  | "priceDesc"
  | "acresDesc"
  | "yearBuiltDesc";

export type FilterState = {
  priceMin: number;
  priceMax: number;
  acresMin: number;
  acresMax: number;
  yearBuiltMin: number;
  yearBuiltMax: number;
  skiHoursMax: number;
  ridgewoodHoursMax: number;
  propertyType: PropertyType;
  states: Set<string>;
  sortBy: SortKey;
};
