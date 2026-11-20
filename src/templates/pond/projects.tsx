import { Fragment } from "react";
import { notFound } from "next/navigation";
import type { TemplateContext } from "@/core/contracts";
import { enabledProjects, pondLabels } from "./data";
import { Shell } from "./shell";
import s from "./pond.module.css";

/** The projects, in the intro's type: name and date, what it is, and its links in the social row's style. */
export default function ProjectsPage({ context }: { context: TemplateContext }) {
  const projects = enabledProjects(context);
  if (!projects.length) notFound();
  return (
    <Shell context={context} current="projects">
      <h1 className={s.title}>{pondLabels(context).projects}</h1>
      <ul className={s.list}>
        {projects.map((project) => (
          <li key={project.id} id={project.id} className={s.entry}>
            <h2 className={s.entryHead}>
              <span>{project.name}</span>
              {project.date && <span className={`${s.muted} ${s.small}`}>{project.date}</span>}
            </h2>
            {project.description && <p className={s.text}>{project.description}</p>}
            {project.actions && project.actions.length > 0 && (
              <p className={s.actions}>
                {project.actions.map((action, i) => {
                  const external = /^https?:/.test(action.href);
                  return (
                    <Fragment key={action.href}>
                      {i > 0 && <span className={s.sep}> / </span>}
                      <a
                        className={s.link}
                        href={action.href}
                        {...(external || action.newTab ? { target: "_blank", rel: "noreferrer" } : {})}
                      >
                        {action.label}
                      </a>
                    </Fragment>
                  );
                })}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Shell>
  );
}

export function describe(context: TemplateContext) {
  return { title: pondLabels(context).projects };
}
