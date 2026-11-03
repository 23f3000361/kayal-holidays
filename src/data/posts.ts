import type { PostContent } from "@/lib/blog";

/** Sample journal posts (ASSUMED content written for the demo). */
export type SeedPost = { slug: string; daysAgo: number; author: "editor" | "admin"; content: PostContent };

export const SEED_POSTS: SeedPost[] = [
  {
    slug: "first-houseboat-night-alleppey",
    daysAgo: 12,
    author: "editor",
    content: {
      title: "Your first houseboat night in Alleppey: what it is really like",
      excerpt: "Where you sleep, what you eat, when to go and the one thing most first-timers forget to pack.",
      category: "Guides",
      cover: { src: "/photos/alleppey-houseboat.jpg", alt: "A houseboat on the Alleppey backwaters" },
      relatedPackages: ["munnar-thekkady-alleppey-houseboat", "kochi-alleppey-backwater-escape", "grand-kerala-hills-backwaters-beach"],
      seoTitle: "Alleppey Houseboat Night: A First-Timer's Guide",
      seoDescription: "What a night on a Kerala houseboat is really like: cabins, food, timings, the best season and what to pack.",
      body: `A *kettuvallam* was once a rice barge. Today it is the most peaceful hotel room in Kerala: a thatched boat with one to three bedrooms, a deck with cane chairs and a cook who seems to know exactly when you want tea.

## How the day runs

Most boats board around noon at Alleppey or Kumarakom. You drift through wide lakes and narrow canals until about 5:30 pm, when boats must moor for the night by local rule. Dinner is on deck, the generator goes off late, and the air conditioning in the cabin runs through the night.

- **Lunch:** rice, fish curry, *thoran* and pickles, cooked on board
- **Evening:** a walk along the paddy dykes while the cook prepares dinner
- **Morning:** tea at sunrise, breakfast, back at the jetty by 9 am

> The best hour is the last one before mooring, when the light turns gold and the canals fill with school children going home by boat.

## When to go

October to March is dry and pleasant, which is why it is peak season. The monsoon (June to September) is lush and much cheaper, and the rain usually comes in bursts rather than all day.

## What to pack

Mosquito repellent, a light long-sleeved shirt for the evening, and a power bank: the sockets only work while the generator is on.

## Our favourite ways to include a houseboat

The classic route pairs a houseboat night with the tea hills of Munnar and the forests of Thekkady.

[[package:munnar-thekkady-alleppey-houseboat]]

Short on time? A long weekend in Kochi with one night on the water works beautifully too. [See the Kochi and Alleppey escape](/packages/kochi-alleppey-backwater-escape).`,
    },
  },
  {
    slug: "kerala-in-the-monsoon",
    daysAgo: 30,
    author: "editor",
    content: {
      title: "Kerala in the monsoon: greener, quieter and up to 25% cheaper",
      excerpt: "June to September is Kerala's best-kept secret. Here is what the rain is actually like, and where to go.",
      category: "Seasons",
      cover: { src: "/photos/munnar-hills.jpg", alt: "Mist over the hills of Munnar" },
      relatedPackages: ["munnar-thekkady-alleppey-houseboat", "wayanad-wilderness", "kovalam-varkala-beaches-ayurveda"],
      seoTitle: "Kerala in Monsoon: Is It Worth Visiting?",
      seoDescription: "Visiting Kerala from June to September: what the rain is like, the best places to go, and why prices drop.",
      body: `Most travellers come to Kerala between October and March. Those who come in the monsoon tend to come back in the monsoon.

## What the rain is really like

The south-west monsoon arrives in early June. Heavy showers come in bursts, often in the afternoon, with bright spells in between. The hills turn an almost unreal green, waterfalls are at their fullest and the crowds are gone.

## Why it costs less

Hotels and houseboats drop their rates, and our packages follow. The classic Munnar, Thekkady and Alleppey trip, for example, is **₹24,900 per person in the monsoon against ₹32,500 in peak season**, both on twin sharing plus GST.

## Where to go

1. **Munnar** for misty tea country and the waterfalls on the way up
2. **Wayanad** for full rivers, forest walks and Soochipara falls
3. **The Ayurveda coast**, because traditional practitioners consider the monsoon the best season for treatment

[[package:wayanad-wilderness]]

## A few honest cautions

Some trekking trails close after heavy rain, the sea is too rough for swimming, and flights can be delayed. We build slack into monsoon itineraries for exactly that reason.`,
    },
  },
  {
    slug: "kerala-honeymoon-planning",
    daysAgo: 5,
    author: "admin",
    content: {
      title: "Planning a Kerala honeymoon: a slow route for two",
      excerpt: "Hills, a lake-side resort and time to do nothing at all. How we plan honeymoons, and what is worth paying for.",
      category: "Honeymoons",
      cover: { src: "/photos/kumarakom-backwaters.jpg", alt: "Calm backwaters at dusk in Kumarakom" },
      relatedPackages: ["kerala-honeymoon-munnar-thekkady-kumarakom", "kovalam-varkala-beaches-ayurveda"],
      seoTitle: "Kerala Honeymoon Itinerary: A Slow Route for Two",
      seoDescription: "How to plan a relaxed Kerala honeymoon: Munnar, Thekkady and Kumarakom, the best months, and what to splurge on.",
      body: `The mistake most honeymoon itineraries make is trying to see everything. Kerala rewards the opposite.

## Fewer places, longer stays

We suggest three bases at most. Three nights in the hills of Munnar, one in the spice forests of Thekkady and two on the lake at Kumarakom gives you a week with only two real travel days.

## What is worth paying for

- **A room with a view in Munnar.** You will spend the mornings on the balcony.
- **A private houseboat cruise**, even for half a day, rather than a shared boat
- **One long Ayurvedic massage for two**, booked for the afternoon you arrive in Thekkady

## The best months

November to February is cool in the hills and dry on the coast. April and May are hot on the plains but lovely in Munnar, and prices drop.

[[package:kerala-honeymoon-munnar-thekkady-kumarakom]]

## Ending by the sea

If you have a few more days, finish on the beach. Varkala's cliff-top cafés are made for the last evenings of a trip. [See the Kovalam and Varkala package](/packages/kovalam-varkala-beaches-ayurveda).`,
    },
  },
];
