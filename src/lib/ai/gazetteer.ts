import type { Theme } from "../package-content";

/** Places the client sells, with the spellings travellers actually type. */
export type Place = { name: string; region: "Kerala" | "Tamil Nadu" | "Karnataka" | "Puducherry"; aliases: string[] };

export const PLACES: Place[] = [
  { name: "Munnar", region: "Kerala", aliases: ["munnar"] },
  { name: "Thekkady", region: "Kerala", aliases: ["thekkady", "thekady", "periyar", "kumily"] },
  { name: "Alleppey", region: "Kerala", aliases: ["alleppey", "alappuzha", "aleppey", "allepey", "alleppy"] },
  { name: "Kumarakom", region: "Kerala", aliases: ["kumarakom"] },
  { name: "Kochi", region: "Kerala", aliases: ["kochi", "cochin", "fort kochi", "ernakulam"] },
  { name: "Kovalam", region: "Kerala", aliases: ["kovalam"] },
  { name: "Varkala", region: "Kerala", aliases: ["varkala"] },
  { name: "Trivandrum", region: "Kerala", aliases: ["trivandrum", "thiruvananthapuram"] },
  { name: "Wayanad", region: "Kerala", aliases: ["wayanad", "wayanadu"] },
  { name: "Athirappilly", region: "Kerala", aliases: ["athirappilly", "athirapally", "athirappally"] },
  { name: "Madurai", region: "Tamil Nadu", aliases: ["madurai"] },
  { name: "Rameswaram", region: "Tamil Nadu", aliases: ["rameswaram", "rameshwaram"] },
  { name: "Kanyakumari", region: "Tamil Nadu", aliases: ["kanyakumari", "kanniyakumari", "cape comorin"] },
  { name: "Ooty", region: "Tamil Nadu", aliases: ["ooty", "udhagamandalam", "nilgiris", "nilgiri"] },
  { name: "Kodaikanal", region: "Tamil Nadu", aliases: ["kodaikanal", "kodai"] },
  { name: "Mahabalipuram", region: "Tamil Nadu", aliases: ["mahabalipuram", "mamallapuram"] },
  { name: "Chennai", region: "Tamil Nadu", aliases: ["chennai", "madras"] },
  { name: "Coorg", region: "Karnataka", aliases: ["coorg", "kodagu", "madikeri"] },
  { name: "Mysore", region: "Karnataka", aliases: ["mysore", "mysuru"] },
  { name: "Hampi", region: "Karnataka", aliases: ["hampi"] },
  { name: "Pondicherry", region: "Puducherry", aliases: ["pondicherry", "puducherry", "pondy"] },
];

export const REGION_ALIASES: Record<string, Place["region"] | "South India"> = {
  kerala: "Kerala",
  "god's own country": "Kerala",
  "gods own country": "Kerala",
  "tamil nadu": "Tamil Nadu",
  tamilnadu: "Tamil Nadu",
  karnataka: "Karnataka",
  "south india": "South India",
  "southern india": "South India",
};

/** Theme keywords. Order matters only for display. */
export const THEME_KEYWORDS: Record<Theme, string[]> = {
  houseboat: ["houseboat", "house boat", "kettuvallam", "boat stay", "stay on a boat"],
  backwaters: ["backwater", "backwaters", "lagoon"],
  hills: ["hill station", "hills", "mountains", "misty"],
  "tea gardens": ["tea garden", "tea gardens", "tea estate", "tea plantation"],
  wildlife: ["wildlife", "safari", "elephant", "elephants", "tiger", "jungle", "national park"],
  beach: ["beach", "beaches", "seaside", "sea view"],
  heritage: ["heritage", "history", "historic", "palace", "palaces", "fort"],
  temples: ["temple", "temples"],
  ayurveda: ["ayurveda", "ayurvedic", "massage", "wellness", "spa"],
  food: ["food", "cuisine", "cooking", "sadya"],
  culture: ["kathakali", "culture", "cultural", "dance"],
  waterfalls: ["waterfall", "waterfalls", "falls"],
  adventure: ["trek", "trekking", "hike", "hiking", "adventure", "rafting"],
  family: ["family", "kids", "children"],
  honeymoon: ["honeymoon", "newly married", "just married", "anniversary"],
  pilgrimage: ["pilgrimage", "darshan", "jyotirlinga"],
};
