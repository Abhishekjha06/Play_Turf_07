/**
 * Editorial guides for /blog.
 *
 * Content rules (enforced by review, not code):
 *  - Only general, verifiable knowledge and real PlayTurf product behaviour.
 *  - No invented statistics, no fake reviews, no fabricated venue claims.
 *  - Each article answers a real question players ask (AEO: question in the
 *    heading, direct answer in the first paragraph, then detail).
 */

export type BlogSection = {
  heading: string;
  /** Paragraph text; string[] renders as a bullet list. */
  body: string | string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  /** Direct answer to the title question — shown first for AI answers. */
  answer: string;
  datePublished: string; // ISO date
  dateModified?: string;
  readMinutes: number;
  sections: BlogSection[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: "how-to-book-a-football-turf",
    title: "How to Book a Football Turf: A Step-by-Step Guide",
    description:
      "A practical walkthrough of booking a football turf — picking the right slot length, checking lighting and surface, splitting costs, and confirming your booking.",
    answer:
      "Pick your date and start time, choose how many hours you need (most 5-a-side games fit one hour), check that the court is free for that slot, confirm the price before paying, and keep the booking ID for entry. On PlayTurf you can do all of this from a venue's page: choose the date, pick a free slot, select a court, and confirm.",
    datePublished: "2026-11-01",
    readMinutes: 4,
    sections: [
      {
        heading: "1. Decide the slot length before you search",
        body: [
          "Most 5-a-side football games fit comfortably into a one-hour slot once you account for warm-up. If you want time for two full games or a longer practice session, book two consecutive hours rather than hoping the next hour stays free — consecutive slots are booked together so nobody else can take the hour in between.",
        ],
      },
      {
        heading: "2. Check what the venue actually offers",
        body: [
          "Before booking, look for:",
          [
            "Surface type and whether floodlights are included in evening slots",
            "Whether the venue has multiple courts — larger venues let your group book court 2 even when court 1 is taken",
            "Amenities that matter to your group: parking, washrooms, drinking water, equipment rental",
          ],
        ],
      },
      {
        heading: "3. Book the exact slot and court",
        body: [
          "On PlayTurf, open the venue page, pick your date from the strip, and select a start time. Slots already booked by someone else are shown as unavailable. If the venue has several courts, you pick the specific court — availability is checked per court, per hour, so two groups can play side by side.",
        ],
      },
      {
        heading: "4. Confirm and keep the booking ID",
        body: [
          "After payment you get a booking with a unique ID and a ticket you can download or share with your group. The ticket shows the venue, date, start and end time, and court — show it at the venue. If your plans change immediately, cancellations are allowed within a short window right after booking; after that the slot belongs to you, so book carefully.",
        ],
      },
      {
        heading: "5. Splitting the cost with your squad",
        body: [
          "If you don't have a full squad, Open Games lets you join games other players have opened and split the court cost — the host opens a slot, players join, and each player pays their share instead of the full court fee.",
        ],
      },
    ],
  },
  {
    slug: "what-to-bring-to-a-turf-game",
    title: "What to Bring to a 5-a-Side Turf Match",
    description:
      "The practical packing list for a box-cricket or 5-a-side football turf game — footwear, hydration, and the small items that save the evening.",
    answer:
      "Bring turf shoes or flat-soled trainers (studs are often not allowed on artificial turf), a filled water bottle per player, a dark and a light shirt so teams split easily, and shin guards for football. Most turfs provide the ball and goal nets, and many rent equipment — check the venue's amenities before you pack your own.",
    datePublished: "2026-11-01",
    readMinutes: 3,
    sections: [
      {
        heading: "Footwear comes first",
        body: [
          "Artificial turf is abrasive and harder on joints than grass. Flat-soled turf shoes give the best grip on rubber-crumb surfaces. Metal or long studs sink into the turf and strain knees — many venues ban them. If you're buying your first pair, mid-range turf shoes are fine to start.",
        ],
      },
      {
        heading: "Team kit in two colours",
        body: [
          "The fastest way to split a mixed group is dark shirts versus light shirts. Bibs help, but most casual games just ask players to plan ahead. One playing ball per court is usually enough — confirm with the venue whether they provide one or you should bring your own.",
        ],
      },
      {
        heading: "Hydration and the small stuff",
        body: [
          [
            "One litre of water per player per hour of play — turf radiates heat, especially in afternoon slots",
            "A small towel and a change of shirt for after the game",
            "Shin guards for football; batting gloves if your box-cricket venue doesn't rent them",
            "A basic first-aid strip: plasters and an elastic bandage cover most turf scrapes",
          ],
        ],
      },
      {
        heading: "Before you leave the venue",
        body: [
          "Turf slots run back-to-back. Finish your game on time, collect bottles and tape, and report anything damaged to the venue staff — the next group's slot starts the moment yours ends.",
        ],
      },
    ],
  },
  {
    slug: "peak-vs-off-peak-turf-slots",
    title: "Peak vs Off-Peak Turf Slots: When to Book and Save",
    description:
      "Why the same turf costs different amounts by hour, which slots are usually cheapest, and how to plan around evening rush without losing playing quality.",
    answer:
      "Evenings after 6 PM and weekends are the peak hours at most turfs — they fill first and cost the most. Morning and early-afternoon slots on weekdays are the cheapest and quietest. On PlayTurf the price you see for each slot is the venue's own rate; booking a longer morning session often costs less than a single peak-hour slot.",
    datePublished: "2026-11-01",
    readMinutes: 4,
    sections: [
      {
        heading: "Why prices vary by hour",
        body: [
          "Turf operators set their own hourly rates and typically charge more when demand is highest — weekday evenings when office groups play, and weekend mornings and nights. Floodlit night slots carry the venue's lighting cost. None of this is a surcharge added at checkout: the rate you see for the slot is the venue's rate for that hour.",
        ],
      },
      {
        heading: "The cheapest good slots",
        body: [
          [
            "Weekday mornings (roughly 6–10 AM): cool weather, empty courts, lowest rates",
            "Weekday early afternoons: quiet, though hot in summer — bring extra water",
            "Late-night slots where the venue runs them: floodlit and often cheaper than prime evening",
          ],
          "Prime time — weekday 6–11 PM and weekends — books out first. If your group can only play prime time, book several days ahead.",
        ],
      },
      {
        heading: "Getting better value without chasing discounts",
        body: [
          "Three habits reliably reduce cost per player: book consecutive hours in one booking (one court fee, longer game), fill the squad (the court fee is per slot, not per player — ten players halve the per-head cost versus five), and use Open Games to split a slot with players you don't know yet.",
        ],
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
