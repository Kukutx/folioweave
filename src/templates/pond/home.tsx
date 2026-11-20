import { Fragment } from "react";
import type { TemplateModule } from "@/core/contracts";
import { introduction, koiSeeds, pondLabels } from "./data";
import { Bar } from "./bar";
import { Clearance } from "./clearance";
import { Parts } from "./parts";
import { Still } from "./water/still";
import { Water } from "./water/water";
import s from "./pond.module.css";

// The pond, seen from the bridge: the whole screen is water, with the introduction resting at its lower left. The
// koi keep clear of the text; touching the water feeds them, a lily pad can be moved.
const Home: TemplateModule["Home"] = ({ context }) => {
  const intro = introduction(context);
  const labels = pondLabels(context);
  return (
    <div className={`${s.home} ${s.onWater}`} data-pond-page="">
      <Bar context={context} current="home" />
      <main id="main" className={s.intro}>
        <div className={s.introText} data-pond-avoid="" data-pond-intro="">
          {intro.motto.length > 0 && (
            <p className={s.motto}>
              {intro.motto.map((line, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {line}
                </Fragment>
              ))}
            </p>
          )}
          <h1 className={s.greeting}>{intro.greeting}</h1>
          {intro.role.length > 0 && (
            <p className={s.role}>
              <Parts parts={intro.role} />
            </p>
          )}
          {intro.summary.length > 0 && (
            <p className={s.summary}>
              <Parts parts={intro.summary} />
            </p>
          )}
          {intro.links.length > 0 && (
            <ul className={s.links}>
              {intro.links.map((link) => (
                <li key={link.href}>
                  <a
                    className={s.link}
                    href={link.href}
                    {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  >
                    {link.text}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <Water label={labels.pond} className={s.pond}>
        <Still scene="home" seeds={koiSeeds(context)} id="home" />
      </Water>
      <p className={s.hint} aria-hidden="true" data-pond-hint="" data-pond-avoid="">
        {labels.hint}
      </p>
      <Clearance />
    </div>
  );
};
export default Home;
