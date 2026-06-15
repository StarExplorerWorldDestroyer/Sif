/**
 * Starter catalog for the Discover tab.
 *
 * This is hand-seeded reference content meant to get the feature usable before
 * a professional (stylist / barber) reviews and expands it. Each entry is
 * intentionally concise. `examples` is left empty for now — the detail screen
 * shows a "coming soon" state until real, rights-cleared example photos exist.
 */

export type CutLength = 'Buzzed' | 'Short' | 'Medium' | 'Shoulder' | 'Long';
export type HairType = 'Straight' | 'Wavy' | 'Curly' | 'Coily';
export type HairTexture = 'Fine' | 'Medium' | 'Thick' | 'Coarse';
export type Maintenance = 'Low' | 'Medium' | 'High';

export type HaircutStyle = {
  id: string;
  name: string;
  /** Other common names people search for. */
  alsoCalled?: string[];
  length: CutLength;
  /** Curl patterns the cut tends to flatter. */
  hairTypes: HairType[];
  /** Hair densities/textures the cut works well with. */
  textures: HairTexture[];
  maintenance: Maintenance;
  /** One- or two-line plain-language description. */
  summary: string;
  /** A little background / origin. */
  history: string;
  /** Who tends to love this cut. */
  goodFor: string[];
  /** Things to consider before committing. */
  watchOuts: string[];
  /** Example photo URLs (people, hair types). Empty until curated. */
  examples: string[];
};

export const LENGTHS: CutLength[] = ['Buzzed', 'Short', 'Medium', 'Shoulder', 'Long'];
export const HAIR_TYPES: HairType[] = ['Straight', 'Wavy', 'Curly', 'Coily'];
export const MAINTENANCE_LEVELS: Maintenance[] = ['Low', 'Medium', 'High'];

export const HAIRCUT_STYLES: HaircutStyle[] = [
  {
    id: 'buzz-cut',
    name: 'Buzz Cut',
    alsoCalled: ['Induction cut', 'Butch'],
    length: 'Buzzed',
    hairTypes: ['Straight', 'Wavy', 'Curly', 'Coily'],
    textures: ['Fine', 'Medium', 'Thick', 'Coarse'],
    maintenance: 'Low',
    summary:
      'Hair clipped to a uniform, very short length all over with clippers. About as simple and low-effort as a haircut gets.',
    history:
      'Popularized by militaries for hygiene and uniformity, the buzz cut moved into mainstream fashion through the 20th century and is now a staple of minimalist style.',
    goodFor: [
      'Anyone wanting near-zero daily styling',
      'Thick or coarse hair that is hard to manage long',
      'Showing off strong facial features and bone structure',
    ],
    watchOuts: [
      'Exposes the scalp and head shape — uneven shapes show more',
      'Grows out quickly; needs a re-buzz every couple of weeks to stay sharp',
      'Less coverage means more sunscreen and cold-weather hats',
    ],
    examples: [],
  },
  {
    id: 'crew-cut',
    name: 'Crew Cut',
    length: 'Short',
    hairTypes: ['Straight', 'Wavy'],
    textures: ['Fine', 'Medium', 'Thick'],
    maintenance: 'Low',
    summary:
      'Short on the back and sides, slightly longer on top tapering from front to crown. A clean, classic, professional look.',
    history:
      'Named for the rowing crews of Ivy League universities in the 1920s–30s who wore the short style to keep hair out of their eyes.',
    goodFor: [
      'Professional settings and easy upkeep',
      'Most face shapes',
      'People who want a little length to style without commitment',
    ],
    watchOuts: [
      'Very curly or coily hair may need a different short cut to behave',
      'Needs a trim every 3–4 weeks to keep the shape',
    ],
    examples: [],
  },
  {
    id: 'caesar-cut',
    name: 'Caesar Cut',
    length: 'Short',
    hairTypes: ['Straight', 'Wavy'],
    textures: ['Fine', 'Medium', 'Thick'],
    maintenance: 'Low',
    summary:
      'Short, uniform length with a short, horizontal fringe brushed forward. Great for adding the look of fullness up front.',
    history:
      'Named after Julius Caesar, who was often depicted with hair combed forward. It saw a big revival in the 1990s.',
    goodFor: [
      'Receding or thinning hairlines (the forward fringe helps)',
      'Low-effort styling',
      'Round and oval faces',
    ],
    watchOuts: ['Can read as dated if too blunt', 'Not ideal for very curly hair'],
    examples: [],
  },
  {
    id: 'french-crop',
    name: 'French Crop',
    alsoCalled: ['Crop top'],
    length: 'Short',
    hairTypes: ['Straight', 'Wavy', 'Curly'],
    textures: ['Fine', 'Medium', 'Thick'],
    maintenance: 'Low',
    summary:
      'Short sides (often faded) with textured length on top and a short, blunt fringe. Modern, easy, and flattering.',
    history:
      'A contemporary European barbershop staple that reworks the Caesar with more texture and a faded or tapered back and sides.',
    goodFor: [
      'Forehead you want to soften or shorten',
      'Fine hair that needs the look of density',
      'Low styling time with a modern edge',
    ],
    watchOuts: ['Coily hair may want a curly-specific variation', 'Fringe needs occasional trimming'],
    examples: [],
  },
  {
    id: 'taper-fade',
    name: 'Taper Fade',
    alsoCalled: ['Fade'],
    length: 'Short',
    hairTypes: ['Straight', 'Wavy', 'Curly', 'Coily'],
    textures: ['Fine', 'Medium', 'Thick', 'Coarse'],
    maintenance: 'Medium',
    summary:
      'Hair gradually shortens down the sides and back to the skin or near-skin. Pairs with almost any length on top.',
    history:
      'Rooted in Black barbershop culture, the fade became one of the most requested techniques worldwide for its clean, gradient finish.',
    goodFor: [
      'A crisp, modern outline',
      'Pairing with many top styles (crop, pomp, curls)',
      'All hair types',
    ],
    watchOuts: [
      'The sharp gradient softens fast — touch-ups every 2–3 weeks',
      'Quality depends heavily on the barber’s skill',
    ],
    examples: [],
  },
  {
    id: 'undercut',
    name: 'Undercut',
    length: 'Medium',
    hairTypes: ['Straight', 'Wavy'],
    textures: ['Fine', 'Medium', 'Thick'],
    maintenance: 'Medium',
    summary:
      'Sides and back cut very short (one length, not graduated) with a distinctly longer, disconnected top.',
    history:
      'A 1910s–20s cut that roared back in the 2010s as a bold, high-contrast style favored in fashion and barbering.',
    goodFor: [
      'High-contrast, statement looks',
      'Slicking back or styling the top in different ways',
      'Thick straight hair',
    ],
    watchOuts: [
      'The disconnect can look awkward in the grow-out phase',
      'Top usually needs product to look intentional',
    ],
    examples: [],
  },
  {
    id: 'pompadour',
    name: 'Pompadour',
    length: 'Medium',
    hairTypes: ['Straight', 'Wavy'],
    textures: ['Medium', 'Thick'],
    maintenance: 'High',
    summary:
      'Volume swept up and back from the forehead, short on the sides. A bold, retro-glam silhouette.',
    history:
      'Named after Madame de Pompadour in 18th-century France; reinvented by 1950s rockabilly icons like Elvis Presley.',
    goodFor: ['Thick hair with body', 'Making a statement', 'Adding height to balance the face'],
    watchOuts: [
      'High effort: blow-drying and pomade most days',
      'Fine or limp hair struggles to hold the volume',
    ],
    examples: [],
  },
  {
    id: 'quiff',
    name: 'Quiff',
    length: 'Medium',
    hairTypes: ['Straight', 'Wavy'],
    textures: ['Medium', 'Thick'],
    maintenance: 'High',
    summary:
      'Volume and texture lifted at the front, looser and more tousled than a pompadour, shorter at the back and sides.',
    history:
      'A post-war British style blending the pompadour and the flat-top; revived repeatedly through mod, punk, and modern menswear.',
    goodFor: ['Adding height and movement', 'Most face shapes', 'A modern but classic vibe'],
    watchOuts: ['Daily styling with product and heat', 'Needs regular trims to keep proportions'],
    examples: [],
  },
  {
    id: 'comb-over',
    name: 'Comb Over',
    length: 'Medium',
    hairTypes: ['Straight', 'Wavy'],
    textures: ['Fine', 'Medium', 'Thick'],
    maintenance: 'Medium',
    summary:
      'Hair parted and combed across to one side, often paired with a fade or taper for a polished, professional finish.',
    history:
      'A timeless gentlemanly style that has stayed in rotation for over a century and pairs naturally with modern fades.',
    goodFor: ['Office-friendly polish', 'A defined side part', 'Fine to thick straight hair'],
    watchOuts: ['Needs a comb and a little product', 'Cowlicks can fight the part'],
    examples: [],
  },
  {
    id: 'top-knot',
    name: 'Top Knot / Man Bun',
    alsoCalled: ['Bun'],
    length: 'Long',
    hairTypes: ['Straight', 'Wavy', 'Curly'],
    textures: ['Medium', 'Thick'],
    maintenance: 'Medium',
    summary:
      'Longer hair gathered and tied at the crown (top knot) or back (bun), frequently with short or faded sides.',
    history:
      'Worn across many cultures for centuries; surged as a mainstream men’s trend in the 2010s.',
    goodFor: ['Those growing hair out', 'Keeping long hair off the face', 'Versatile up/down styling'],
    watchOuts: [
      'Requires real length to tie back',
      'Tying too tight repeatedly can stress the hairline',
    ],
    examples: [],
  },
  {
    id: 'curtain-bangs',
    name: 'Curtains',
    alsoCalled: ['Curtain bangs', 'Middle part'],
    length: 'Medium',
    hairTypes: ['Straight', 'Wavy'],
    textures: ['Fine', 'Medium', 'Thick'],
    maintenance: 'Medium',
    summary:
      'A center-parted style where the front pieces frame the face like curtains. Effortless, 90s-leaning, and flattering.',
    history:
      'A defining 1990s look (think boy bands and indie icons) that returned strongly in recent years.',
    goodFor: ['Framing the face', 'Wavy hair that falls naturally', 'A relaxed, undone vibe'],
    watchOuts: ['Grow-out length needed before it sits right', 'Cowlicks may resist a clean center part'],
    examples: [],
  },
  {
    id: 'mullet',
    name: 'Mullet',
    alsoCalled: ['Business in front, party in back'],
    length: 'Medium',
    hairTypes: ['Straight', 'Wavy'],
    textures: ['Medium', 'Thick'],
    maintenance: 'Medium',
    summary:
      'Short at the front and sides, long at the back. Once a punchline, now a bold, fashion-forward statement.',
    history:
      'Ancient in origin but cemented in the 1970s–80s; reclaimed in the 2020s as an edgy, ironic-to-earnest favorite.',
    goodFor: ['Standing out', 'Editorial / alternative style', 'Thick hair with movement'],
    watchOuts: ['Polarizing in conservative settings', 'Needs shaping to avoid looking unkempt'],
    examples: [],
  },
  {
    id: 'wolf-cut',
    name: 'Wolf Cut',
    length: 'Shoulder',
    hairTypes: ['Wavy', 'Curly'],
    textures: ['Medium', 'Thick'],
    maintenance: 'Medium',
    summary:
      'A shaggy hybrid of the mullet and the shag: choppy layers up top, wispy length below, heavy texture throughout.',
    history:
      'A 2020s social-media-born trend blending Korean and Western shag influences into a heavily layered look.',
    goodFor: ['Adding volume and movement', 'Wavy hair that loves texture', 'A trendy, lived-in feel'],
    watchOuts: ['Lots of layers can be hard to grow out evenly', 'Fine hair may look thin at the ends'],
    examples: [],
  },
  {
    id: 'pixie-cut',
    name: 'Pixie Cut',
    length: 'Short',
    hairTypes: ['Straight', 'Wavy'],
    textures: ['Fine', 'Medium', 'Thick'],
    maintenance: 'Medium',
    summary:
      'A short, cropped cut, usually shorter at the back and sides with a little length on top to style.',
    history:
      'Popularized by 1950s–60s icons like Audrey Hepburn and Twiggy, and a recurring symbol of bold, low-fuss style.',
    goodFor: ['A striking, low-volume look', 'Highlighting the eyes and cheekbones', 'Fine hair (adds shape)'],
    watchOuts: ['Frequent trims (every 4–6 weeks) to keep shape', 'Big change — grow-out takes patience'],
    examples: [],
  },
  {
    id: 'bob',
    name: 'Bob',
    length: 'Short',
    hairTypes: ['Straight', 'Wavy'],
    textures: ['Fine', 'Medium', 'Thick'],
    maintenance: 'Medium',
    summary:
      'A classic chin- to jaw-length cut, usually one length, with countless variations (blunt, angled, textured).',
    history:
      'A revolutionary symbol of independence in the 1920s flapper era; endlessly reinvented ever since.',
    goodFor: ['A timeless, versatile shape', 'Adding the appearance of thickness', 'Most face shapes'],
    watchOuts: ['Blunt versions need healthy ends', 'Curly hair changes the silhouette — plan for it'],
    examples: [],
  },
  {
    id: 'lob',
    name: 'Lob',
    alsoCalled: ['Long bob'],
    length: 'Shoulder',
    hairTypes: ['Straight', 'Wavy'],
    textures: ['Fine', 'Medium', 'Thick'],
    maintenance: 'Low',
    summary:
      'A longer bob that hits around the shoulders or collarbone. Lower upkeep than a true bob with similar polish.',
    history:
      'A 2010s mainstay championed across fashion and celebrity culture for being chic yet easy.',
    goodFor: ['People who want length without much fuss', 'Wavy hair', 'Easy up-styling'],
    watchOuts: ['Can fall flat without a few layers', 'Trims every 8–10 weeks to keep ends clean'],
    examples: [],
  },
  {
    id: 'shag',
    name: 'Shag',
    length: 'Shoulder',
    hairTypes: ['Wavy', 'Curly'],
    textures: ['Medium', 'Thick'],
    maintenance: 'Medium',
    summary:
      'Heavily layered with feathered ends and usually some fringe, built for volume, texture, and movement.',
    history:
      'A 1970s rock-and-roll icon (Jane Fonda, David Bowie) that has cycled back into fashion repeatedly.',
    goodFor: ['Wavy and curly hair', 'Adding body and movement', 'An effortless, rock-leaning vibe'],
    watchOuts: ['Layering must suit your texture', 'Fine hair can look sparse at the tips'],
    examples: [],
  },
  {
    id: 'layered-cut',
    name: 'Layered Cut',
    length: 'Long',
    hairTypes: ['Straight', 'Wavy', 'Curly'],
    textures: ['Medium', 'Thick', 'Coarse'],
    maintenance: 'Medium',
    summary:
      'Hair cut at varying lengths to remove weight, add movement, and shape volume around the face.',
    history:
      'A foundational technique rather than a single trend, layering underpins many modern long-hair styles.',
    goodFor: ['Heavy or thick hair that needs movement', 'Face-framing', 'Versatile styling'],
    watchOuts: ['Over-layering thin hair can reduce density', 'Curly hair needs a curl-aware approach'],
    examples: [],
  },
  {
    id: 'blunt-cut',
    name: 'Blunt Cut',
    length: 'Long',
    hairTypes: ['Straight'],
    textures: ['Fine', 'Medium'],
    maintenance: 'Low',
    summary:
      'One length, cut straight across with no layering. Looks sleek, dense, and polished — especially on straight hair.',
    history:
      'A minimalist, high-impact look that has stayed in fashion as a counterpoint to heavily layered styles.',
    goodFor: ['Making fine hair look fuller', 'A sleek, modern statement', 'Straight hair'],
    watchOuts: ['Shows split ends easily — keep ends healthy', 'Can feel heavy on very thick hair'],
    examples: [],
  },
  {
    id: 'afro',
    name: 'Afro',
    length: 'Medium',
    hairTypes: ['Coily'],
    textures: ['Thick', 'Coarse'],
    maintenance: 'Medium',
    summary:
      'Natural coily hair grown out and shaped into a rounded silhouette that celebrates volume and texture.',
    history:
      'A powerful symbol of Black pride and identity, especially through the 1960s–70s civil rights era, and an enduring natural-hair staple.',
    goodFor: ['Embracing natural coily texture', 'Bold volume', 'A shape that frames the face'],
    watchOuts: [
      'Daily moisture and picking to keep shape',
      'Regular shaping keeps the silhouette even',
    ],
    examples: [],
  },
  {
    id: 'tapered-afro',
    name: 'Tapered Afro',
    length: 'Short',
    hairTypes: ['Coily'],
    textures: ['Thick', 'Coarse'],
    maintenance: 'Medium',
    summary:
      'Natural coils kept fuller on top and gradually shorter at the sides and back for a clean, modern shape.',
    history:
      'A contemporary natural-hair favorite combining the afro’s texture with barbershop tapering.',
    goodFor: ['A polished take on natural hair', 'Defined shape with low daily styling', 'Coily textures'],
    watchOuts: ['The taper needs touch-ups to stay crisp', 'Moisture routine still important'],
    examples: [],
  },
  {
    id: 'locs',
    name: 'Locs',
    alsoCalled: ['Dreadlocks'],
    length: 'Long',
    hairTypes: ['Coily', 'Curly'],
    textures: ['Medium', 'Thick', 'Coarse'],
    maintenance: 'Low',
    summary:
      'Hair encouraged to coil and lock into rope-like strands over time. A long-term, low-daily-effort commitment.',
    history:
      'Found across many cultures and central to Rastafarian identity; today a widespread protective and expressive style.',
    goodFor: ['A long-term, low daily-styling style', 'Coily and curly textures', 'Expressive length'],
    watchOuts: [
      'A real commitment — difficult to undo',
      'Needs periodic retwisting/maintenance and proper drying',
    ],
    examples: [],
  },
  {
    id: 'cornrows',
    name: 'Cornrows',
    alsoCalled: ['Braids'],
    length: 'Medium',
    hairTypes: ['Coily', 'Curly'],
    textures: ['Medium', 'Thick', 'Coarse'],
    maintenance: 'Low',
    summary:
      'Hair braided flat to the scalp in rows and patterns. A protective style that lasts for weeks once installed.',
    history:
      'An ancient African braiding tradition carrying deep cultural meaning and artistry across centuries.',
    goodFor: ['Protective styling', 'Low daily upkeep once installed', 'Intricate patterns'],
    watchOuts: [
      'Install takes time and skill',
      'Braiding too tightly can stress the scalp and edges',
    ],
    examples: [],
  },
];

export function getStyleById(id: string): HaircutStyle | undefined {
  return HAIRCUT_STYLES.find((s) => s.id === id);
}
