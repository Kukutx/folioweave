import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { RESUME_SOURCE } from "../scripts/resume-core.mjs";

const root = path.resolve(import.meta.dirname, "..");

export const exampleResume = JSON.parse(
  await fs.readFile(
    path.join(root, "content/resume/resume.example.json"),
    "utf8",
  ),
);

/** The smallest profile the resume pipeline reads. */
export const resumeProfile = (image = "/portfolio/resume/resume.png") => ({
  site: {
    resume: {
      image,
      pdf: "/portfolio/resume/resume.pdf",
      downloadName: "Resume.pdf",
    },
  },
});

/**
 * Runs `run` in a disposable project root holding only what the resume
 * pipeline reads. Pass `null` for a profile without a resume source.
 */
export async function withResumeProject(
  resume,
  run,
  profile = resumeProfile(),
) {
  const project = await fs.mkdtemp(
    path.join(os.tmpdir(), "folioweave-resume-test-"),
  );
  try {
    await fs.copyFile(
      path.join(root, "resume.schema.json"),
      path.join(project, "resume.schema.json"),
    );
    await fs.writeFile(
      path.join(project, "portfolio.json"),
      JSON.stringify(profile),
    );
    await fs.mkdir(path.join(project, path.dirname(RESUME_SOURCE)), {
      recursive: true,
    });
    if (resume)
      await fs.writeFile(
        path.join(project, RESUME_SOURCE),
        JSON.stringify(resume),
      );
    return await run(project);
  } finally {
    await fs.rm(project, { recursive: true });
  }
}
