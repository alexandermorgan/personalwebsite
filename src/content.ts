// The cards on /projects, /publications and /recommendations. Each card links to
// `url` (in a new tab); its Description tab opens `description` in a panel over
// whatever is below the card. Markup is in pages/partials/tile*.html and
// pages/partials/publication.html; colors are the .tone-* classes in
// styles/app.css.

export const TONES = ["red", "orange", "amber", "green", "teal", "blue", "indigo", "violet", "pink", "slate"] as const;
export type Tone = (typeof TONES)[number];

/**
 * A card's picture: a lettered cover in the card's color, optionally with an
 * image over it (the site's og:image, linked from the site itself). The image is
 * cropped to the cover's fixed size, so it can't shift the layout, and if it
 * fails to load the cover shows instead.
 */
export interface TileArt {
  cover: string;
  image?: string;
}

export interface Tile {
  title: string;
  url: string;
  /** One line under the title. */
  tagline: string;
  /** Shown when the Description tab is opened. */
  description: string;
  tone: Tone;
  art: TileArt;
  /** When it was added (YYYY-MM-DD), for the RSS feed. Optional: undated items are still in the feed. */
  added?: string;
}

export const projects: Tile[] = [
  {
    title: "Hypermedia Jobs",
    url: "https://hypermediajobs.com",
    tagline: "A job board for hypermedia-driven web development.",
    description:
      "A free job board for roles building hypermedia-driven web apps with htmx, Datastar, Hotwire, Unpoly and plain server-rendered HTML. Searching job boards for hypermedia keywords turns up almost nothing, so this collects those roles in one place. Every posting is vetted before it goes live, and listings found elsewhere link back to the original. It runs as a single Cloudflare Worker with server-rendered HTML and Datastar.",
    tone: "orange",
    art: { cover: "</>", image: "https://hypermediajobs.com/og-image.png" },
  },
  {
    title: "Sound Diagnosis",
    url: "https://sounddiagnosis.org",
    tagline: "Placeholder tagline.",
    description: "Placeholder description: replace this with a few sentences about Sound Diagnosis.",
    tone: "teal",
    art: { cover: "SD" },
  },
  {
    title: "BatchBPE",
    url: "https://github.com/alexandermorgan/BatchBPE",
    tagline: "Train a BPE tokenizer on a laptop, hundreds of merges at a time.",
    description:
      "An open-source, pure Python implementation of Byte Pair Encoding tokenizer training that safely batches hundreds of token-pair merges at a time and shrinks the memory footprint of the training text. That makes it practical to train a good tokenizer on an ordinary laptop and to experiment with new tokenization strategies, such as stop-word preprocessing or ignoring the rarest text chunks. See the paper on the Publications page.",
    tone: "indigo",
    art: { cover: "BPE", image: "https://opengraph.githubassets.com/1/alexandermorgan/BatchBPE" },
  },
  {
    title: "Humlib",
    url: "https://github.com/craigsapp/humlib",
    tagline: "C++ library for Humdrum music files.",
    description:
      "Craig Sapp's C++ library for parsing, analyzing and transforming music encoded in the Humdrum format, which powers many of the Humdrum tools and the Verovio Humdrum Viewer. I created its Renaissance dissonance classifier with Craig, which labels the type of every dissonance in a score and is available on the Josquin Research Project website.",
    tone: "green",
    art: { cover: "**kern", image: "https://opengraph.githubassets.com/1/craigsapp/humlib" },
  },
  {
    title: "Palomitas",
    url: "https://palomitas.pages.dev",
    tagline: "You are a pigeon. You are hungry. Good luck.",
    description:
      "A 3D browser game in which you play a hungry pigeon: walk, flap and peck your way around town scavenging food, take on challenges for extra points, and keep your hunger and stamina up for as long as you can. Runs end on a leaderboard.",
    tone: "slate",
    art: { cover: "Palomitas" },
  },
  {
    title: "DarkHN",
    url: "https://darkhn.com",
    tagline: "Hacker News in dark mode. Hackers have to sleep too!",
    description:
      "A dark-themed, read-only version of Hacker News for reading late at night without being blinded. Same stories, same comments, easier on the eyes.",
    tone: "amber",
    art: { cover: "Dark HN" },
  },
  {
    title: "Eightile",
    url: "https://eightile.com",
    tagline: "A daily word game.",
    description:
      "A daily word game in which you unscramble progressively longer words, working your way up to the eight-letter word. Find it in time to win.",
    tone: "violet",
    art: { cover: "Eightile", image: "https://eightile.com/Eightile_Word_Game.png" },
  },
  {
    title: "Photo Chute",
    url: "https://photo-slider-seven.vercel.app",
    tagline: "A sliding photo puzzle.",
    description:
      "A sliding-tile puzzle made from a photo: pick a picture or add your own, choose a grid size, shuffle, and slide the pieces back into place.",
    tone: "pink",
    art: { cover: "Photo Chute" },
  },
  {
    title: "EcoRate",
    url: "https://ecorate.eco",
    tagline: "Find refill stores and eco-friendly cafes.",
    description:
      "A map of nearby refill stores and sustainable cafes. EcoRate helps you find cafes that welcome your own cup, refill stores that sell the zero-waste item you're after, and more, and lets you review places on how eco-friendly they are.",
    tone: "green",
    art: { cover: "EcoRate", image: "https://pub-1918d74a21b442a78ea49895aadaf9ff.r2.dev/NYC_snapshot_2022_04_23-2-1024x584.png" },
  },
];

/**
 * A publication's card shows its title, venue and date; the Description tab
 * shows the authors, then the description.
 */
export interface Publication {
  title: string;
  url: string;
  /** Where it was published, e.g. "arXiv preprint" or "Intégral 33, pp. 47–71". */
  venue: string;
  /** Original publication date: YYYY-MM-DD, YYYY-MM or YYYY. */
  date: string;
  authors: string[];
  description: string;
  tone: Tone;
}

/** Newest first. */
export const publications: Publication[] = [
  {
    title: "pyAMPACT: A Score-Audio Alignment Toolkit for Performance Data Estimation and Multi-modal Processing",
    url: "https://arxiv.org/abs/2412.05436v2",
    venue: "arXiv preprint",
    date: "2024-12-06",
    authors: ["Johanna Devaney", "Daniel McKemie", "Alex Morgan"],
    description:
      "pyAMPACT (Python-based Automatic Music Performance Analysis and Comparison Toolkit) links symbolic and audio music representations to estimate performance data from audio, guided by the score. It reads a range of symbolic formats, uses score alignment to find the time-frequency regions that matter for each note, and estimates tuning, dynamics, timbre and timing descriptors, which it can write to MEI files linked to the notes. Beyond performance data, it provides the infrastructure for linking symbolic representations and annotations to audio for multi-modal research.",
    tone: "pink",
  },
  {
    title: "Batching BPE Tokenization Merges",
    url: "https://arxiv.org/abs/2408.04653",
    venue: "arXiv preprint",
    date: "2024-08-05",
    authors: ["Alexander P. Morgan"],
    description:
      "The Byte Pair Encoding algorithm can be safely batched to merge hundreds of pairs of tokens at a time when building up a tokenizer's vocabulary. Combined with reducing the memory footprint of the training text, this makes it feasible to train a high-quality tokenizer on a basic laptop. The paper presents BatchBPE, an open-source pure Python implementation, and uses it to explore the batch merging process and to experiment with preprocessing a stop-word list and ignoring the least common text chunks in a dataset.",
    tone: "indigo",
  },
  {
    title: "Automated Detection of Renaissance Cadential Voice Functions and Cadences",
    url: "https://crim-essays.crimproject.org/crim-essays-and-explorations/morgan-automatic-cadence-detection/",
    venue: "CRIM Project Perspectives",
    date: "2023",
    authors: ["Alexander Morgan"],
    description:
      "An essay for Citations: The Renaissance Imitation Mass (CRIM) on detecting cadential voice functions and suspension-based cadences in Renaissance polyphony automatically, using only interval-succession information. It updates the tools from the 2022 Music Encoding Conference paper with significant improvements in accuracy and reliability, and traces the theoretical and compositional origins of the cadence types they find.",
    tone: "teal",
  },
  {
    title: "Musicologists and Data Scientists Pull out all the Stops: Defining Renaissance Cadences Systematically",
    url: "https://crim-essays.crimproject.org/crim-essays-and-explorations/morgan-russobatterham-freedman-defining-cadences/",
    venue: "Music Encoding Conference Proceedings 2022, pp. 89–98",
    date: "2022",
    authors: ["Alexander Morgan", "Daniel Russo-Batterham", "Richard Freedman"],
    description:
      "How a team of musicologists and data scientists developed CRIM Intervals, a Python and Pandas toolkit for Citations: The Renaissance Imitation Mass: modeling human expertise in terms computers can use to analyze encoded scores, and presenting the results in forms scholars can interrogate and refine. Taking the cadence as a case study, it covers everything from defining the constraints of a musical event to refining the tools to eliminate false negatives and positives.",
    tone: "blue",
  },
  {
    title: "Renaissance Ternary Suspensions in Theory and Practice",
    url: "https://theory.esm.rochester.edu/integral/wp-content/uploads/2020/02/Integral_Vol_33_morgan.pdf",
    venue: "Intégral 33, pp. 47–71",
    date: "2019",
    authors: ["Alexander Morgan"],
    description:
      "Renaissance suspensions differ from their tonal counterparts, chiefly because of an additional component theorized here for the first time: the perfection phase, which comes immediately after the resolution. The difference in metric structure is especially significant in ternary meter. A corpus study using the Humdrum Renaissance dissonance classifier shows how common ternary suspensions are and how they track changes in compositional style, and a survey of dozens of treatises and textbooks shows how they have been overlooked in teaching for centuries.",
    tone: "amber",
  },
  {
    title: "Renaissance Interval-Succession Theory: Treatises and Analysis",
    url: "https://mcgill.scholaris.ca/bitstreams/8ba066f4-f8bc-4539-acd2-e0298923cc04/download",
    venue: "PhD dissertation, McGill University",
    date: "2016-08",
    authors: ["Alexander Morgan"],
    description:
      "Interval-succession treatises taught idiomatic polyphony for centuries by listing which vertical intervals between two voices could follow one another. This dissertation is the first comprehensive, computer-assisted study of their examples. It refutes the common belief that Tinctoris's list of 768 interval successions is exhaustive and uncovers nine tacit voice-leading principles behind it, gives the first in-depth study of Pietro Pontio's 123 interval successions and his inclusion of dissonance, and examines contrapuntal rhythm in theory and analysis.",
    tone: "red",
  },
  {
    title: "Untangling Spletna: The Interaction of Janáček's Theories and the Transformational Structure of On an Overgrown Path",
    url: "https://music.unt.edu/mhte/sites/default/files/janacek-harmonia-final.pdf#page=69",
    venue: "Harmonia, special issue Leoš Janáček: Life, Work, and Contribution, pp. 65–78",
    date: "2013-05",
    authors: ["Alexander Morgan"],
    description:
      "Janáček's idiosyncratic music theories never gained much currency with other theorists, but they were essential to his own compositional process. This article uses them to gain perspective on his piano cycle On an Overgrown Path, and shows how noteworthy moments in the cycle are mirrored in the transformational structure of several of its pieces, in particular the relative and parallel transformations and their combinations.",
    tone: "violet",
  },
];

export const recommendations: Tile[] = [
  {
    title: "tldraw",
    url: "https://tldraw.com",
    tagline: "A very good free whiteboard.",
    description:
      "An instant, free, collaborative whiteboard that works on any device with no sign-up. It's a joy to sketch with, and the team also makes the infinite-canvas SDK it's built on.",
    tone: "blue",
    art: { cover: "tldraw", image: "https://www.tldraw.com/social-og.png" },
  },
  {
    title: "neal.fun",
    url: "https://neal.fun",
    tagline: "Games, visualizations, interactives and other weird stuff.",
    description:
      "Neal Agarwal's collection of delightful web toys, games and visualizations, from the deep sea to the size of space. The cards on this site are a nod to its home page.",
    tone: "pink",
    art: { cover: "neal.fun" },
  },
  {
    title: "htmx essays",
    url: "https://htmx.org/essays/",
    tagline: "Essays on hypermedia, REST and building for the web.",
    description:
      "The htmx project's essays on hypermedia, REST, HATEOAS and web application architecture, including the ones that explain why returning HTML from the server is still a great way to build for the web.",
    tone: "slate",
    art: { cover: "</> htmx" },
  },
];
