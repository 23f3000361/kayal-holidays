// Downloads openly licensed photos from Wikimedia Commons into public/photos
// and records author + licence in src/data/photo-credits.json.
// Usage: node scripts/fetch-photos.mjs            (fetch everything missing)
//        node scripts/fetch-photos.mjs --list key  (show candidates for one key)
//        node scripts/fetch-photos.mjs --pick key N (replace one photo with candidate N)
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "photos");
const CREDITS = path.join(process.cwd(), "src", "data", "photo-credits.json");
const UA = "KayalSiteBuilder/1.0 (portfolio project; contact via GitHub)";

// key -> Commons search query. Quality images first, any landscape image second.
const WANTED = {
  "alleppey-houseboat": "Alleppey houseboat backwaters",
  "kumarakom-backwaters": "Kumarakom backwaters",
  "munnar-tea": "Munnar tea plantation",
  "munnar-hills": "Munnar hills mist",
  "thekkady-periyar": "Periyar Tiger Reserve elephants",
  "kochi-fishing-nets": "Chinese fishing nets Fort Kochi",
  "fort-kochi": "Santa Cruz Basilica Kochi",
  "kovalam-beach": "Kovalam lighthouse beach",
  "varkala-cliff": "Varkala beach",
  "wayanad": "Wayanad landscape",
  "kathakali": "Kathakali",
  "madurai-temple": "Meenakshi Amman temple gopuram",
  "rameswaram": "Ramanathaswamy temple corridor",
  "kanyakumari": "Kanyakumari Vivekananda rock",
  "ooty": "Nilgiri mountain railway",
  "kodaikanal": "Kodaikanal lake",
  "coorg": "Coorg hills landscape",
  "mysore-palace": "Mysore Palace illuminated",
  "hampi": "Hampi Virupaksha",
  "pondicherry": "Pondicherry French quarter",
  "mahabalipuram": "Shore temple Mahabalipuram",
  "athirappilly": "Athirappilly falls",
  "kerala-food": "Kerala sadya banana leaf",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params, attempt = 0) {
  await sleep(1500);
  const url = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ format: "json", origin: "*", ...params });
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status === 429 && attempt < 4) { await sleep(15000 * (attempt + 1)); return api(params, attempt + 1); }
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  return res.json();
}

function stripHtml(s = "") {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

async function candidates(query) {
  const out = [];
  for (const q of [`${query} incategory:Quality_images`, query]) {
    const data = await api({
      action: "query", generator: "search", gsrsearch: `${q} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "20",
      prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: "1800",
    });
    const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => a.index - b.index);
    for (const p of pages) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const meta = ii.extmetadata ?? {};
      const licence = meta.LicenseShortName?.value ?? "";
      const okLicence = /^(CC0|Public domain|CC BY(-SA)? [234]\.0)/i.test(licence);
      const landscape = ii.width >= 1800 && ii.width / ii.height >= 1.3 && ii.width / ii.height <= 2.2;
      if (!okLicence || !landscape) continue;
      out.push({
        title: p.title, url: ii.thumburl, page: ii.descriptionurl, width: ii.width, height: ii.height,
        author: stripHtml(meta.Artist?.value) || "Unknown", licence, licenceUrl: meta.LicenseUrl?.value ?? "",
        quality: q.includes("Quality_images"),
      });
    }
    if (out.length >= 3) break;
  }
  return out;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const credits = fs.existsSync(CREDITS) ? JSON.parse(fs.readFileSync(CREDITS, "utf8")) : {};
  const listKey = process.argv.indexOf("--list");
  if (listKey > -1) {
    const key = process.argv[listKey + 1];
    console.log(JSON.stringify(await candidates(WANTED[key]), null, 2));
    return;
  }
  const pickArg = process.argv.indexOf("--pick");
  const only = pickArg > -1 ? process.argv[pickArg + 1] : null;
  const pickIndex = pickArg > -1 ? Number(process.argv[pickArg + 2] ?? 0) : 0;
  for (const [key, query] of Object.entries(WANTED)) {
    if (only && key !== only) continue;
    const file = path.join(OUT_DIR, `${key}.jpg`);
    if (!only && fs.existsSync(file) && credits[key]) continue;
    const list = await candidates(query);
    const pick = list[pickIndex];
    if (!pick) { console.warn(`no candidate for ${key}`); continue; }
    const res = await fetch(pick.url, { headers: { "User-Agent": UA } });
    if (!res.ok) { console.warn(`download failed for ${key}: ${res.status}`); continue; }
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    credits[key] = { title: pick.title, page: pick.page, author: pick.author, licence: pick.licence, licenceUrl: pick.licenceUrl };
    console.log(`${key}: ${pick.title} (${pick.licence})`);
  }
  fs.mkdirSync(path.dirname(CREDITS), { recursive: true });
  fs.writeFileSync(CREDITS, JSON.stringify(credits, null, 2) + "\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
