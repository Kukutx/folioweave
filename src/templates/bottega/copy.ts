/** Interface wording around the shop's own content. Italian is the original
 * site's text; English follows the same plain, friendly register. The site
 * locale picks one, and the author's `labels` option overrides any entry. */
const it = {
  skipToContent: "Vai al contenuto",
  mainNavigation: "Navigazione principale",
  mobileNavigation: "Navigazione mobile",
  footerNavigation: "Navigazione a piè di pagina",
  quickContact: "Contatti rapidi",
  openMenu: "Apri il menu",
  closeMenu: "Chiudi il menu",
  topOfPage: "Inizio pagina",
  backToHomeLabel: "Torna alla home",
  navServices: "Servizi",
  navStores: "Negozi",
  navServicesPage: "Sartoria",
  navCatalogPage: "Prodotti",
  navContact: "Contatti",
  navWriting: "Notizie",
  whatsapp: "WhatsApp",
  whatsappCta: "Scrivici su WhatsApp",
  call: "Chiama",
  email: "Scrivici",
  whereLink: "Dove siamo e orari ↓",
  quickTitle: "Come possiamo aiutarti?",
  quickIntro:
    "Tocca una voce: si apre WhatsApp con il messaggio già pronto. Ti basta completarlo e inviarlo.",
  quickCta: "Scrivi su WhatsApp →",
  servicesTitle: "I nostri servizi",
  catalogLink: "Vedi cosa trovi in negozio →",
  servicesLink: "Vedi i prezzi delle riparazioni →",
  storesTitle: "Dove trovarci",
  storesIntro: "",
  findHere: "Cosa trovi",
  hours: "Orario",
  address: "Indirizzo",
  phone: "Telefono",
  addressPending: "Indirizzo disponibile su richiesta",
  mapName: "Su Google Maps: «{name}»",
  statusOpen: "Aperto ora · chiude alle {time}",
  statusOpensLater: "Chiuso ora · apre alle {time}",
  statusReopens: "Chiuso ora · riapre {day} alle {time}",
  statusClosedToday: "Oggi chiuso · riapre {day} alle {time}",
  tomorrow: "domani",
  directions: "Indicazioni",
  inquire: "Scrivici",
  inquireMessage: "Buongiorno, ho una domanda per il negozio di {city}: ",
  contactTitle: "Parliamone",
  contactText:
    "Hai una domanda, cerchi un prodotto o vuoi passare in negozio? Scrivici su WhatsApp o chiamaci: ti rispondiamo noi.",
  follow: "Seguici anche su",
  phoneAndWhatsapp: "Telefono e WhatsApp:",
  phoneOnly: "Telefono:",
  whatsappOnly: "WhatsApp:",
  backHome: "← Home",
  backHomeFooter: "← Torna alla home",
  catalogEyebrow: "Il nostro emporio",
  categoriesEyebrow: "Cosa puoi trovare",
  categoriesTitle: "Le nostre categorie",
  categoriesIntro:
    "Qui trovi una panoramica dei prodotti. L’assortimento cambia nel tempo: per un articolo specifico, chiedici informazioni.",
  catalogCtaTitle: "Cerchi qualcosa in particolare?",
  catalogCtaText:
    "Chiamaci o mandaci un messaggio. Ti aiutiamo a capire se l’articolo che cerchi è disponibile in negozio, senza ordini online.",
  askAvailability: "Chiedi se è disponibile",
  availabilityMessage: "Buongiorno, vorrei sapere se avete disponibile: ",
  servicesEyebrow: "Sartoria",
  askPrice: "Chiedi un prezzo su WhatsApp",
  priceMessage: "Buongiorno, vorrei sapere il prezzo per sistemare questo capo: ",
  stepsTitle: "Come funziona",
  whichStore: "In quale negozio?",
  priceListEyebrow: "Listino prezzi",
  priceListTitle: "Prezzi indicativi",
  priceListAside: "Il prezzo definitivo si conferma dopo aver valutato il capo.",
  priceNoteLabel: "Nota sui prezzi.",
  priceNote:
    "Sono prezzi indicativi: il costo può cambiare in base al tessuto e al lavoro necessario. Ti diciamo sempre il prezzo prima di iniziare.",
  servicesCtaTitle: "Hai un capo da sistemare?",
  servicesCtaText:
    "Raccontaci di cosa hai bisogno. Per informazioni e appuntamenti contattaci direttamente, senza moduli o ordini online.",
  notFoundEyebrow: "Errore 404",
  notFoundTitle: "Pagina non trovata",
  notFoundText:
    "L’indirizzo potrebbe essere cambiato. Torna alla home oppure scrivici su WhatsApp.",
  notFoundHome: "Torna alla home",
  allArticles: "Tutti gli articoli",
  allTopics: "Tutti",
  articleTopics: "Argomenti",
  noArticles: "Ancora nessun articolo.",
  minRead: "min di lettura",
  onThisPage: "In questa pagina",
  backToTop: "Torna su ↑",
};

export type BottegaCopy = typeof it;

const en: BottegaCopy = {
  skipToContent: "Skip to content",
  mainNavigation: "Main navigation",
  mobileNavigation: "Mobile navigation",
  footerNavigation: "Footer navigation",
  quickContact: "Quick contact",
  openMenu: "Open the menu",
  closeMenu: "Close the menu",
  topOfPage: "Top of the page",
  backToHomeLabel: "Back to the home page",
  navServices: "Services",
  navStores: "Shops",
  navServicesPage: "Prices",
  navCatalogPage: "Products",
  navContact: "Contact",
  navWriting: "News",
  whatsapp: "WhatsApp",
  whatsappCta: "Message us on WhatsApp",
  call: "Call",
  email: "Write to us",
  whereLink: "Where we are and opening hours ↓",
  quickTitle: "How can we help?",
  quickIntro:
    "Tap an option: WhatsApp opens with the message already written. Just finish it and send.",
  quickCta: "Message on WhatsApp →",
  servicesTitle: "Our services",
  catalogLink: "See what you’ll find in store →",
  servicesLink: "See the prices →",
  storesTitle: "Where to find us",
  storesIntro: "",
  findHere: "What you’ll find",
  hours: "Opening hours",
  address: "Address",
  phone: "Phone",
  addressPending: "Address available on request",
  mapName: "On Google Maps: “{name}”",
  statusOpen: "Open now · closes at {time}",
  statusOpensLater: "Closed now · opens at {time}",
  statusReopens: "Closed now · reopens {day} at {time}",
  statusClosedToday: "Closed today · reopens {day} at {time}",
  tomorrow: "tomorrow",
  directions: "Directions",
  inquire: "Message us",
  inquireMessage: "Hello, I have a question for the {city} shop: ",
  contactTitle: "Let’s talk",
  contactText:
    "Have a question, looking for a product or want to drop by? Message us on WhatsApp or call us: we’ll answer you ourselves.",
  follow: "Also on",
  phoneAndWhatsapp: "Phone and WhatsApp:",
  phoneOnly: "Phone:",
  whatsappOnly: "WhatsApp:",
  backHome: "← Home",
  backHomeFooter: "← Back to home",
  catalogEyebrow: "Our shop",
  categoriesEyebrow: "What you can find",
  categoriesTitle: "Our categories",
  categoriesIntro:
    "An overview of what we sell. The range changes over time: for a specific item, just ask us.",
  catalogCtaTitle: "Looking for something in particular?",
  catalogCtaText:
    "Call us or send us a message. We’ll tell you whether the item you want is in store, with no online orders.",
  askAvailability: "Ask if it’s available",
  availabilityMessage: "Hello, I’d like to know if you have: ",
  servicesEyebrow: "Services",
  askPrice: "Ask for a price on WhatsApp",
  priceMessage: "Hello, I’d like to know the price for this job: ",
  stepsTitle: "How it works",
  whichStore: "Which shop?",
  priceListEyebrow: "Price list",
  priceListTitle: "Indicative prices",
  priceListAside: "The final price is confirmed once we have seen the item.",
  priceNoteLabel: "About the prices.",
  priceNote:
    "These prices are indicative: the cost can change with the material and the work needed. We always tell you the price before we start.",
  servicesCtaTitle: "Have something that needs fixing?",
  servicesCtaText:
    "Tell us what you need. For information and appointments contact us directly, with no forms or online orders.",
  notFoundEyebrow: "Error 404",
  notFoundTitle: "Page not found",
  notFoundText:
    "The address may have changed. Go back to the home page or message us on WhatsApp.",
  notFoundHome: "Back to home",
  allArticles: "All articles",
  allTopics: "All",
  articleTopics: "Topics",
  noArticles: "No articles yet.",
  minRead: "min read",
  onThisPage: "On this page",
  backToTop: "Back to top ↑",
};

export type QuickAction = { title: string; detail: string; message: string };
export type Step = { title: string; detail: string };

const quickActions: Record<"it" | "en", { availability: QuickAction; price: QuickAction; visit: QuickAction }> = {
  it: {
    availability: {
      title: "Avete questo articolo?",
      detail: "Chiedi se un prodotto è disponibile, anche con una foto.",
      message: "Buongiorno, vorrei sapere se avete disponibile: ",
    },
    price: {
      title: "Quanto costa sistemare un capo?",
      detail: "Descrivi il lavoro o manda una foto del capo.",
      message: "Buongiorno, vorrei sapere il prezzo per sistemare questo capo: ",
    },
    visit: {
      title: "Vorrei passare in negozio",
      detail: "Fissa una prova, un ritiro o una consegna.",
      message: "Buongiorno, vorrei passare in negozio per ",
    },
  },
  en: {
    availability: {
      title: "Do you have this item?",
      detail: "Ask whether a product is in stock, even with a photo.",
      message: "Hello, I’d like to know if you have: ",
    },
    price: {
      title: "How much does a repair cost?",
      detail: "Describe the job or send a photo of the item.",
      message: "Hello, I’d like to know the price for this job: ",
    },
    visit: {
      title: "I’d like to come by",
      detail: "Book a fitting, a pick-up or a delivery.",
      message: "Hello, I’d like to come to the shop to ",
    },
  },
};

const steps: Record<"it" | "en", Step[]> = {
  it: [
    {
      title: "Portaci il capo",
      detail:
        "Passa in negozio, oppure mandaci prima una foto su WhatsApp e raccontaci cosa vuoi sistemare.",
    },
    {
      title: "Ti diciamo prezzo e tempi",
      detail:
        "Guardiamo il capo insieme e ti confermiamo il prezzo prima di iniziare il lavoro.",
    },
    {
      title: "Ritiri il capo sistemato",
      detail: "Ti avvisiamo quando è pronto: passi in negozio e lo ritiri.",
    },
  ],
  en: [
    {
      title: "Bring us the item",
      detail:
        "Drop by the shop, or first send us a photo on WhatsApp and tell us what you need.",
    },
    {
      title: "We tell you price and timing",
      detail:
        "We look at it together and confirm the price before we start the work.",
    },
    {
      title: "Pick it up",
      detail: "We let you know when it is ready: come by the shop and collect it.",
    },
  ],
};

export type BottegaOptions = {
  labels?: Partial<BottegaCopy>;
  quickActions?: QuickAction[];
  steps?: Step[];
  wordmark?: "split" | "plain";
  separateGroup?: string;
  catalogPath?: string;
  servicesPath?: string;
};

const language = (locale: string) =>
  locale.toLowerCase().startsWith("it") ? "it" : "en";

export function bottegaCopy(locale: string, labels?: Partial<BottegaCopy>): BottegaCopy {
  const base = language(locale) === "it" ? it : en;
  return { ...base, ...labels };
}

/** Default help entries; the repair-price one only when there is a price list. */
export function defaultQuickActions(locale: string, hasServices: boolean): QuickAction[] {
  const set = quickActions[language(locale)];
  return hasServices
    ? [set.availability, set.price, set.visit]
    : [set.availability, set.visit];
}

export function defaultSteps(locale: string): Step[] {
  return steps[language(locale)];
}
