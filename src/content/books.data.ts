import type { Book } from '../types';

/**
 * THE LIBRARY. This is the file to edit.
 *
 * Twenty genres, five books each. Plain data — no ids, no logic. `library.ts`
 * derives everything else from what is here, so changing a review or swapping a
 * book out is a single edit in a single file.
 *
 * The list is meant to hold to three rules:
 *   - Every book is real. Each one here was checked against the web for
 *     existence, authorship and publication year before it went in.
 *   - No number-one bestsellers, no prize-winners everyone already owns, no
 *     books with a famous film made of them.
 *   - But they must be genuinely good. Obscure is not the point; obscure and
 *     brilliant is.
 *
 * No `id` field — it is derived from genre + title. No link field either; links
 * are built as searches in `src/lib/links.ts`, because a hand-written product
 * URL rots the moment an edition goes out of print and a search does not.
 */

export type BookData = Omit<Book, 'id'>;

export type GenreData = {
  slug: string;
  name: string;
  books: BookData[];
};

export const GENRE_DATA: GenreData[] = [
  {
    slug: "literary-fiction",
    name: "Literary Fiction",
    books: [
      {
        title: "Journey by Moonlight",
        author: "Antal Szerb",
        year: 1937,
        origin: "Hungary, tr. from Hungarian",
        hook: "A honeymooner steps off the wrong train and keeps walking.",
        review:
          "Mihály is on his honeymoon in Italy when he steps off a train at a small station and simply doesn't get back on. What follows is a man walking away from adulthood into the pull of his teenage friends, one of whom killed himself. Szerb writes about the wish to disappear with real warmth and no self-pity.",
        underdog:
          "Szerb was murdered in a labour camp in 1945 and had no proper English translation until Len Rix's in 2001.",
        tags: ["central european","wandering","interwar"],
      },
      {
        title: "Nada",
        author: "Carmen Laforet",
        year: 1945,
        origin: "Spain, tr. from Spanish",
        hook: "Postwar Barcelona through the eyes of a hungry, watchful eighteen-year-old.",
        review:
          "Andrea arrives in Barcelona at eighteen to study, expecting freedom, and finds her relatives starving in a filthy flat on Calle de Aribau — a violent uncle, a beautiful battered aunt, a grandmother giving away her own food. Laforet was twenty-three when she wrote it. The hunger is literal, and the prose stays cold and exact throughout.",
        underdog:
          "A canonical novel in Spain that went essentially unread in English until Edith Grossman translated it in 2007.",
        tags: ["coming of age","postwar","spanish"],
      },
      {
        title: "The Vet's Daughter",
        author: "Barbara Comyns",
        year: 1959,
        origin: "United Kingdom, English",
        hook: "A brutalised London girl discovers she can float above her bed.",
        review:
          "Alice keeps house for a vet in Battersea who is cruel to animals and worse to people. Her mother dies, a barmaid moves in, and then Alice discovers she can rise off her bed into the air. Comyns tells it in a flat, polite girl's voice that makes the horror land sideways. The ending is genuinely shocking.",
        underdog:
          "Fell out of print twice; rescued by Virago in the 1980s and again by NYRB decades later.",
        tags: ["english eerie","domestic horror","short novel"],
      },
      {
        title: "The Ice Palace",
        author: "Tarjei Vesaas",
        year: 1963,
        origin: "Norway, tr. from Norwegian",
        hook: "One girl walks into a frozen waterfall; the other must live on.",
        review:
          "Two eleven-year-old girls spend one charged evening together in a Norwegian village. The next morning Unn skips school to see the frozen waterfall, walks into its chambers of ice, and does not come out. The rest is Siss carrying a promise she can't explain to anyone. Very short, mostly weather and silence, and it works on you for years.",
        underdog:
          "Vesaas is a giant in Norway and a footnote in English, overshadowed by Hamsun and later Knausgaard.",
        tags: ["nordic","childhood","grief"],
      },
      {
        title: "Basti",
        author: "Intizar Husain",
        year: 1979,
        origin: "Pakistan, tr. from Urdu",
        hook: "A man who lost one country in 1947 watches another split.",
        review:
          "Zakir teaches history in Lahore while the 1971 war tears the country in half again, and he keeps sliding back to Rupnagar, the village of his childhood before Partition, and to Sabirah, who stayed in India. Husain writes memory as interruption — letters, dreams, coffee-house arguments. It's about a man who has already lost one country watching a second one break.",
        underdog:
          "Written in Urdu and untranslated for sixteen years; only reached Western readers via a small 2012 reissue.",
        tags: ["south asian","partition","memory","political"],
      },
    ],
  },
  {
    slug: "science-fiction",
    name: "Science Fiction",
    books: [
      {
        title: "Inter Ice Age 4",
        author: "Kobo Abe",
        year: 1959,
        origin: "Japan, tr. from Japanese",
        hook: "A forecasting computer is pointed at a random stranger, and he turns up dead.",
        review:
          "Abe wrote this in 1959 and it reads like an argument with the future. A computer that predicts individuals is politically dangerous, so its builders test it on a stranger picked off the street — who is promptly murdered. The trail leads to underwater children bred from purchased fetuses. Then the machine turns on its maker. Cold, procedural, and genuinely upsetting about what continuity costs.",
        underdog:
          "Buried under the fame of The Woman in the Dunes and its film.",
        tags: ["prediction","japanese sf","biopunk","1950s"],
      },
      {
        title: "Memoirs of a Spacewoman",
        author: "Naomi Mitchison",
        year: 1962,
        origin: "Scotland, English",
        hook: "An exploration biologist communicates with aliens by making herself vulnerable to them.",
        review:
          "Mary travels between worlds as a communications specialist, and Mitchison is interested in the ethical mess of contact rather than its hardware. She reasons with radially symmetrical starfish people whose morality comes in fives, argues about interfering with a caterpillar species, and volunteers to carry a Martian graft in her own body. Written in 1962, matter-of-fact about sex, and much stranger than its reputation.",
        underdog:
          "Written by a novelist known for historical fiction, and out of print for decades.",
        tags: ["first contact","xenobiology","feminist sf","1960s"],
      },
      {
        title: "His Master's Voice",
        author: "Stanisław Lem",
        year: 1968,
        origin: "Poland, tr. from Polish",
        hook: "A thousand scientists spend years failing to read a message from the stars.",
        review:
          "A neutrino stream from space turns out to be a repeating signal, and the US government buries a research team in a desert to crack it. They produce a substance that might be a weapon, or a byproduct, or nothing. Lem writes it as the memoir of a mathematician who distrusts his own decency, and most of the book is argument about whether understanding is even possible.",
        underdog:
          "Solaris takes all the oxygen; this waited fifteen years for an English translation.",
        tags: ["first contact","polish sf","epistemology"],
      },
      {
        title: "Trafalgar",
        author: "Angélica Gorodischer",
        year: 1979,
        origin: "Argentina, tr. from Spanish",
        hook: "A Rosario salesman drinks coffee and describes the planets he sells things to.",
        review:
          "Trafalgar Medrano trades goods across the galaxy and comes home to Rosario to talk about it over coffee, at length, to whoever will sit still. The stories are the point — deals that go sideways, a world stuck reliving its own history — but the digressions and the coffee refills matter just as much. Gorodischer lets him ramble, contradict himself, and flirt badly.",
        underdog:
          "Untranslated into English for thirty-four years, and still shelved as a curiosity.",
        tags: ["short stories","latin american sf","space trader"],
      },
      {
        title: "Amatka",
        author: "Karin Tidbeck",
        year: 2012,
        origin: "Sweden, tr. from Swedish",
        hook: "In this colony, objects dissolve unless you say their names out loud.",
        review:
          "Vanja arrives in Amatka to survey demand for hygiene products and finds a settlement where every object must be regularly told what it is. Stop marking your suitcase and it collapses into white sludge. The bureaucratic tedium is deliberate and the dread builds under it, and when the language starts failing the book goes somewhere much odder than dystopia.",
        underdog:
          "Short, translated by the author, and lost among the year's louder dystopias.",
        tags: ["language","dystopia","nordic sf","weird"],
      },
    ],
  },
  {
    slug: "fantasy",
    name: "Fantasy",
    books: [
      {
        title: "The Other Side",
        author: "Alfred Kubin",
        year: 1909,
        origin: "Austria, tr. from German",
        hook: "A city built from salvaged buildings, where nothing new is allowed, starts rotting.",
        review:
          "An artist accepts an invitation from a rich school friend to the Dream Kingdom, a walled city in Central Asia assembled entirely from salvaged old European buildings, where nothing new is permitted and the sun never quite shines. Then an American arrives with money and opinions, and the place rots — insects, sleeping sickness, buildings going soft. Kubin wrote it in twelve weeks and drew the pictures himself.",
        underdog:
          "Kubin is filed away as a graphic artist; his only novel stayed a footnote to his drawings.",
        tags: ["dream logic","decay","illustrated","central european weird"],
      },
      {
        title: "The Palm-Wine Drinkard",
        author: "Amos Tutuola",
        year: 1952,
        origin: "Nigeria, English",
        hook: "He walks into the land of the dead to retrieve his palm-wine tapster.",
        review:
          "The narrator drinks 225 kegs of palm wine a day until his tapster falls from a tree and dies, so he walks into the bush to fetch him back from Deads' Town. Along the way: a gentleman who has rented his body parts and returns them one by one, a half-bodied baby, a mother living inside a white tree. The English is Tutuola's own invention.",
        underdog:
          "Dismissed at home for decades as badly written English, so it never settled into any syllabus.",
        tags: ["yoruba folklore","quest","invented english"],
      },
      {
        title: "Kingdoms of Elfin",
        author: "Sylvia Townsend Warner",
        year: 1977,
        origin: "England, English",
        hook: "Fairy courts run as bored aristocracies, with etiquette where the cruelty should be.",
        review:
          "Sixteen stories about fairy courts — Scotland, Brittany, Persia, the Low Countries — written when Warner was in her eighties and published mostly in The New Yorker. Her elfins are small, cold and bored, live for centuries, keep human changelings as pets, and treat cruelty as a matter of etiquette. Court gossip, succession politics, and the occasional flight over a graveyard. Very funny, then suddenly not.",
        underdog:
          "Her final book, overshadowed by Lolly Willowes and out of print for roughly forty years.",
        tags: ["fairy courts","short stories","cold comedy"],
      },
      {
        title: "Kalpa Imperial",
        author: "Angélica Gorodischer",
        year: 1983,
        origin: "Argentina, tr. from Spanish",
        hook: "The invented history of an empire, told by storytellers who distrust official versions.",
        review:
          "Eleven stories told by professional storytellers about an empire that never existed — its dynasties, its usurpers, a beggar who becomes emperor, a city built and rebuilt in the wrong place. There is no map, no hero, no magic system, and no plot in the usual sense. What accumulates instead is the feel of a very long history told by people who distrust official versions.",
        underdog:
          "Ursula K. Le Guin translated it herself and it still sat quietly on a small press backlist.",
        tags: ["invented history","linked stories","latin american"],
      },
      {
        title: "Vita Nostra",
        author: "Marina & Sergey Dyachenko",
        year: 2007,
        origin: "Ukraine, tr. from Russian",
        hook: "A girl is coerced into a school where students become parts of speech.",
        review:
          "A teenager on holiday is followed by a man in dark glasses who tells her to swim in the sea at four in the morning. She obeys; she starts vomiting gold coins; the coins pay her tuition. At the institute the textbooks are unreadable by design, failure injures your family, and the students are slowly being turned into parts of speech.",
        underdog:
          "Waited eleven years for an English translation and still travels mostly by word of mouth.",
        tags: ["dark academia","metaphysics","coercion","eastern european"],
      },
    ],
  },
  {
    slug: "horror",
    name: "Horror",
    books: [
      {
        title: "The Uninhabited House",
        author: "Charlotte Riddell",
        year: 1875,
        origin: "Ireland/England, in English",
        hook: "A law clerk must find out why no tenant will stay the night.",
        review:
          "River Hall is a pleasant villa on the Thames that no tenant will stay in twice. Riddell frames the ghost as a property problem: unpaid rent, a widow's dwindling income, a law office trying to shift an unlettable asset. Then the clerk agrees to sit up alone in the place. What arrives is quiet, patient, and entirely about money.",
        underdog:
          "unread for a century until small-press reprints; Le Fanu and Dickens took all the shelf space",
        tags: ["victorian","ghost story","haunted house"],
      },
      {
        title: "The Dark Domain",
        author: "Stefan Grabiński",
        year: 1993,
        origin: "Poland, tr. from Polish (stories written 1918–22)",
        hook: "Polish weird tales in which the railway itself is the appetite.",
        review:
          "Grabiński wrote these around 1920 in Lviv, and half of them are about trains — a phantom express appearing on no timetable, passengers who become someone else in a locked compartment. He treats motion itself as an appetite. Elsewhere a man is summoned nightly to a woman's house and slowly works out what he's been touching. Fast, strange, unexplained.",
        underdog:
          "died of tuberculosis in 1936 barely read at home, and went untranslated into English until the 1990s",
        tags: ["weird fiction","short stories","interwar"],
      },
      {
        title: "Cold Hand in Mine",
        author: "Robert Aickman",
        year: 1975,
        origin: "England, in English",
        hook: "Eight stories that go wrong quietly and never tell you why.",
        review:
          "Aickman called them strange stories, not horror, and he meant it: no monsters, no explanations, just an ordinary Englishman taking a wrong turn into a world with different rules. In 'The Hospice,' a man with car trouble stops at a guest house for dinner and notices the other diners are chained at the ankle. Nobody comments. He stays the night.",
        underdog:
          "he spent his working life campaigning to restore canals, and the books drift in and out of print",
        tags: ["strange stories","quiet horror","short stories"],
      },
      {
        title: "The Elementals",
        author: "Michael McDowell",
        year: 1981,
        origin: "USA, in English",
        hook: "Three Victorian houses on a sandbar; the third is filling with sand.",
        review:
          "It opens at a funeral where the family stabs the corpse before closing the coffin, and McDowell never bothers to explain that either. Then two families decamp to Beldame, a spit of Alabama beach with three houses on it. One is being swallowed by a dune. The heat, the boredom, and the sand do most of the work.",
        underdog:
          "a drugstore paperback original, out of print for decades and overshadowed by his screenwriting",
        tags: ["southern gothic","haunted house","cult paperback"],
      },
      {
        title: "The Graveyard Apartment",
        author: "Mariko Koike",
        year: 1986,
        origin: "Japan, tr. from Japanese",
        hook: "A family moves in beside the graveyard; then the neighbours start leaving.",
        review:
          "A young Tokyo family takes a bargain apartment in a new building beside a temple graveyard and crematorium. Nothing dramatic happens for a long time. Residents move out, one by one, for reasons they'd rather not say. The elevator misbehaves. The basement is colder than it should be. By the end there is nobody left in the building but them.",
        underdog:
          "thirty years untranslated, and Koike is known at home for mysteries and romance rather than this",
        tags: ["j-horror","slow burn","haunted building"],
      },
    ],
  },
  {
    slug: "mystery",
    name: "Mystery & Detective",
    books: [
      {
        title: "The Notting Hill Mystery",
        author: "Charles Felix (Charles Warren Adams)",
        year: 1865,
        origin: "England",
        hook: "A Victorian insurance claim file that happens to be the first detective novel.",
        review:
          "The whole book is a case file: depositions, a chemist's report, diary pages, a floor plan. An insurance investigator suspects Baron R— of murdering his wife for five policies, using her twin sister as the instrument. You assemble the crime from paperwork yourself, which makes reading it feel like actual work, the good kind. Serialised in 1862, six years ahead of The Moonstone.",
        underdog:
          "out of print for nearly 150 years until the British Library reissued it",
        tags: ["dossier-novel","victorian","epistolary","proto-detective"],
      },
      {
        title: "The Investigation",
        author: "Stanisław Lem",
        year: 1959,
        origin: "Poland, tr. from Polish",
        hook: "Corpses shift position in English morgues; Scotland Yard assigns a statistician.",
        review:
          "Bodies in rural English mortuaries change position, then walk off. Lieutenant Gregory works the case straight while a statistician demonstrates the incidents fit a distribution curve tied to local cancer rates. Lem lets the procedure run its full course, then withholds the solution on principle, closing with an invented explanation everyone can live with. Fog, bad tea, mounting dread.",
        underdog:
          "buried under the Solaris avalanche; nobody knows Lem wrote a detective novel",
        tags: ["anti-detective","unresolved","procedural"],
      },
      {
        title: "The Mongolian Conspiracy",
        author: "Rafael Bernal",
        year: 1969,
        origin: "Mexico, tr. from Spanish",
        hook: "An aging government gunman works a Cold War plot through Mexico City's Chinatown.",
        review:
          "Filiberto García, a revolution-era killer now doing the state's dirty work, is told Mongolian agents plan to shoot the visiting US President on Dolores Street. He shadows a CIA man and a KGB man, kills people, falls for a young woman, and keeps up a running italicised interior monologue of contempt for everyone, himself included. Very funny, very mean.",
        underdog:
          "waited over forty years for an English translation",
        tags: ["noir","cold-war","first-person-voice"],
      },
      {
        title: "The Tokyo Zodiac Murders",
        author: "Soji Shimada",
        year: 1981,
        origin: "Japan, tr. from Japanese",
        hook: "A forty-year-old dismemberment puzzle, with the author daring you to beat him.",
        review:
          "A painter obsessed with astrology writes down his plan to build a perfect woman from six body parts of six girls, then is murdered before he can start. The girls die anyway. Forty years later two amateurs reopen it. Shimada hands you every map, timetable and diagram, then halts the book to say: you now have everything I have. Solve it.",
        underdog:
          "written in 1981 and left untranslated into English for over twenty years",
        tags: ["locked-room","honkaku","fair-play-puzzle"],
      },
      {
        title: "The Murder of Halland",
        author: "Pia Juul",
        year: 2009,
        origin: "Denmark, tr. from Danish",
        hook: "Her partner is shot dead and she declines to find out why.",
        review:
          "Bess's partner is killed in the street; she is briefly a suspect; then the novel simply refuses. She fights with her estranged daughter, mishandles the funeral, learns Halland kept rooms and relationships she knew nothing about, and never really investigates. Each chapter opens with an epigraph from a classic crime novel, which works as a running joke at the genre's expense.",
        underdog:
          "a small-press translation by a Danish writer who never broke through in English",
        tags: ["anti-crime-novel","grief","danish"],
      },
    ],
  },
  {
    slug: "thriller",
    name: "Thriller & Espionage",
    books: [
      {
        title: "Drink to Yesterday",
        author: "Manning Coles",
        year: 1940,
        origin: "UK, English",
        hook: "A schoolboy lies about his age to enlist, and never comes back whole.",
        review:
          "Bill Saunders forges his age to get into the war and ends up running agents inside Germany under his old schoolmaster. The first half is almost a lark: false papers, beer halls, near-misses played for comedy. Then the tone drops through the floor, and the last fifty pages take the jokes back one at a time.",
        underdog:
          "Out of print for decades and overshadowed by the cosier Tommy Hambledon sequels that followed it.",
        tags: ["first world war","agent running","bleak ending"],
      },
      {
        title: "Passage of Arms",
        author: "Eric Ambler",
        year: 1959,
        origin: "UK, English (set in Malaya and Indonesia)",
        hook: "An Indian clerk finds a buried arms cache and decides to sell it.",
        review:
          "Girija Krishnan wants a bus company. What he has is a rotting Communist arms dump in the Malayan jungle, so he sells it. Ambler then follows the guns through Chinese middlemen, Singapore lawyers, and a pair of vacationing Americans who think they are having an adventure. Everyone is reasonable, everyone is out of their depth, nobody is a professional.",
        underdog:
          "Ambler's own favourite among his books, permanently eclipsed by the Dimitrios novels and their films.",
        tags: ["arms dealing","southeast asia","amateurs abroad"],
      },
      {
        title: "The Miernik Dossier",
        author: "Charles McCarry",
        year: 1973,
        origin: "USA, English",
        hook: "Is the fat Polish bureaucrat a spy? Nobody reading the file agrees.",
        review:
          "The whole novel is documents: surveillance logs, cabled reports, a diary, interview transcripts, filed by four intelligence services watching the same car drive from Geneva to Sudan. Miernik may be a defector, a provocateur, or a frightened man with a visa problem. The professionals reading the file cannot tell, and neither can you, which is McCarry's actual subject.",
        underdog:
          "McCarry's debut, long out of print, and the book even his admirers tend to reach last.",
        tags: ["epistolary","cold war","documentary form"],
      },
      {
        title: "The Private Sector",
        author: "Joseph Hone",
        year: 1971,
        origin: "Ireland/Britain, English",
        hook: "A Cairo schoolteacher drifts into spying, then spends years learning who sold him.",
        review:
          "Peter Marlow teaches English at a Cairo school and slides into low-grade intelligence work because someone at the embassy asked nicely. The betrayals, when they come, arrive as social embarrassment — bad marriages, worse postings, men lying to each other over lunch — and the Six-Day War closes over everything like weather. Hone's Egypt is dust, gossip and gin, and his tradecraft is mostly waiting.",
        underdog:
          "Compared to Ambler and le Carré in the 1970s, then out of print for decades and largely forgotten.",
        tags: ["Cold War espionage","Egypt","betrayal","out of print"],
      },
      {
        title: "Decoded",
        author: "Mai Jia",
        year: 2002,
        origin: "China, tr. from Chinese",
        hook: "A maths prodigy is drafted to break ciphers, and the ciphers break him.",
        review:
          "Rong Jinzhen is pulled out of university mathematics into Unit 701, a cryptography bureau that does not officially exist, and handed a cipher called PURPLE. Mai Jia assembles the book from interviews, rumour and secondhand testimony, so the man himself never quite comes into focus. Then a notebook is stolen on a train and the whole thing turns very sad.",
        underdog:
          "A phenomenon in Chinese, it arrived in English only in 2014 and sank almost immediately.",
        tags: ["cryptography","state secrecy","fictional biography"],
      },
    ],
  },
  {
    slug: "historical",
    name: "Historical Fiction",
    books: [
      {
        title: "Bomarzo",
        author: "Manuel Mujica Láinez",
        year: 1962,
        origin: "Argentina, tr. from Spanish",
        hook: "A hunchbacked Renaissance duke narrates his own life, including his death.",
        review:
          "Pier Francesco Orsini, born with a twisted spine into a family that despises him, narrates his sixteenth-century life from somewhere past the end of it — poisonings, Lepanto, Cellini, and the stone monsters he had carved into the wood below his castle. Mujica Láinez spent years in the archives and in that garden. Dense with objects, fabrics, grudges. Slow, then hypnotic.",
        underdog:
          "Out of print in English since the 1969 Rabassa translation",
        tags: ["Italian Renaissance","in translation","first-person"],
      },
      {
        title: "The Samurai",
        author: "Shūsaku Endō",
        year: 1980,
        origin: "Japan, tr. from Japanese",
        hook: "A low-ranking samurai is shipped across the world on an errand.",
        review:
          "Four Japanese envoys and a scheming Franciscan cross the Pacific in 1613, ride mules through Mexico, and end up in Madrid and Rome bargaining for trade with a Church that wants souls first. Hasekura converts for diplomatic convenience and then discovers he meant it. Endō keeps the prose flat and administrative, which makes the last thirty pages land hard.",
        underdog:
          "Permanently overshadowed by Silence and its Scorsese adaptation",
        tags: ["17th century","in translation","voyage"],
      },
      {
        title: "A Legacy",
        author: "Sybille Bedford",
        year: 1956,
        origin: "UK, written in English",
        hook: "Imperial Germany dismantled through one family's dinner-table absurdities.",
        review:
          "Two families — rich, indolent Jewish Berliners and broke Catholic gentry from Baden — collide by marriage in the last decades before 1914. A boy is sent to a Prussian military academy and the resulting scandal reaches the Reichstag. Bedford writes comedy that keeps turning cold. Nobody explains anything; you assemble the whole household from overheard dinner conversation.",
        underdog:
          "Bedford is filed under travel writing and her Huxley biography",
        tags: ["Wilhelmine Germany","family saga","comedy of manners"],
      },
      {
        title: "The Wake",
        author: "Paul Kingsnorth",
        year: 2014,
        origin: "UK (England)",
        hook: "The Norman Conquest from the losing side, in a reinvented language.",
        review:
          "Written entirely in an invented Old English that takes roughly twenty pages to stop fighting you and then reads like nothing else. Buccmaster, a Lincolnshire fenman with land and grievances, loses everything to the Normans and goes into the wild with a small band, talking to the old gods. He is also a liar and probably worse.",
        underdog:
          "Every publisher passed; it was crowdfunded by subscription",
        tags: ["1066","invented dialect","unreliable narrator"],
      },
      {
        title: "Kintu",
        author: "Jennifer Nansubuga Makumbi",
        year: 2014,
        origin: "Uganda, written in English",
        hook: "One accidental killing in 1750 Buganda poisons two centuries of descendants.",
        review:
          "Begins in 1750 with Kintu Kidda, a provincial governor in the Buganda kingdom, who strikes his adopted son on the road to the capital and kills him. The curse works its way down through four modern branches of the family. The eighteenth-century opening alone earns the book — court politics, twin wives, a long march to swear allegiance to a new king.",
        underdog:
          "Published first in Kenya, and years late reaching Western readers",
        tags: ["18th-century Africa","precolonial","multigenerational"],
      },
    ],
  },
  {
    slug: "magical-realism",
    name: "Magical Realism",
    books: [
      {
        title: "Sanatorium Under the Sign of the Hourglass",
        author: "Bruno Schulz",
        year: 1937,
        origin: "Poland, tr. from Polish",
        hook: "A son visits the sanatorium where his dead father is kept slightly alive.",
        review:
          "Schulz's second and last collection, written in a Galician backwater where he taught high-school art. Time misbehaves: a sanatorium sells its clients a few extra weeks by lagging the clock, a father shrinks into a crab and is eventually cooked. The prose piles up metaphors until the furniture starts breathing. Read one story a night; more than that and the effect flattens.",
        underdog:
          "Overshadowed by The Street of Crocodiles; Schulz was shot in 1942 and left only two books",
        tags: ["short stories","interwar Poland","surreal"],
      },
      {
        title: "Recollections of Things to Come",
        author: "Elena Garro",
        year: 1963,
        origin: "Mexico, tr. from Spanish",
        hook: "A Mexican town narrates its own occupation, and one woman turns to stone.",
        review:
          "Published four years before Cien años de soledad, and narrated in the first person plural by the town of Ixtepec itself. A general garrisons the place during the Cristero rebellion, keeps a mistress who refuses to love him, and hangs men from the trees. The collective voice makes gossip feel like fate. Garro's sentences run cooler and angrier than the Boom writers who followed her.",
        underdog:
          "Written out of the Boom; for decades she was filed mainly as Octavio Paz's wife",
        tags: ["Mexico","pre-Boom","small-town"],
      },
      {
        title: "When the Whales Leave",
        author: "Yuri Rytkheu",
        year: 1975,
        origin: "Russia (Chukotka), tr. from Russian",
        hook: "A woman marries a whale; generations later her descendants start hunting their cousins.",
        review:
          "A Chukchi origin story told straight, with no wink at the reader. Nau meets Reu, a whale who walks out of the sea as a man; their children populate the shore. Generations pass, memory thins, the taboo against killing whales loosens, and the harpoons come out. Rytkheu holds the register of oral telling the whole way through. A hundred pages, and it ends hard.",
        underdog:
          "Untranslated into English until 2019, forty-four years after it was written",
        tags: ["Arctic","myth","novella"],
      },
      {
        title: "The Bleeding of the Stone",
        author: "Ibrahim al-Koni",
        year: 1990,
        origin: "Libya, tr. from Arabic",
        hook: "A hermit in the Libyan desert guards a wild sheep from two hunters.",
        review:
          "Asouf lives alone in the Sahara with his goats and a wall of prehistoric rock paintings, keeping faith with the waddan, a wild sheep he will not kill. Two men arrive who have already eaten every gazelle for hundreds of miles and want meat. Al-Koni writes the desert as a legal system rather than scenery. The ending is brutal and exactly right.",
        underdog:
          "One of the Arab world's major novelists, almost never stocked in English-language shops",
        tags: ["Sahara","Tuareg","ecological"],
      },
      {
        title: "Sleepwalking Land",
        author: "Mia Couto",
        year: 1992,
        origin: "Mozambique, tr. from Portuguese",
        hook: "Two refugees hide in a burnt bus and read a dead man's notebooks.",
        review:
          "Mozambique during the civil war. Old Tuahir and the boy Muidinga shelter in a torched bus on a road nobody travels; beside a corpse they find a suitcase of notebooks, and the boy reads them aloud at night. The two stories fold into each other. Couto bends Portuguese the way Mozambicans actually do, inventing words where he needs them, and Brookshaw's translation carries it.",
        underdog:
          "Lusophone African fiction rarely gets shelf space in the English-speaking world",
        tags: ["Mozambique","war","nested stories"],
      },
    ],
  },
  {
    slug: "weird",
    name: "Weird & Slipstream",
    books: [
      {
        title: "A Voyage to Arcturus",
        author: "David Lindsay",
        year: 1920,
        origin: "UK (Scotland), in English",
        hook: "A pilgrimage across a planet where every landscape rewrites the traveller's body.",
        review:
          "Maskull wakes on Tormance and keeps sprouting new organs: a chest tentacle for feeling other people, a third eye, then losing them again as he walks. Each region runs on its own moral system, and he murders his way through most of them. Lindsay sold a few hundred copies and died broke. The prose is stiff; the invention is relentless.",
        underdog:
          "Sold barely 600 copies in Lindsay's lifetime and still gets shelved as a curiosity",
        tags: ["philosophical fantasy","proto-weird","planetary romance"],
      },
      {
        title: "Palace of the Peacock",
        author: "Wilson Harris",
        year: 1960,
        origin: "Guyana, in English",
        hook: "A boat crew rows upriver, unaware they already drowned on this river.",
        review:
          "A crew rows upriver through the Guyanese interior chasing Amerindian workers who keep vanishing. Slowly you understand the boat drowned once already and is making the trip again. Harris writes rapids and jungle light as though solid objects were negotiable, and characters blur into one another mid-sentence. Under 150 pages. You reread paragraphs, not from confusion but from wanting to.",
        underdog:
          "Assigned in postcolonial seminars, almost never picked up by ordinary readers",
        tags: ["Caribbean modernism","dream logic","novella"],
      },
      {
        title: "Log of the S.S. The Mrs Unguentine",
        author: "Stanley Crawford",
        year: 1971,
        origin: "United States, English",
        hook: "Forty years of marriage, logged aboard a barge carrying its own forest.",
        review:
          "Mrs. Unguentine narrates her marriage the way a captain keeps a log: weather, repairs, grievances. The vessel is a barge her husband has turned into a floating garden, then sealed under a glass dome, steering it around oceans that may not exist. He barely speaks, drinks, and one night is gone. A hundred pages, one unbroken voice, no explanations offered.",
        underdog:
          "Out of print for most of two decades while Crawford gave up writing and farmed garlic in New Mexico.",
        tags: ["experimental","slipstream","sea","marriage"],
      },
      {
        title: "Tainaron: Mail from Another City",
        author: "Leena Krohn",
        year: 1985,
        origin: "Finland, tr. from Finnish",
        hook: "Letters home from a city where all the citizens are insects.",
        review:
          "Thirty unanswered letters from a woman living in a city of enormous insects. Her guide, Longhorn, explains the local customs: a funeral where the deceased is eaten, a district that rebuilds itself nightly, neighbours who metamorphose and forget everyone they knew. Nothing threatens her; the dread is structural. Krohn takes about 120 pages and gets more done than most trilogies.",
        underdog:
          "Finland's strangest novelist, kept alive in English only by very small presses",
        tags: ["epistolary","Finnish weird","novella"],
      },
      {
        title: "The Other City",
        author: "Michal Ajvaz",
        year: 1993,
        origin: "Czech Republic, tr. from Czech",
        hook: "Prague has a second city hiding in its margins, and it bites.",
        review:
          "A man buys a book in violet binding, printed in an alphabet nobody recognises, and starts noticing the seams of a second Prague behind the first. A shark surfaces in a church aisle. There are lectures in an attic jungle, a fight on the snowy Charles Bridge. Ajvaz never explains, and the refusal is the point. Funnier than you'd expect.",
        underdog:
          "Sixteen years from Czech publication to an English edition on a small press",
        tags: ["New Weird","urban fantastic","translated"],
      },
    ],
  },
  {
    slug: "graphic-novels",
    name: "Graphic Novels",
    books: [
      {
        title: "Hicksville",
        author: "Dylan Horrocks",
        year: 1998,
        origin: "New Zealand, English",
        hook: "A comics journalist hunts a superstar cartoonist's secret in a coastal New Zealand town.",
        review:
          "Leonard Batts arrives in a Coromandel fishing village where the librarian stocks Krazy Kat and the pub argues about Jack Kirby. He's researching Dick Burger, the local boy who became the world's biggest cartoonist by doing something unforgivable. Horrocks draws slow, rainy, conversational pages, then reveals a lighthouse holding every comic that was never allowed to exist.",
        underdog:
          "Two small publishers folded under it; it spent years out of print between editions.",
        tags: ["metafiction","small-press","comics about comics"],
      },
      {
        title: "The Cage",
        author: "Martin Vaughn-James",
        year: 1975,
        origin: "Canada, English",
        hook: "A book with no characters in it that still manages to frighten you.",
        review:
          "No people appear. Vaughn-James moves through rooms instead: a bed strung with wires, a wall of ropes, sand drifting over furniture, the same spaces redrawn from slightly wrong angles. Dense unattached prose runs beneath, describing decay the pictures contradict. Published before anyone had settled on the phrase graphic novel, it reads like a crime scene without a crime.",
        underdog:
          "Out of print for nearly forty years until a 2013 reissue rescued it.",
        tags: ["experimental","1970s","wordless narrative"],
      },
      {
        title: "Abandon the Old in Tokyo",
        author: "Yoshihiro Tatsumi",
        year: 2006,
        origin: "Japan, tr. from Japanese",
        hook: "Eight short stories about men in postwar Tokyo quietly coming apart.",
        review:
          "Tatsumi drew these in 1970, for readers who wanted comics that weren't for children. A window cleaner spots his estranged daughter through the glass. A young man hauling sewage works out what to do about the invalid mother blocking his marriage. Twenty-page stories, plain cartoon faces, endings that simply stop. He coined the word gekiga for exactly this.",
        underdog:
          "Overshadowed by his 800-page memoir A Drifting Life, which collected all the prizes.",
        tags: ["gekiga","short stories","postwar Japan"],
      },
      {
        title: "Beautiful Darkness",
        author: "Fabien Vehlmann and Kerascoët",
        year: 2009,
        origin: "France, tr. from French",
        hook: "Tiny fairies climb out of a dead child's body and build a society.",
        review:
          "A girl's corpse lies in the woods. Out of her spill dozens of thumb-sized people in party dresses, who set up house in the leaf litter and promptly begin starving, betraying and eating each other. Kerascoët paint the whole thing in gentle children's-book watercolour, which is the trick: nothing in the drawing warns you what the story is doing.",
        underdog:
          "Shelved as all-ages by shops that judged the artwork, which buried it with the wrong readers.",
        tags: ["dark fantasy","watercolour","fable"],
      },
      {
        title: "The Property",
        author: "Rutu Modan",
        year: 2013,
        origin: "Israel, tr. from Hebrew",
        hook: "A grandmother returns to Warsaw for property she never intended to reclaim.",
        review:
          "Mica flies to Warsaw with her grandmother Regina to recover an apartment the family lost before the war. Regina has other business. Modan works in clean Hergé lines, which lets her stage farce — a tour guide who secretly draws comics, ghetto reenactors in period costume — inside a story about a woman keeping one secret for seventy years.",
        underdog:
          "Her earlier Exit Wounds took the attention, and Israeli comics rarely reach English shelves at all.",
        tags: ["ligne claire","family secrets","Warsaw"],
      },
    ],
  },
  {
    slug: "memoir",
    name: "Memoir & Autobiography",
    books: [
      {
        title: "The Story of Mary MacLane",
        author: "Mary MacLane",
        year: 1902,
        origin: "USA (Butte, Montana), written in English",
        hook: "A nineteen-year-old in a Montana mining town proposes marriage to the Devil.",
        review:
          "Three months of daily entries by a girl stranded in a Montana mining town, cataloguing her genius, her hunger, her boredom, and her love for a former teacher she calls the anemone lady. She repeats herself on purpose. The effect is closer to a punk record than a diary: flat declaratives, sudden obscenities of feeling, no shame anywhere.",
        underdog:
          "Sold enormously in 1902, then vanished for a century until a small-press reissue restored her original title.",
        tags: ["diary","outsider voice","reissue"],
      },
      {
        title: "Manhood: A Journey from Childhood into the Fierce Order of Virility",
        author: "Michel Leiris",
        year: 1939,
        origin: "France, tr. from French",
        hook: "An anthropologist dissects his own cowardice and desire like a museum specimen.",
        review:
          "Leiris lays out his life as a set of exhibits: two Cranach paintings, Lucretia and Judith, become the poles he organises his erotic failures around. He records his suicide attempt, his fear of women, his teeth, his opera obsession, with the same cold precision he brought to fieldwork in Africa. The preface argues autobiography should carry the risk of a bullfight.",
        underdog:
          "Leiris gets read as a Surrealist footnote; the book stayed a writer's-writer secret in English.",
        tags: ["confessional","avant-garde","translated"],
      },
      {
        title: "Diary of a Man in Despair",
        author: "Friedrich Reck-Malleczewen",
        year: 1947,
        origin: "Germany, tr. from German",
        hook: "A Prussian aristocrat writes down his hatred of Hitler while Hitler is winning.",
        review:
          "Reck buried these pages on his Bavarian estate between 1936 and 1944. He is a snob, a monarchist, and frequently unpleasant company, which is what makes the diary trustworthy — he had no post-war reputation to build. He recalls meeting Hitler at a dinner party in 1920 and finding him ridiculous. He died at Dachau before the war ended.",
        underdog:
          "Out of print in English for decades and overshadowed by every other Nazi-era diary.",
        tags: ["diary","wartime","translated"],
      },
      {
        title: "Journey into the Whirlwind",
        author: "Eugenia Ginzburg",
        year: 1967,
        origin: "USSR, tr. from Russian",
        hook: "A loyal Party member is arrested and spends eighteen years finding out why.",
        review:
          "Ginzburg taught at Kazan University and believed in the system until 1937, when she was accused of Trotskyism for failing to denounce a colleague. What follows is two years of solitary confinement, then the cattle truck east to Kolyma. She writes it as sharp scenes and remembered talk, and she is very funny about the absurdity of her interrogators. No self-pity, ever.",
        underdog:
          "Circulated in samizdat, published only abroad, and long shelved behind Solzhenitsyn.",
        tags: ["prison memoir","USSR","translated"],
      },
      {
        title: "Aké: The Years of Childhood",
        author: "Wole Soyinka",
        year: 1981,
        origin: "Nigeria, written in English",
        hook: "A parsonage childhood in Yorubaland, ending in a women's revolt against colonial taxes.",
        review:
          "Soyinka reconstructs Abeokuta at a small boy's eye level: the school compound, the bookseller, his father's arguments, his mother's Christianity and her ledger of grievances. The comedy is precise — a child negotiating adults who are all slightly mad. Then the last chapters widen into the market women's tax protest, and you realise the whole book has been building toward it.",
        underdog:
          "Everyone cites the Nobel and the plays; almost nobody actually reads the memoir.",
        tags: ["childhood","Nigeria","colonial"],
      },
    ],
  },
  {
    slug: "nature",
    name: "Nature & Place Writing",
    books: [
      {
        title: "The Land of Little Rain",
        author: "Mary Austin",
        year: 1903,
        origin: "United States (California desert)",
        hook: "Fourteen short chapters on the Mojave by someone who actually lived there.",
        review:
          "Austin walks the country between the Sierra and Death Valley and reports what lives there: buzzards timing a carcass, a solitary prospector who never strikes it rich, Paiute basket makers, the exact places where water hides. She writes in short chapters with a dry, unsentimental attention. The desert is not scenery here; it is a set of arrangements for staying alive.",
        underdog:
          "Fell out of print for decades while Muir and Abbey took over the desert canon",
        tags: ["desert","essays","American West","1900s"],
      },
      {
        title: "Kabloona",
        author: "Gontran de Poncins",
        year: 1941,
        origin: "France / Canadian Arctic, tr. from French",
        hook: "A French aristocrat spends a winter with Netsilik hunters and loses his certainties.",
        review:
          "De Poncins arrives in the Canadian Arctic in 1938 fastidious, superior, appalled by the smell of the igloo. Fifteen months later he has learned to eat raw fish, sleep naked among strangers, and sit still for hours doing nothing. The book records that grinding change honestly, including how badly he behaved. The ice, the light, the silence do most of the work.",
        underdog:
          "Out of print for long stretches, and rarely shelved with the polar narratives that have more drama and less looking",
        tags: ["arctic","travel","translated","1940s"],
      },
      {
        title: "Stones of Aran: Pilgrimage",
        author: "Tim Robinson",
        year: 1986,
        origin: "Ireland (Aran Islands)",
        hook: "One man walks the entire coastline of an Aran island, very slowly.",
        review:
          "Robinson was a mapmaker before he was a writer, and it shows: he circles Árainn's shore anticlockwise, stopping at every cove, cliff, holy well and boulder that has a name, and asks what the name means. Geology, Irish grammar, local memory and his own footsteps braid together. It should be unreadable and is instead completely absorbing, one field at a time.",
        underdog:
          "Came out from a small Irish press; known to walkers and cartographers and almost nobody else",
        tags: ["Ireland","islands","walking","topography"],
      },
      {
        title: "The Bush: Travels in the Heart of Australia",
        author: "Don Watson",
        year: 2014,
        origin: "Australia",
        hook: "What Australians mean by 'the bush', and what clearing it actually cost.",
        review:
          "Watson grew up on a Gippsland farm where his family spent generations burning and grubbing out trees. He drives and reads his way across the continent asking why Australians worship a landscape they worked so hard to destroy. Sheep, eucalypts, drought, Country, dynamite, national myth. The tone is dry and often very funny, and the anger underneath never turns into a sermon.",
        underdog:
          "Barely distributed outside Australia; elsewhere Watson is remembered, if at all, as a political speechwriter",
        tags: ["Australia","colonialism","ecology"],
      },
      {
        title: "Hōjōki (An Account of My Hut)",
        author: "Kamo no Chōmei",
        year: 1212,
        origin: "Japan, tr. from Japanese",
        hook: "A twelfth-century recluse describes his ten-foot hut and the city that burned.",
        review:
          "Chōmei watched Kyoto go through fire, whirlwind, famine and earthquake in a single lifetime, then built a hut in the hills at Hino small enough to take apart and cart away. He lists what is in it. He notes the mountain, the birds, the boy he walks with. Ten pages, roughly, and the disaster reporting is as precise as the quiet.",
        underdog:
          "A schoolroom classic in Japan that Western nature readers have simply never met",
        tags: ["Japan","medieval","solitude","translated"],
      },
    ],
  },
  {
    slug: "science",
    name: "Popular Science",
    books: [
      {
        title: "The Naturalist on the River Amazons",
        author: "Henry Walter Bates",
        year: 1863,
        origin: "England (travels in Brazil)",
        hook: "Eleven years alone on the Amazon, naming eight thousand species nobody knew.",
        review:
          "Bates spent eleven years on the Amazon, mostly broke, mostly ill, shipping beetles home to pay his rent. He describes army ants stripping a house room by room, a toucan's table manners, the mimicry that now carries his name, all in the flat curious voice of a man who has stopped being surprised. Darwin loved it. Then Wallace's memoir and the Beagle took the century's attention.",
        underdog:
          "Overshadowed by his own travelling companion Wallace and by Darwin's far more quotable voyage",
        tags: ["natural history","19th century","entomology","travel"],
      },
      {
        title: "The Soul of the White Ant",
        author: "Eugène Marais",
        year: 1937,
        origin: "South Africa, tr. from Afrikaans",
        hook: "A termite mound is one animal, and Marais argued it first.",
        review:
          "Marais watched termites in the Transvaal for years and concluded the colony was a single body: queen as brain, workers as bloodstream, soldiers as white cells. He writes in short patient chapters, half field notes and half argument, and he is very funny about his own failures. Maeterlinck lifted the thesis and took the applause. Marais, broke and on morphine, shot himself before English readers found him.",
        underdog:
          "Written in Afrikaans, plagiarised by a Nobel laureate, and out of print for decades",
        tags: ["entomology","translated","natural history"],
      },
      {
        title: "Under the Sea-Wind",
        author: "Rachel Carson",
        year: 1941,
        origin: "United States",
        hook: "The North Atlantic told from inside it, with no humans anywhere.",
        review:
          "Three linked stories and not one person in them: a black skimmer's season on the shore, a mackerel from egg to net, an eel dropping down the river to the Sargasso Sea and back again. The animals get names but never thoughts. Carson keeps the science exact and lets the structure do the work, so it reads like a novel whose plot is tide and hunger.",
        underdog:
          "Published a month before Pearl Harbor, sold barely two thousand copies, and still lives in Silent Spring's shadow",
        tags: ["marine biology","nature writing","1940s"],
      },
      {
        title: "Chance and Necessity",
        author: "Jacques Monod",
        year: 1970,
        origin: "France, tr. from French",
        hook: "A Nobel biologist argues life is an accident, and never flinches.",
        review:
          "Monod opens by asking how a Martian probe would tell a crystal from a bird, then works from enzyme chemistry up to the claim that scandalised 1970: the genetic message arrives by chance, is kept by necessity, and nothing purposeful runs underneath. The prose is dry, exact and quietly angry. The final chapter is philosophy written by a man who has actually been at the bench.",
        underdog:
          "A genuine intellectual event in its day, now filed as period philosophy and rarely opened",
        tags: ["molecular biology","philosophy","translated"],
      },
      {
        title: "In a Flight of Starlings",
        author: "Giorgio Parisi",
        year: 2023,
        origin: "Italy, tr. from Italian",
        hook: "Why starlings turn together, from the physicist who mapped disorder itself.",
        review:
          "Parisi filmed starling flocks from Roman rooftops, rebuilt them in three dimensions, and found each bird tracks roughly seven neighbours no matter how far away they are. That is one chapter. The rest is short unhurried pieces on spin glasses, on how an idea actually arrives, on what metaphor is doing inside physics. Under a hundred and fifty pages, and it assumes you are clever.",
        underdog:
          "A Nobel laureate's slim, quiet book, published without noise and buried under fatter physics titles",
        tags: ["physics","complexity","translated","essays"],
      },
    ],
  },
  {
    slug: "philosophy",
    name: "Philosophy & Ideas",
    books: [
      {
        title: "Hind Swaraj, or Indian Home Rule",
        author: "M. K. Gandhi",
        year: 1909,
        origin: "India, tr. from Gujarati by the author",
        hook: "Gandhi argues the British aren't the problem — trains, lawyers and doctors are.",
        review:
          "A dialogue between an impatient young nationalist and an editor who keeps refusing to agree with him. The young man wants the British thrown out by force. The editor answers that the occupation is only a symptom: the real infection is railways, lawyers, doctors, machinery, and the parliament everyone is so eager to copy. Written in ten days aboard a ship. Still offends almost everyone.",
        underdog:
          "everybody knows the man; almost nobody has read the little book he called his creed",
        tags: ["anti-colonial","dialogue","short"],
      },
      {
        title: "In Praise of Shadows",
        author: "Jun'ichirō Tanizaki",
        year: 1933,
        origin: "Japan, tr. from Japanese",
        hook: "Why lacquer bowls and dim rooms beat electric light and white porcelain.",
        review:
          "A novelist grumbling his way through an essay about light. Tanizaki wants to know what a Japanese room loses under a bulb: how gold screens hold a candle flame, why soup belongs in lacquer, why the best place to think is an old wooden toilet down the garden. Cranky, funny, sixty pages, and it permanently changes how you walk into a room.",
        underdog:
          "shelved as an interior-design curio and buried under the author's novels",
        tags: ["aesthetics","essay","short"],
      },
      {
        title: "Meditations on Hunting",
        author: "José Ortega y Gasset",
        year: 1942,
        origin: "Spain, tr. from Spanish",
        hook: "The only person who sees a whole landscape at once is a hunter.",
        review:
          "Commissioned as a preface to a friend's hunting memoir; Ortega handed back a book. His claim is that the hunter perceives a landscape entire, because anything in it might be the animal, and ordinary attention is by comparison half-asleep. He refuses to be sentimental about the killing, arguing instead that the kill is what keeps the attention honest. Exact, strange, hard to shake.",
        underdog:
          "eclipsed by The Revolt of the Masses, and skipped by readers who assume it is a book about guns",
        tags: ["attention","essay","nature"],
      },
      {
        title: "The Sovereignty of Good",
        author: "Iris Murdoch",
        year: 1970,
        origin: "UK, English",
        hook: "Morality is not mostly what you choose; it is what you manage to see.",
        review:
          "Three essays against the idea that being good is a matter of decisions. Murdoch thinks it is mostly a matter of looking. Her example: a mother-in-law who has decided her son's wife is vulgar, and who over years, with nothing happening and nobody watching, quietly re-sees her as fresh. There is also a hovering kestrel that cures self-pity in about ten seconds.",
        underdog:
          "she is read as a novelist, so the philosophy gets treated as a hobby",
        tags: ["ethics","essays","attention"],
      },
      {
        title: "The Ignorant Schoolmaster: Five Lessons in Intellectual Emancipation",
        author: "Jacques Rancière",
        year: 1987,
        origin: "France, tr. from French",
        hook: "A teacher taught a language he could not speak, and it worked.",
        review:
          "In 1818 a French exile in Louvain had to teach students whose language he did not share. He gave them a bilingual Fénelon and got out of the way; they learned to write French well. Rancière takes that accident and turns it into an attack on teaching itself — explanation, he argues, is the machine that manufactures the incapacity it claims to cure.",
        underdog:
          "translated late, filed under education theory, and stranded off the philosophy shelf",
        tags: ["education","equality","history"],
      },
    ],
  },
  {
    slug: "travel",
    name: "Travel & Exploration",
    books: [
      {
        title: "Sakhalin Island",
        author: "Anton Chekhov",
        year: 1895,
        origin: "Russia, tr. from Russian",
        hook: "Chekhov crossed Siberia to count convicts, one index card at a time.",
        review:
          "In 1890 Chekhov, already coughing blood, spent three months on a Pacific penal island interviewing every settler he could find — roughly ten thousand census cards, filled out by hand. What follows is part statistical survey, part catalogue of ruin: rations, floggings, the going rate for a convict's wife. The flat administrative voice is what makes the cruelty land.",
        underdog:
          "Buried under the plays and stories; no complete English translation existed until 1993.",
        tags: ["Russia","19th century","reportage","penal colony"],
      },
      {
        title: "My Journey to Lhasa",
        author: "Alexandra David-Néel",
        year: 1927,
        origin: "France, published in English 1927",
        hook: "A fifty-five-year-old Frenchwoman walks into forbidden Lhasa disguised as a beggar.",
        review:
          "Winter, 1923. David-Néel darkens her face with soot and ink, braids in yak hair, and sets off for a city closed to foreigners, passing as an old pilgrim with her adopted son as escort. Snow passes, no fire, boiled leather soup, constant risk of a slipped disguise. She is funny about her own vanity and completely unsentimental about Tibet.",
        underdog:
          "Overshadowed by her later occult writings, which made her a cult figure rather than a writer.",
        tags: ["Tibet","1920s","disguise","women travelers"],
      },
      {
        title: "The Way of the World",
        author: "Nicolas Bouvier",
        year: 1963,
        origin: "Switzerland, tr. from French",
        hook: "Two young men, one small Fiat, Geneva to the Khyber Pass.",
        review:
          "Bouvier and the painter Thierry Vernet left Geneva in 1953 with no schedule and almost no money, and the book's real subject is the waiting: six months stuck in Tabriz through winter, the car endlessly broken, articles sold to pay for petrol. Vernet's drawings run alongside. Bouvier writes about boredom and small kindnesses with unusual precision.",
        underdog:
          "Published in French in 1963, it waited nearly thirty years for a full English translation.",
        tags: ["Switzerland","1950s","road journey","Iran & Afghanistan"],
      },
      {
        title: "An African in Greenland",
        author: "Tété-Michel Kpomassie",
        year: 1981,
        origin: "Togo, tr. from French",
        hook: "A Togolese teenager reads about Greenland and spends years getting there.",
        review:
          "Kpomassie, promised to a python cult after a fall from a coconut palm, finds a book about Greenland in a Lomé bookshop and decides that is where he is going. It takes him the better part of a decade of odd jobs across West Africa and Europe. He arrives in 1965, very tall and very black, and is stared at as thoroughly as he stares back.",
        underdog:
          "Out of print in English for long stretches; survives mainly as a reissued classic passed hand to hand.",
        tags: ["Togo","Greenland","1980s","reverse anthropology"],
      },
      {
        title: "Travels with a Tangerine: A Journey in the Footnotes of Ibn Battutah",
        author: "Tim Mackintosh-Smith",
        year: 2001,
        origin: "United Kingdom, English",
        hook: "Chasing a fourteenth-century Moroccan wanderer through the ruins he actually described.",
        review:
          "Mackintosh-Smith, an Arabist who has lived in Sanaa for decades, follows Ibn Battutah's route from Tangier through Egypt, Syria, Anatolia and Constantinople, checking whether the tombs, hospices and lunatic asylums are still standing. Half the pleasure is watching him argue with the text — a mistranslated word, a saint's shrine now a shoe shop. Martin Yeoman's drawings help.",
        underdog:
          "Adored by Arabists and almost nobody else; its two sequels are harder still to find.",
        tags: ["Middle East","2000s","Ibn Battutah","Britain"],
      },
    ],
  },
  {
    slug: "poetry",
    name: "Poetry",
    books: [
      {
        title: "Poemas y antipoemas",
        author: "Nicanor Parra",
        year: 1954,
        origin: "Chile, tr. from Spanish",
        hook: "The Chilean who decided poetry had gotten too holy and knocked it down.",
        review:
          "Parra taught physics and wrote poems like a man heckling from the back of the room. His self-portrait poem tallies ruined teeth, wrecked eyes, and the classroom hours that caused them; another recounts an affair with a woman who talked him out of his furniture. Plain speech, deadpan timing, no interest in sounding noble.",
        underdog:
          "permanently overshadowed by Neruda abroad and by his sister Violeta's songs at home",
        tags: ["antipoetry","deadpan","Latin American","1950s"],
      },
      {
        title: "Briggflatts",
        author: "Basil Bunting",
        year: 1966,
        origin: "England (Northumbria), written in English",
        hook: "Fifty years of regret compressed into five short movements of Northumbrian consonants.",
        review:
          "Bunting was sixty-six, working as a subeditor on a Newcastle paper, when he wrote this: a boy and girl riding a cart loaded with the stonemason father's slabs, then a lifetime of getting it wrong. It moves by sound before sense, hard northern consonants with sudden bursts of Eric Bloodaxe and slowworms, and rewards being read aloud twice.",
        underdog:
          "he vanished into journalism for decades and was rediscovered only in his sixties",
        tags: ["long poem","sound-driven","British modernism"],
      },
      {
        title: "alphabet",
        author: "Inger Christensen",
        year: 1981,
        origin: "Denmark, tr. from Danish",
        hook: "The Fibonacci sequence decides how long each poem gets. It works.",
        review:
          "Each section takes a letter of the alphabet and a number from the Fibonacci sequence, which sets its length, so the poems swell as the alphabet advances and the world fills up. Apricot trees, bromine, doves, then hydrogen bombs and defoliants. Christensen stops at n, before the arithmetic swallows the book. A list that becomes an elegy for everything listed.",
        underdog:
          "a perennial Nobel near-miss whose work reached English readers two decades late",
        tags: ["constraint-based","ecological","Scandinavian","1980s"],
      },
      {
        title: "The Reproduction of Profiles",
        author: "Rosmarie Waldrop",
        year: 1987,
        origin: "USA, written in English (author German-born)",
        hook: "She rewrote Wittgenstein's logic as a woman arguing with her lover.",
        review:
          "Waldrop took sentences from Wittgenstein and let a woman answer them in prose paragraphs about her body, her lover, and the weather. Propositions on the limits of language keep collapsing into bedrooms and unpaid attention. It's funny in a dry, exasperated way, and it never explains the joke. Each paragraph is short enough to reread immediately, which you will.",
        underdog:
          "published from her own tiny press orbit and shelved as difficult by people who never opened it",
        tags: ["prose poems","philosophical","feminist","experimental"],
      },
      {
        title: "Autobiography of Death",
        author: "Kim Hyesoon",
        year: 2016,
        origin: "South Korea, tr. from Korean",
        hook: "Forty-nine poems for the forty-nine days a Korean soul spends dying.",
        review:
          "In Korean tradition the spirit wanders forty-nine days before rebirth; Kim gives each day a poem, addressed to a 'you' who is already dead and still commuting, riding buses, watching her own body. Written after a ferry sank with hundreds of schoolchildren aboard. The tone sits closer to nausea than mourning: bodies leak, multiply, refuse to stay singular.",
        underdog:
          "decades of her work went untranslated, and she is still read here mostly by other poets",
        tags: ["sequence","grief","Korean","contemporary"],
      },
    ],
  },
  {
    slug: "short-stories",
    name: "Short Stories",
    books: [
      {
        title: "Thus Were Their Faces",
        author: "Silvina Ocampo",
        year: 2015,
        origin: "Argentina, tr. from Spanish",
        hook: "Domestic Argentine tales where the cruelty is polite and the children are worse.",
        review:
          "Ocampo writes children who are more dangerous than the adults watching them. A woman moves into a house that belonged to someone else and slowly becomes her. A girl dies at her own birthday party while the photographer keeps rearranging the guests. The stories are short, flat-voiced, and vicious in a way that never announces itself; the horror lands two sentences after you stopped bracing.",
        underdog:
          "Overshadowed her whole life by Borges and by her husband Bioy Casares; most of these waited seventy years for English.",
        tags: ["Argentine","translated","quietly sinister","very short stories"],
      },
      {
        title: "A Useless Man: Selected Stories",
        author: "Sait Faik Abasıyanık",
        year: 2014,
        origin: "Turkey, tr. from Turkish",
        hook: "An Istanbul loafer turns idleness and eavesdropping into a life's worth of stories.",
        review:
          "Nothing happens, repeatedly, and it is wonderful. A man drifts around Istanbul and the Princes' Islands, drinks with Greek fishermen, watches a boy on the ferry, follows one thought about loneliness for two pages, and stops. Sait Faik wrote hundreds of these between the 1930s and his death in 1954. The translation keeps the sentences loose and spoken. Best read three a night.",
        underdog:
          "Turkey's most loved story writer, essentially untranslated into English until an independent press took him on in 2014.",
        tags: ["Turkish","translated","city writing"],
      },
      {
        title: "The Collector of Treasures and Other Botswana Village Tales",
        author: "Bessie Head",
        year: 1977,
        origin: "Botswana/South Africa, English",
        hook: "Village stories from Botswana where the women's patience finally, calmly runs out.",
        review:
          "Thirteen stories from a Botswana village, delivered with the flatness of someone giving evidence in court. The title story opens with a woman being driven to prison for killing her husband, then works backward through the marriage until you understand it. Head is unsentimental about village life and unsentimental about men, and she grants her women exactly as much dignity as their circumstances permit.",
        underdog:
          "Shelved in the African Writers Series and left there; her novels get taught, the stories rarely do.",
        tags: ["African","linked stories","unsentimental"],
      },
      {
        title: "The Doll's Alphabet",
        author: "Camilla Grudova",
        year: 2017,
        origin: "Canada/Scotland, English",
        hook: "Women unstitch their own skins, and what climbs out resembles a sewing machine.",
        review:
          "Greta finishes her coffee and unstitches herself, stepping out of her skin into something like a sewing machine; soon every woman is doing it. Elsewhere a translator of Plautus lodges with a werewolf, and a wife works to support her husband through endless Exams. Grudova builds a shabby, tinned-food world of workhouses and moths, reported flatly, which is what makes it land.",
        underdog:
          "A debut from two small independent presses, passed hand to hand rather than shelved.",
        tags: ["weird fiction","feminist grotesque","surrealism","small press"],
      },
      {
        title: "Toddler-Hunting and Other Stories",
        author: "Kōno Taeko",
        year: 1996,
        origin: "Japan, tr. from Japanese",
        hook: "Japanese stories about appetites that polite fiction usually declines to name.",
        review:
          "Kōno writes women who want things they are not supposed to want. The narrator of the title story cannot stand little girls but fixates on small boys, buying them clothes she will never hand over. Elsewhere a couple's private games turn methodical and painful. She states these appetites plainly and refuses to diagnose them, which makes the book far harder to discuss than to read.",
        underdog:
          "A major postwar Japanese novelist represented in English by one slim selection almost nobody has heard of.",
        tags: ["Japanese","translated","transgressive","postwar"],
      },
    ],
  },
  {
    slug: "noir",
    name: "Crime & Noir",
    books: [
      {
        title: "The Master Key",
        author: "Masako Togawa",
        year: 1962,
        origin: "Japan, tr. from Japanese",
        hook: "A Tokyo women's apartment block is moved four metres, and a child surfaces.",
        review:
          "The K Apartments for Ladies is being shifted bodily to widen a road, which is inconvenient for whoever buried a child under the bathroom floor. Togawa braids together the ageing tenants — a thief, a fraud, a woman still writing to a dead man — until their small deceptions lock into one machine. Cold, patient, and structured like a trap closing.",
        underdog:
          "Out of English print for decades, and Togawa was better known at home as a cabaret singer than a novelist.",
        tags: ["Japanese crime","1960s","puzzle-box","translated"],
      },
      {
        title: "Fatale",
        author: "Jean-Patrick Manchette",
        year: 1977,
        origin: "France, tr. from French",
        hook: "A contract killer moves to a small French town and lets it rot.",
        review:
          "Aimée Joubert arrives in a Normandy port town, rents rooms, eats enormously in private, and starts collecting what the local notables have on each other. She isn't hired by anyone; she works freelance, setting a bourgeoisie against itself for money. Manchette writes flat, behaviourist prose — you only ever see what a camera would — and the last twenty pages are a bloodbath in evening dress.",
        underdog:
          "Untranslated into English until 2011, and overshadowed by the Sean Penn film made from a different Manchette novel.",
        tags: ["French noir","1970s","assassin","translated"],
      },
      {
        title: "He Died with His Eyes Open",
        author: "Derek Raymond",
        year: 1984,
        origin: "United Kingdom, English",
        hook: "A nameless detective plays a dead man's tapes until he can't stop.",
        review:
          "The victim is a middle-aged drunk beaten to a pulp and dumped by a West London road; nobody at the Met cares. The sergeant from Unexplained Deaths does, mostly because Staniland left hours of cassette tapes talking himself to pieces. The book is really those tapes, plus a policeman being eaten alive by them. Ugly, furious, and written by someone who knew that world firsthand.",
        underdog:
          "He published as Derek Raymond because an American thriller writer had taken his real name, and the Factory books sat out of print for years.",
        tags: ["British noir","1980s","police procedural","bleak"],
      },
      {
        title: "Money to Burn",
        author: "Ricardo Piglia",
        year: 1997,
        origin: "Argentina, tr. from Spanish",
        hook: "Robbers besieged in a Montevideo flat decide to burn the money.",
        review:
          "Piglia works from the 1965 Buenos Aires armoured-car robbery and the siege that followed, assembling the book out of transcripts, newspaper copy and testimony. The two central thieves are lovers, amphetamine-wrecked, holed up in an apartment while police shoot through the walls for fifteen hours. Then they push half a million dollars out the window in flames, and the crowd below turns on them, not the police.",
        underdog:
          "Piglia is filed in English as a literary theorist, so his crime novel rarely reaches the crime shelf where it belongs.",
        tags: ["Argentine","1990s","true-crime novel","heist"],
      },
      {
        title: "Bitter Wash Road",
        author: "Garry Disher",
        year: 2013,
        origin: "Australia, English",
        hook: "A disgraced cop patrols four hundred kilometres of wheat country that hates him.",
        review:
          "Hirschhausen informed on corrupt colleagues in Adelaide and got posted to a one-officer station in the South Australian wheat belt, where the local police would happily see him dead in a paddock. A teenage girl is found on a roadside. What Disher does best is the driving: endless dirt roads, welfare checks, small mean disputes, and the slow accumulation of who owes whom.",
        underdog:
          "Renamed Hell to Pay for a US release five years late, which split its readership in two.",
        tags: ["Australian rural noir","2010s","regional","procedural"],
      },
    ],
  },
  {
    slug: "translated",
    name: "Translated & World Literature",
    books: [
      {
        title: "Life and a Half",
        author: "Sony Labou Tansi",
        year: 1979,
        origin: "Congo-Brazzaville, tr. from French by Alison Dundy",
        hook: "A dictator kills the rebel Martial; Martial declines to die, for generations.",
        review:
          "Martial, an opposition leader, is carved up and fed to his own children by the Providential Guide, and then refuses to be dead. He turns up in mirrors, in his daughter's body, in the dictator's bedroom, driving a dynasty of successors mad across decades. Tansi writes a shoving, obscene, joke-cracking French that Dundy keeps rude in English. Political horror played as farce.",
        underdog:
          "Waited thirty-two years for an English translation, and got one from a university press it never left.",
        tags: ["francophone-africa","political-satire","surrealism","dictator-novel"],
      },
      {
        title: "The Third Wedding",
        author: "Costas Taktsis",
        year: 1962,
        origin: "Greece, tr. from Greek by Leslie Finer",
        hook: "Two Athenian women talk their lives at you while the century collapses.",
        review:
          "Two neighbours in Athens talk — about husbands, money, each other's children — and the Metaxas dictatorship, the German Occupation, the famine and the civil war arrive as interruptions to the gossip. Nina buries husbands and marries a third; Ekavi's daughter turns monstrous, her son turns fascist. The chatter is spiteful and very funny, and stops being funny by degrees.",
        underdog:
          "Effectively out of print in English for decades; Taktsis wrote little else and was murdered in 1988.",
        tags: ["Greek","domestic epic","voice-driven","wartime Athens"],
      },
      {
        title: "The Obscene Bird of Night",
        author: "José Donoso",
        year: 1970,
        origin: "Chile, tr. from Spanish by Hardie St. Martin & Leonard Mades",
        hook: "The narrator is a mute servant hiding among old women in a crumbling convent.",
        review:
          "Humberto, secretary to a landowner, ends up as Mudito, a supposedly mute errand-runner in a decaying Santiago convent housing discarded old women and orphans. Elsewhere his patron builds an estate staffed entirely by monsters so his deformed son will think deformity is normal. Identities swap mid-sentence; the narrator becomes an old woman, a baby, a bundle. Nothing stays in one shape.",
        underdog:
          "The Boom novel nobody assigns; Donoso got flattened by García Márquez and Cortázar.",
        tags: ["Latin American Boom","gothic","difficult"],
      },
      {
        title: "Territory of Light",
        author: "Yūko Tsushima",
        year: 1979,
        origin: "Japan, tr. from Japanese by Geraldine Harcourt",
        hook: "Twelve months, twelve chapters, in a Tokyo apartment flooded with unbearable light.",
        review:
          "Twelve chapters, one per month, following a woman whose husband has left her as she raises a two-year-old alone in a fourth-floor Tokyo flat with windows on every side. She loses her temper, drinks, sleeps through her daughter's crying, resents her, adores her. Tsushima refuses to make her likeable or to punish her for it. The light is relentless throughout.",
        underdog:
          "Filed for decades under 'Osamu Dazai's daughter'; most of her fiction is still untranslated.",
        tags: ["Japan","motherhood","1970s"],
      },
      {
        title: "Our Lady of the Nile",
        author: "Scholastique Mukasonga",
        year: 2012,
        origin: "Rwanda, tr. from French by Melanie Mauthner",
        hook: "A Rwandan girls' boarding school where the killing is already being rehearsed.",
        review:
          "A Catholic lycée high in the Rwandan hills in the 1970s, where a quota admits a couple of Tutsi girls per class. Mukasonga writes much of it as boarding-school comedy: crushes, rivalries, a French teacher's obsessions, a statue of the Virgin whose nose becomes a political problem. Then the students' cruelty hardens into something organized. She lost thirty-seven relatives in 1994.",
        underdog:
          "Won the Renaudot in France and arrived in English to near-total silence.",
        tags: ["Rwanda","boarding school","genocide"],
      },
    ],
  },
  {
    slug: "essays",
    name: "Essays & Criticism",
    books: [
      {
        title: "Barbarian in the Garden",
        author: "Zbigniew Herbert",
        year: 1962,
        origin: "Poland, tr. from Polish",
        hook: "A Polish poet with almost no money walks into Western Europe's oldest art.",
        review:
          "Herbert got a passport in 1958 and went to look at things: the Lascaux caves, Doric columns at Paestum, Piero della Francesca's frescoes in Arezzo. He counts his francs, eats badly, sleeps in cheap rooms, and writes about paintings with the attention of someone who may not get a second chance. The Cathar essay turns into a quiet study of how heresies get erased.",
        underdog:
          "Completely overshadowed by his poetry, and untranslated into English for over twenty years",
        tags: ["travel","art criticism","Cold War","translated"],
      },
      {
        title: "The Geography of the Imagination: Forty Essays",
        author: "Guy Davenport",
        year: 1981,
        origin: "United States",
        hook: "Forty essays that treat Grant Wood, Kafka, and Neolithic cave art as one conversation.",
        review:
          "The title essay takes American Gothic apart pitchfork by pitchfork, tracing the window to medieval Europe, the pitchfork to Egypt, the whole arrangement back through several thousand years, and it never feels like a stunt. Elsewhere Davenport writes on Poe, Olson, Ives, Welty. He was a classicist who could read almost anything, and the sentences move fast and land.",
        underdog:
          "Its original press folded, the book drifted out of print, and Davenport stayed a writer's writer",
        tags: ["literary criticism","art","polymath"],
      },
      {
        title: "Escape from the Anthill",
        author: "Hubert Butler",
        year: 1985,
        origin: "Ireland",
        hook: "An Irish country gentleman who spent sixty years writing essays nobody would publish.",
        review:
          "Butler was eighty-five when his first collection appeared. He writes about Kilkenny gravestones, learning Russian, helping Jews escape Vienna in 1939, and the forced conversion of Orthodox Serbs by Croatian fascists — a subject he raised at a Dublin meeting in 1952, after which the papal nuncio walked out and Butler was frozen out of Irish public life. Local and enormous at once.",
        underdog:
          "First book at eighty-five, from a tiny Irish press, decades after most of it was written",
        tags: ["essays","Ireland","history","politics"],
      },
      {
        title: "Thank You for Not Reading",
        author: "Dubravka Ugrešić",
        year: 2003,
        origin: "Croatia, tr. from Croatian",
        hook: "What the book business looks like to someone with no country left.",
        review:
          "Ugrešić was chased out of Croatia for refusing the nationalist line, and she turns that displacement on the literary marketplace: agents, Frankfurt, celebrity memoirs, the way a writer from a small vanished country gets sold as an exotic. It's very funny, and the comedy keeps turning cold. She writes about her own books disappearing from Croatian libraries without much self-pity.",
        underdog:
          "Issued by a small nonprofit press and shelved under Balkan politics rather than essays",
        tags: ["essays","publishing","exile","translated"],
      },
      {
        title: "The Great Camouflage: Writings of Dissent (1941–1945)",
        author: "Suzanne Césaire",
        year: 2012,
        origin: "Martinique, tr. from French",
        hook: "Seven essays written under Vichy censorship, then silence for the rest of her life.",
        review:
          "Between 1941 and 1945 Césaire published seven pieces in Tropiques, the Martinican journal she helped run while Vichy officials read every issue. She writes on Frobenius, on Breton arriving in Fort-de-France, on what she calls the malaise of a colonised civilisation. The title essay describes the islands' beauty as a disguise. Then she stopped writing entirely. The whole book is under a hundred pages.",
        underdog:
          "She published nothing after 1945 and was read for decades as a footnote to her husband",
        tags: ["surrealism","Caribbean","translated"],
      },
    ],
  },
];
