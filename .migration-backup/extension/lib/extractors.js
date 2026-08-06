/**
 * Site-specific job extraction for major job boards and ATS platforms.
 * Falls back to generic Open Graph / schema.org / heuristics.
 */
(function () {
  const MAX_DESC = 20000;

  function text(el) {
    if (!el) return "";
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function firstText(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const t = text(el);
      if (t && t.length > 1) return t;
    }
    return "";
  }

  function meta(prop) {
    const el =
      document.querySelector(`meta[property="${prop}"]`) ||
      document.querySelector(`meta[name="${prop}"]`);
    return el?.getAttribute("content")?.trim() || "";
  }

  function cleanDescription(raw) {
    return String(raw || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_DESC);
  }

  function cloneDescription(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const clone = el.cloneNode(true);
      clone.querySelectorAll("script, style, button, svg, nav, form").forEach(n => n.remove());
      const t = cleanDescription(clone.textContent);
      if (t.length > 80) return t;
    }
    return "";
  }

  function hostIncludes(...parts) {
    const h = location.hostname.replace(/^www\./, "");
    return parts.some(p => h.includes(p) || location.href.includes(p));
  }

  function isLikelyJobPage() {
    const path = location.pathname.toLowerCase();
    const url = location.href.toLowerCase();
    const signals = [
      /\/jobs?\//,
      /\/job\//,
      /\/careers?\//,
      /\/position/,
      /\/opening/,
      /\/apply/,
      /viewjob/,
      /jobdetail/,
      /job-details/,
      /currentJobId=/,
      /jk=/,
      /gh_jid=/,
    ];
    if (signals.some(r => r.test(path) || r.test(url))) return true;

    const title = document.title.toLowerCase();
    if (/\b(job|career|hiring|apply|opening|position)\b/.test(title)) return true;

    return !!(
      document.querySelector("#jobDescriptionText, .jobs-description, [data-testid='jobsearch-JobInfoHeader-title'], .job-details-jobs-unified-top-card__job-title, .posting-headline, .job-post")
    );
  }

  function extractLinkedIn() {
    const title = firstText([
      ".job-details-jobs-unified-top-card__job-title h1",
      ".job-details-jobs-unified-top-card__job-title",
      "h1.t-24",
      "h1.top-card-layout__title",
      "[data-test-job-title]",
    ]);
    const company = firstText([
      ".job-details-jobs-unified-top-card__company-name a",
      ".job-details-jobs-unified-top-card__company-name",
      ".topcard__org-name-link",
      "[data-test-company-name]",
    ]);
    const location = firstText([
      ".job-details-jobs-unified-top-card__bullet",
      ".topcard__flavor--bullet",
      ".job-details-jobs-unified-top-card__primary-description-container",
    ]);
    const description = cloneDescription([
      ".jobs-description__content",
      ".jobs-box__html-content",
      "#job-details",
      ".description__text",
    ]);
    return { title, company, location, workMode: guessWorkMode(description + location), description, platform: "linkedin" };
  }

  function extractIndeed() {
    const title = firstText([
      "[data-testid='jobsearch-JobInfoHeader-title']",
      ".jobsearch-JobInfoHeader-title",
      "h1.jobsearch-JobInfoHeader-title",
    ]);
    const company = firstText([
      "[data-testid='inlineHeader-companyName'] a",
      "[data-testid='inlineHeader-companyName']",
      ".jobsearch-CompanyInfoContainer a",
    ]);
    const location = firstText([
      "[data-testid='job-location']",
      "[data-testid='inlineHeader-companyLocation']",
      ".jobsearch-JobInfoHeader-subtitle > div:last-child",
    ]);
    const description = cloneDescription([
      "#jobDescriptionText",
      ".jobsearch-JobComponent-description",
      "#jobdescSec",
    ]);
    return { title, company, location, workMode: guessWorkMode(description + location), description, platform: "indeed" };
  }

  function extractGreenhouse() {
    const title = firstText(["h1.app-title", ".posting-headline h2", "h1"]);
    const company = meta("og:site_name") || firstText([".company-name", ".logo img[alt]"]);
    const location = firstText([".location", ".posting-categories .location"]);
    const description = cloneDescription(["#content", ".content", ".posting-page"]);
    return { title, company, location, workMode: guessWorkMode(description), description, platform: "greenhouse" };
  }

  function extractLever() {
    const title = firstText(["h2.posting-headline", ".posting-headline", "h1"]);
    const company = meta("og:site_name") || firstText([".main-header-text", ".logo img[alt]"]);
    const location = firstText([".posting-categories .sort-by-time", ".location", ".posting-category"]);
    const description = cloneDescription([".content", ".section-wrapper", ".posting-page"]);
    return { title, company, location, workMode: guessWorkMode(description), description, platform: "lever" };
  }

  function extractWorkday() {
    const title = firstText([
      "[data-automation-id='jobPostingHeader'] h2",
      "[data-automation-id='jobPostingHeader']",
      "h1",
    ]);
    const company = meta("og:site_name") || document.title.split("|")[0]?.trim();
    const location = firstText([
      "[data-automation-id='locations']",
      "[data-automation-id='location']",
    ]);
    const description = cloneDescription([
      "[data-automation-id='jobPostingDescription']",
      "[data-automation-id='jobDescription']",
    ]);
    return { title, company, location, workMode: guessWorkMode(description), description, platform: "workday" };
  }

  function extractAshby() {
    const title = firstText(["h1", ".ashby-job-posting-heading"]);
    const company = meta("og:site_name");
    const description = cloneDescription([".ashby-job-posting-description", "main", "article"]);
    return { title, company, location: "", workMode: guessWorkMode(description), description, platform: "ashby" };
  }

  function extractSmartRecruiters() {
    const title = firstText(["h1.title", "h1", ".job-title"]);
    const company = firstText([".company-name", "a.company"]);
    const description = cloneDescription([".job-sections", ".job-description", "article"]);
    return { title, company, location: "", workMode: guessWorkMode(description), description, platform: "smartrecruiters" };
  }

  function extractGlassdoor() {
    const title = firstText(["[data-test='job-title']", "h1"]);
    const company = firstText(["[data-test='employer-name']", ".employerName"]);
    const description = cloneDescription([".jobDescriptionContent", "#JobDescriptionContainer"]);
    return { title, company, location: "", workMode: guessWorkMode(description), description, platform: "glassdoor" };
  }

  function extractGeneric() {
    const jsonLd = extractJsonLdJob();
    const title =
      jsonLd?.title ||
      meta("og:title") ||
      meta("twitter:title") ||
      firstText(["h1", "[itemprop='title']", ".job-title", ".posting-title"]);
    const company =
      jsonLd?.hiringOrganization?.name ||
      meta("og:site_name") ||
      firstText(["[itemprop='hiringOrganization']", ".company", ".employer-name"]);
    const location =
      jsonLd?.jobLocation?.address?.addressLocality ||
      jsonLd?.jobLocation?.name ||
      firstText(["[itemprop='jobLocation']", ".location"]);
    const description =
      jsonLd?.description ||
      meta("og:description") ||
      meta("description") ||
      cloneDescription([
        "[itemprop='description']",
        ".job-description",
        ".description",
        "article",
        "main",
      ]) ||
      extractBodyText();
    return {
      title: cleanJobTitle(title),
      company: company.slice(0, 180),
      location: String(location || "").slice(0, 120),
      workMode: guessWorkMode(description + " " + location),
      description: cleanDescription(description),
      platform: "other",
    };
  }

  function extractJsonLdJob() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || "");
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item["@type"] === "JobPosting") return item;
          if (item["@graph"]) {
            const job = item["@graph"].find(g => g["@type"] === "JobPosting");
            if (job) return job;
          }
        }
      } catch { /* skip */ }
    }
    return null;
  }

  function extractBodyText() {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll("script, style, nav, footer, header, aside, iframe, svg, form, [role='navigation'], [role='banner']").forEach(el => el.remove());
    return cleanDescription(clone.textContent);
  }

  function cleanJobTitle(raw) {
    return String(raw || "")
      .replace(/\s*[|\-–—]\s*(LinkedIn|Indeed|Glassdoor|Greenhouse|Lever).*$/i, "")
      .replace(/\s+-\s+.*careers.*$/i, "")
      .trim()
      .slice(0, 240);
  }

  function guessWorkMode(text) {
    const t = String(text).toLowerCase();
    if (/\bremote\b/.test(t) && /\bhybrid\b/.test(t)) return "Hybrid";
    if (/\bremote\b/.test(t)) return "Remote";
    if (/\bhybrid\b/.test(t)) return "Hybrid";
    if (/\bon[- ]site\b|\bin[- ]office\b/.test(t)) return "On-site";
    return "";
  }

  function extractSalary(text) {
    const m = String(text).match(/(?:\$|€|£|₹)\s?\d[\d,]*(?:\s?[-–—]\s?(?:\$|€|£|₹)?\s?\d[\d,]*)?(?:\s*(?:per|\/)\s*(?:year|yr|hour|hr|annum))?/i);
    return m ? m[0].slice(0, 80) : "";
  }

  function extractJob() {
    if (!isLikelyJobPage()) return null;

    let result = null;
    if (hostIncludes("linkedin.com")) result = extractLinkedIn();
    else if (hostIncludes("indeed.com", "indeed.co")) result = extractIndeed();
    else if (hostIncludes("greenhouse.io", "boards.greenhouse.io")) result = extractGreenhouse();
    else if (hostIncludes("lever.co", "jobs.lever.co")) result = extractLever();
    else if (hostIncludes("myworkdayjobs.com", "workday.com")) result = extractWorkday();
    else if (hostIncludes("ashbyhq.com", "jobs.ashbyhq.com")) result = extractAshby();
    else if (hostIncludes("smartrecruiters.com")) result = extractSmartRecruiters();
    else if (hostIncludes("glassdoor.com")) result = extractGlassdoor();
    else result = extractGeneric();

    if (!result) return null;

    const description = result.description || extractBodyText();
    if (!result.title && !description) return null;

    result.title = cleanJobTitle(result.title || document.title);
    result.description = description;
    result.salaryText = extractSalary(description);
    result.url = location.href.split("#")[0];
    result.isJobPage = true;
    return result;
  }

  /** @type {typeof extractJob} */
  window.RoleboltExtractors = {
    extractJob,
    isLikelyJobPage,
  };
})();
