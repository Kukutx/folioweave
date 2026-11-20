import { notFound } from "next/navigation";
import type { TemplateContext } from "@/core/contracts";
import { enabledProjects, isExternal, pondLabels } from "./data";
import { Head, Shell } from "./shell";
import { hashSeed, ORDER } from "./water/koi";
import { KoiSvg } from "./water/koi-svg";
import s from "./pond.module.css";
import p from "./projects.module.css";

// The work, shown the way koi are shown: each project is a fish of its own, in its own round bowl, seen from above.
// It is the same koi that swims in the pond (data.ts, koiSeeds); as the page scrolls it glides around its bowl.
export default function ProjectsPage({ context }: { context: TemplateContext }) {
  const projects = enabledProjects(context);
  if (!projects.length) notFound();
  const labels = pondLabels(context);
  return (
    <Shell context={context} current="projects" head={<Head title={labels.projects} />}>
      <ol className={p.show}>
        {projects.map((project, i) => (
          <li key={project.id} id={project.id} className={p.entry}>
            <div className={p.bowl} aria-hidden="true">
              <div className={p.swim}>
                <KoiSvg
                  className={p.koi}
                  seed={hashSeed(project.id)}
                  variety={ORDER[i % ORDER.length]}
                  bend={0.19}
                  phase={1.2 + i}
                  depth={0.04}
                  angle={0}
                  id={`bowl-${i}`}
                />
              </div>
            </div>
            <div className={p.text}>
              {project.date && <p className={s.label}>{project.date}</p>}
              <h2 className={p.name}>{project.name}</h2>
              {project.badge?.text && (
                <p className={p.badge}>
                  {project.badge.href ? (
                    <a
                      className={s.link}
                      href={project.badge.href}
                      {...(isExternal(project.badge.href) ? { target: "_blank", rel: "noreferrer" } : {})}
                    >
                      {project.badge.text}
                    </a>
                  ) : (
                    project.badge.text
                  )}
                </p>
              )}
              {project.description && <p className={p.description}>{project.description}</p>}
              {project.actions && project.actions.length > 0 && (
                <ul className={p.actions}>
                  {project.actions.map((action) => (
                    <li key={action.href}>
                      <a
                        className={p.action}
                        href={action.href}
                        {...((action.newTab ?? isExternal(action.href)) ? { target: "_blank", rel: "noreferrer" } : {})}
                      >
                        {action.label}
                        <span className={p.arrow} aria-hidden="true">
                          →
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Shell>
  );
}

export function describe(context: TemplateContext) {
  return { title: pondLabels(context).projects };
}
