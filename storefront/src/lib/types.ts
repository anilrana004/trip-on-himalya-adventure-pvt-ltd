export type TripCategory = "TREK" | "PILGRIMAGE" | "LEISURE" | "CUSTOM";
export type TripDifficulty = "EASY" | "MODERATE" | "DIFFICULT" | "VERY_DIFFICULT" | null;
export type BookingType = "FIXED_BATCH" | "CUSTOM_FIT";

export type StorefrontTripCard = {
  id: string;
  name: string;
  slug: string;
  category: TripCategory;
  bookingType: BookingType;
  difficulty: TripDifficulty;
  fromPriceInr: number;
  durationDays: number;
  coverImageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
};

export type StorefrontTripDetail = StorefrontTripCard & {
  itinerary: string | null;
  inclusions: string | null;
  exclusions: string | null;
};
