/**
 * Optional NVIDIA latency benchmark — compares legacy vs optimized Sitegen settings.
 *
 * Run:
 *   SITEGEN_BENCHMARK_NVIDIA=1 GEMINI_FALLBACK_KEY=... \
 *   node --import tsx --test src/products/sitegen/qa/nvidia.benchmark.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSeekerStructuringPrompt } from "../ai/prompts";
import { callSitegenNvidia, callSitegenNvidiaLegacy } from "../ai/nvidia";

const live = process.env.SITEGEN_BENCHMARK_NVIDIA === "1" && Boolean(process.env.GEMINI_FALLBACK_KEY);

const SAMPLE_PROFILE = {
  fullName: "Alex Sharma",
  headline: "Software Engineer",
  summary: "Full-stack engineer with experience building production web applications.",
  skills: ["TypeScript", "Node.js", "React", "MongoDB", "AWS"],
  experience: [
    {
      title: "Senior Software Engineer",
      company: "Tech Corp",
      description: "Led development of customer-facing dashboards and APIs.",
    },
    {
      title: "Software Engineer",
      company: "Startup Labs",
      description: "Built hiring and workflow automation tools.",
    },
  ],
  education: [
    { school: "State University", degree: "B.Tech", field: "Computer Science" },
  ],
};

const SAMPLE_RESUME = `
Alex Sharma
Software Engineer | TypeScript | Node.js | React

SUMMARY
Full-stack engineer with 6+ years building scalable web applications, APIs, and developer tools.

EXPERIENCE
Senior Software Engineer — Tech Corp (2022–Present)
- Led development of customer-facing dashboards and REST/GraphQL APIs.
- Improved deployment pipelines and observability for production services.
- Mentored junior engineers and drove code quality standards.

Software Engineer — Startup Labs (2019–2022)
- Built hiring workflow automation and applicant tracking features.
- Integrated third-party APIs and payment providers.
- Optimized database queries and caching for high-traffic endpoints.

Software Engineer — Digital Agency (2017–2019)
- Delivered client websites and internal admin tools using React and Node.js.
- Collaborated with designers on responsive UI implementations.

EDUCATION
B.Tech Computer Science — State University

SKILLS
TypeScript, JavaScript, Node.js, React, Next.js, MongoDB, PostgreSQL, AWS, Docker, Git

PROJECTS
Rolebolt Platform — recruiting and career tools
Personal Portfolio — open-source component library
`.trim();

describe("sitegen NVIDIA benchmark", { skip: !live }, () => {
  it("reports legacy vs optimized NVIDIA latency", async () => {
    const { system, prompt } = buildSeekerStructuringPrompt({
      profileJson: JSON.stringify(SAMPLE_PROFILE),
      resumeText: SAMPLE_RESUME,
    });

    const legacyStarted = Date.now();
    const legacyRaw = await callSitegenNvidiaLegacy(prompt, system);
    const legacyMs = Date.now() - legacyStarted;
    assert.ok(legacyRaw.length > 20);

    const optimizedStarted = Date.now();
    const optimizedRaw = await callSitegenNvidia(prompt, system);
    const optimizedMs = Date.now() - optimizedStarted;
    assert.ok(optimizedRaw.length > 20);

    const savedMs = legacyMs - optimizedMs;
    const savedPct = legacyMs > 0 ? Math.round((savedMs / legacyMs) * 100) : 0;

    console.log("\n--- Sitegen NVIDIA benchmark ---");
    console.log(`Legacy (405B first, 90s timeout, 4000 tokens): ${legacyMs}ms`);
    console.log(`Optimized (70B first, 50s timeout, 2400 tokens): ${optimizedMs}ms`);
    console.log(`Difference: ${savedMs}ms (${savedPct}% ${savedMs >= 0 ? "faster" : "slower"})`);
    console.log("--------------------------------\n");
  });
});
