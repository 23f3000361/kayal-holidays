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

/** Map coordinates for the route map; lets editors fill map stops from destinations in one click. */
export const PLACE_COORDS: Record<string, { lat: number; lng: number }> = {
  Kochi: { lat: 9.9658, lng: 76.2421 }, Munnar: { lat: 10.0889, lng: 77.0595 }, Thekkady: { lat: 9.6031, lng: 77.1615 },
  Alleppey: { lat: 9.4981, lng: 76.3388 }, Kumarakom: { lat: 9.6175, lng: 76.4301 }, Kovalam: { lat: 8.4004, lng: 76.9787 },
  Varkala: { lat: 8.7379, lng: 76.7163 }, Trivandrum: { lat: 8.5241, lng: 76.9366 }, Wayanad: { lat: 11.6085, lng: 76.083 },
  Athirappilly: { lat: 10.2851, lng: 76.5698 }, Madurai: { lat: 9.9252, lng: 78.1198 }, Rameswaram: { lat: 9.2876, lng: 79.3129 },
  Kanyakumari: { lat: 8.0883, lng: 77.5385 }, Ooty: { lat: 11.4102, lng: 76.695 }, Kodaikanal: { lat: 10.2381, lng: 77.4892 },
  Mahabalipuram: { lat: 12.6208, lng: 80.1945 }, Chennai: { lat: 13.0827, lng: 80.2707 }, Coorg: { lat: 12.4244, lng: 75.7382 },
  Mysore: { lat: 12.2958, lng: 76.6394 }, Hampi: { lat: 15.335, lng: 76.46 }, Pondicherry: { lat: 11.9416, lng: 79.8083 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 }, Coimbatore: { lat: 11.0168, lng: 76.9558 }, Kozhikode: { lat: 11.2588, lng: 75.7804 },
};
