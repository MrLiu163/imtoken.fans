import type {
  MakerRelationship,
  ProductLaunchStage,
  ProductPlatform,
  ProductPricing,
  ProductRatingImprovement,
  ProductRatingStrength,
} from "@/lib/types";

export const PRODUCT_PLATFORMS: ProductPlatform[] = [
  "web",
  "ios",
  "android",
  "browser_extension",
  "telegram",
  "hardware",
  "other",
];

export const PRODUCT_PRICING: ProductPricing[] = ["free", "freemium", "paid", "open_source"];
export const PRODUCT_LAUNCH_STAGES: ProductLaunchStage[] = ["live", "public_beta", "private_beta", "coming_soon"];
export const MAKER_RELATIONSHIPS: MakerRelationship[] = ["creator", "team_member"];

export const PRODUCT_RATING_STRENGTHS: ProductRatingStrength[] = [
  "useful",
  "easy_to_use",
  "design",
  "innovation",
  "security",
];

export const PRODUCT_RATING_IMPROVEMENTS: ProductRatingImprovement[] = [
  "reliability",
  "usability",
  "documentation",
  "performance",
  "support",
];

export const PRODUCT_RATING_MIN_COUNT = 5;

export function isProductPlatform(value: string): value is ProductPlatform {
  return PRODUCT_PLATFORMS.includes(value as ProductPlatform);
}

export function isProductPricing(value: string): value is ProductPricing {
  return PRODUCT_PRICING.includes(value as ProductPricing);
}

export function isProductLaunchStage(value: string): value is ProductLaunchStage {
  return PRODUCT_LAUNCH_STAGES.includes(value as ProductLaunchStage);
}

export function isMakerRelationship(value: string): value is MakerRelationship {
  return MAKER_RELATIONSHIPS.includes(value as MakerRelationship);
}
