/**
 * A fully local sample dataset so first-time users can explore before connecting
 * their own sheet. Treated as a normal source (kind: "demo") — stored on-device,
 * removable, never uploaded. Coordinates are approximate public landmarks.
 */
import type { Mandap, ParsedSheet, SourceMeta } from "@/types";

const DEMO_ROWS: Array<{
  name: string;
  lat: number;
  lng: number;
  address: string;
  description: string;
  hours: string;
}> = [
  {
    name: "Dhakeshwari National Temple",
    lat: 23.7229,
    lng: 90.3962,
    address: "Dhakeshwari Road, Dhaka 1000",
    description: "National temple of Bangladesh; the epicenter of Durga Puja celebrations in Dhaka with a grand procession on Bijoya Dashami.",
    hours: "Sashthi–Dashami, 6:00 AM – 11:00 PM",
  },
  {
    name: "Ramakrishna Mission Puja Mandap",
    lat: 23.7283,
    lng: 90.4087,
    address: "27 R K Mission Road, Wari, Dhaka",
    description: "Serene, traditional celebrations beside Buriganga; famous for devotional songs and the Dashami bhashan rally.",
    hours: "7:00 AM – 10:30 PM",
  },
  {
    name: "Shankhari Bazaar Puja",
    lat: 23.7179,
    lng: 90.3947,
    address: "Shankhari Bazaar, Old Dhaka",
    description: "Hundreds of colourful household pandals line the narrow artisan lanes of Old Dhaka — best explored on foot.",
    hours: "Evenings are liveliest",
  },
  {
    name: "Jagannath Hall, Dhaka University",
    lat: 23.7329,
    lng: 90.3937,
    address: "University of Dhaka, Shahbag",
    description: "Historic university hall puja with student-run cultural programmes and a beautifully lit campus campus.",
    hours: "Sashthi–Dashami, 8:00 AM – 11:00 PM",
  },
  {
    name: "Ramna Kali Mandir",
    lat: 23.7379,
    lng: 90.3989,
    address: "Ramna Park, Dhaka",
    description: "Rebuilt landmark temple overlooking Ramna lake; the Dashami immersion procession gathers here.",
    hours: "6:00 AM – 10:00 PM",
  },
  {
    name: "Banani Puja Mandap",
    lat: 23.7922,
    lng: 90.4043,
    address: "Banani Field, Banani, Dhaka",
    description: "One of the largest community pujas in the diplomatic zone, with elaborate lighting after dark.",
    hours: "9:00 AM – midnight",
  },
  {
    name: "Kalabagan Krira Chakra",
    lat: 23.7477,
    lng: 90.3804,
    address: "Kalabagan, Dhanmondi, Dhaka",
    description: "Neighbourhood favourite known for themed pandals and dhaak competitions on Ashtami evening.",
    hours: "8:00 AM – 11:30 PM",
  },
  {
    name: "Chatteshwari Kali Mandir",
    lat: 22.3626,
    lng: 91.8276,
    address: "Chatteshwari Road, Chattogram",
    description: "One of Chattogram's oldest temples; the city's main Dashami rally passes by the mandir gate.",
    hours: "6:00 AM – 10:00 PM",
  },
  {
    name: "JM Sen Hall Puja",
    lat: 22.3246,
    lng: 91.8140,
    address: "Rahmatganj, Chattogram",
    description: "Heritage venue hosting Chattogram's biggest organised puja and cultural stage.",
    hours: "8:00 AM – 11:00 PM",
  },
  {
    name: "Keane Bridge Puja Para",
    lat: 24.8944,
    lng: 91.869,
    address: "Zindabazar, Sylhet",
    description: "Riverside puja near the iconic 1936 bridge; beautifully refley lit at night.",
    hours: "7:00 AM – 10:30 PM",
  },
  {
    name: "Shaheb Bazar Para Puja",
    lat: 24.3712,
    lng: 88.6011,
    address: "Shaheb Bazar, Rajshahi",
    description: "Rajshahi's bustling bazaar puja with traditional dhak-dhol from dawn.",
    hours: "8:00 AM – 11:00 PM",
  },
  {
    name: "Shibbari Mor Puja Mandap",
    lat: 22.82,
    lng: 89.551,
    address: "Shibbari More, Khulna",
    description: "Southern gateway celebrations — a dozen para pujas within walking distance of the Mor.",
    hours: "8:00 AM – 10:30 PM",
  },
];

export const DEMO_SOURCE_ID = "demo-sample";

export function buildDemoSource(): SourceMeta {
  return {
    id: DEMO_SOURCE_ID,
    name: "Sample: Famous Pujas of Bangladesh",
    url: "local://demo",
    csvUrl: "local://demo",
    sheetId: "demo",
    gid: "0",
    kind: "demo",
    refLat: null,
    refLng: null,
    status: "ok",
    lastAttemptAt: Date.now(),
    lastSyncAt: Date.now(),
    lastRevision: "demo-v1",
    lastError: null,
    datasetVersion: 1,
    validCount: DEMO_ROWS.length,
    issueCount: 0,
    createdAt: Date.now(),
  };
}

export function demoParsedSheet(sourceId = DEMO_SOURCE_ID): ParsedSheet {
  const now = Date.now();
  const mandaps: Mandap[] = DEMO_ROWS.map((r, i) => ({
    id: `${sourceId}:demo-${i + 1}`,
    sourceId,
    recordKey: `demo-${i + 1}`,
    row: i + 2,
    name: r.name,
    nameKey: r.name.toLowerCase(),
    locationRaw: `${r.lat}, ${r.lng}`,
    lat: r.lat,
    lng: r.lng,
    locationKind: "coords",
    address: r.address,
    description: r.description,
    imageUrl: "",
    facebookUrl: "",
    instagramUrl: "",
    openingHours: r.hours,
    updatedAt: now,
  }));
  return {
    headers: ["name", "location", "address", "description", "opening_hours"],
    map: {
      name: 0,
      location: 1,
      latitude: null,
      longitude: null,
      address: 2,
      description: 3,
      imageUrl: null,
      facebookUrl: null,
      instagramUrl: null,
      openingHours: 4,
      id: null,
    },
    totalRows: mandaps.length,
    mandaps,
    issues: [],
    suggestedName: "Sample dataset",
  };
}
