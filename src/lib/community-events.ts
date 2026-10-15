export const COMMUNITY_EVENTS = [
  { slug: "spark-camp", key: "spark", tone: "ember", href: "/hackathon" },
  { slug: "night-studio", key: "studio", tone: "indigo", href: "/how-it-works" },
  { slug: "field-notes", key: "notes", tone: "paper", href: "/about" },
  { slug: "hearth", key: "hearth", tone: "rose", href: "/ideas" },
] as const;

export type CommunityEventSlug = (typeof COMMUNITY_EVENTS)[number]["slug"];
export type CommunityEventKey = (typeof COMMUNITY_EVENTS)[number]["key"];

export function getCommunityEvent(slug: string) {
  return COMMUNITY_EVENTS.find((event) => event.slug === slug) ?? null;
}
