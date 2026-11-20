// Default content of the golden ticket + hole punch (text as recorded).
export const ticketPunchContent = {
  // the invitation
  invited: "You’re invited",
  event: "The Polar Express",
  sub: "Christmas Eve departure · Round trip",
  host: "Hosted by The Conductor",
  month: "Dec",
  day: "24",
  date: "Thursday, December 24",
  time: "Boarding at 11:55 PM sharp",
  place: "Platform 7",
  placeArrow: "↗",
  placeNote: "Right outside your window",
  registration: "Registration",
  welcome: "Welcome, Adrian! To board the train, please register below.",
  initial: "A",
  name: "Adrian Abelarde",
  email: "adrian@example.com",
  register: "Register",
  going: "You’re going ✓",
  foot: "Seats are limited to those who can hear the bell.",
  // the golden ticket
  image: "/templates/ticket-club/punch/scene.webp", // the engraved scene in the ticket's oval (content image), 604 × 256 design px
  number: "№ 12252000",
  admit: "ADMIT ONE • FIRST CLASS",
  alt: "The Polar Express · Admit One · First Class",
  yes: "We had a feeling you’d say yes.",
  done: "Done",
  // GOING as the recording punches it, letter by letter: [x, y (ticket px), s after the first hole]
  word: [
    [75,170,0.0],[105,170,0.036],[130,166,0.072],[160,163,0.108],[51,205,0.144],[53,225,0.179],[134,220,0.215],
    [158,222,0.251],[158,242,0.287],[55,256,0.323],[164,266,0.359],[81,276,0.395],[114,276,0.431],
    [137,273,0.467],[237,151,0.5],[260,151,0.542],[290,149,0.585],[313,167,0.627],[212,185,0.67],
    [211,203,0.712],[321,197,0.755],[216,232,0.797],[317,228,0.839],[241,255,0.882],[275,253,0.924],
    [296,256,0.967],[366,141,1.017],[415,141,1.058],[444,136,1.1],[471,137,1.142],[388,148,1.183],
    [415,161,1.225],[423,194,1.267],[423,221,1.308],[399,244,1.35],[428,240,1.392],[474,235,1.433],
    [374,251,1.475],[453,247,1.517],[522,136,1.567],[627,129,1.608],[525,163,1.65],[551,160,1.692],
    [631,154,1.733],[530,192,1.775],[579,185,1.817],[631,181,1.858],[526,211,1.9],[603,205,1.942],
    [634,210,1.983],[635,230,2.025],[530,244,2.067],[707,116,2.117],[730,116,2.155],[759,114,2.194],
    [787,116,2.232],[682,153,2.271],[684,173,2.309],[763,167,2.347],[785,170,2.386],[684,196,2.424],
    [787,195,2.463],[717,223,2.501],[742,224,2.54],[768,224,2.578],[793,216,2.617],
  ] as [number, number, number][],
};
export type TicketPunchContent = typeof ticketPunchContent;
