/** The public demos: which Vercel project shows which demo profile. */
export const demoProjects = Object.freeze({
  classic: "folioweave-classic",
  light: "folioweave-refract-light",
  dark: "folioweave-refract-dark",
});

export const demoOrigin = (name) => `https://${demoProjects[name]}.vercel.app`;

/** Demo projects are connected to the repository and follow these branches;
 * main is what the public sees, develop proves a change before it gets there. */
export const demoBranches = Object.freeze(["main", "develop"]);
