"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import Link from "next/link";
import { computeJobQuality } from "@/lib/jobQuality";
import { apiErrorFromPayload, apiUrl, readApiJson } from "@/lib/api";
import { registerPostCreateChecklist } from "@/components/PostCreateChecklist";
import { StandardErrorNotice } from "@/components/StandardErrorNotice";
import { PrivateJobVisibilitySection } from "@/components/recruit/PrivateJobVisibilitySection";

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const STEPS = ["Role Basics", "Skills & Scope", "Compensation", "Review & Generate"];
const SENIORITY_OPTIONS = ["Intern", "Junior", "Mid-level", "Senior", "Lead", "Manager", "Director", "VP"];

type NicheExtraField = { key: string; label: string; placeholder: string };
type NicheOption = { label: string; locationOptional?: boolean; extraFields?: NicheExtraField[] };

const NICHE_OPTIONS: NicheOption[] = [
  { label: "AI, Data, Software & Product Tech" },
  { label: "Sales, Business Development & Revenue Roles" },
  { label: "Finance, Accounting, Banking & Fintech" },
  {
    label: "Healthcare, Pharma & Allied Medical Workforce",
    extraFields: [{ key: "licenseRequired", label: "License / Certification Required", placeholder: "e.g. Registered Nurse license, MBBS, Pharmacy license" }],
  },
  {
    label: "Skilled Blue-Collar, Logistics & Industrial Workforce",
    extraFields: [{ key: "shiftTiming", label: "Shift Timing", placeholder: "e.g. Day shift, Night shift, Rotational" }],
  },
  { label: "Creative, Marketing, Media & Design" },
  {
    label: "Content & Creator Economy",
    locationOptional: true,
    extraFields: [
      { key: "portfolioLink", label: "Portfolio / Sample Work Link", placeholder: "e.g. YouTube channel, Drive folder, Behance link" },
      { key: "platform", label: "Primary Platform", placeholder: "e.g. YouTube, Instagram, Podcast, Blog" },
    ],
  },
  {
    label: "Education & EdTech",
    locationOptional: true,
    extraFields: [{ key: "subjectExpertise", label: "Subject / Grade Level Expertise", placeholder: "e.g. Class 10-12 Maths, IELTS, Python for beginners" }],
  },
  {
    label: "HR & Recruitment",
    extraFields: [{ key: "hrFocusArea", label: "Focus Area", placeholder: "e.g. Talent Acquisition, Payroll, HRBP, L&D" }],
  },
  {
    label: "Real Estate & Construction",
    extraFields: [{ key: "projectType", label: "Project Type", placeholder: "e.g. Residential, Commercial, Site Supervision" }],
  },
  {
    label: "Social Media & Community Management",
    locationOptional: true,
    extraFields: [{ key: "platform", label: "Primary Platform(s)", placeholder: "e.g. Instagram, Discord, LinkedIn" }],
  },
];
const OTHER_NICHE_VALUE = "__other__";

function getNicheOption(niche: string): NicheOption | undefined {
  return NICHE_OPTIONS.find(n => n.label === niche);
}

function isKnownNiche(niche: string): boolean {
  return NICHE_OPTIONS.some(n => n.label === niche);
}

const JOB_TYPES = ["Full-time", "Part-time", "Internship", "Contract", "Freelance"];
const COMPANY_TYPES = ["Startup", "MNC", "Agency", "Hospital", "Fintech", "Manufacturing", "Recruitment Firm", "Other"];
const WORK_MODES = [
  { value: "remote", label: "Remote" },
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
];
const ALL_CURRENCIES: { code: string; name: string; symbol: string }[] = [
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "TWD", name: "Taiwan Dollar", symbol: "NT$" },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨" },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "₨" },
  { code: "NPR", name: "Nepalese Rupee", symbol: "₨" },
  { code: "MMK", name: "Myanmar Kyat", symbol: "K" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼" },
  { code: "QAR", name: "Qatari Riyal", symbol: "﷼" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KD" },
  { code: "BHD", name: "Bahraini Dinar", symbol: "BD" },
  { code: "OMR", name: "Omani Rial", symbol: "﷼" },
  { code: "JOD", name: "Jordanian Dinar", symbol: "JD" },
  { code: "EGP", name: "Egyptian Pound", symbol: "£" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh" },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh" },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "MAD" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "MXN", name: "Mexican Peso", symbol: "$" },
  { code: "ARS", name: "Argentine Peso", symbol: "$" },
  { code: "CLP", name: "Chilean Peso", symbol: "$" },
  { code: "COP", name: "Colombian Peso", symbol: "$" },
  { code: "PEN", name: "Peruvian Sol", symbol: "S/" },
  { code: "UYU", name: "Uruguayan Peso", symbol: "$U" },
  { code: "BOB", name: "Bolivian Boliviano", symbol: "Bs." },
  { code: "VES", name: "Venezuelan Bolívar", symbol: "Bs.S" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft" },
  { code: "RON", name: "Romanian Leu", symbol: "lei" },
  { code: "BGN", name: "Bulgarian Lev", symbol: "лв" },
  { code: "HRK", name: "Croatian Kuna", symbol: "kn" },
  { code: "RSD", name: "Serbian Dinar", symbol: "din" },
  { code: "UAH", name: "Ukrainian Hryvnia", symbol: "₴" },
  { code: "RUB", name: "Russian Ruble", symbol: "₽" },
  { code: "KZT", name: "Kazakhstani Tenge", symbol: "₸" },
  { code: "UZS", name: "Uzbekistani Som", symbol: "soʻm" },
  { code: "GEL", name: "Georgian Lari", symbol: "₾" },
  { code: "AMD", name: "Armenian Dram", symbol: "֏" },
  { code: "ILS", name: "Israeli New Shekel", symbol: "₪" },
  { code: "IRR", name: "Iranian Rial", symbol: "﷼" },
  { code: "IQD", name: "Iraqi Dinar", symbol: "ع.د" },
  { code: "AFN", name: "Afghan Afghani", symbol: "؋" },
  { code: "MOP", name: "Macanese Pataca", symbol: "P" },
  { code: "KHR", name: "Cambodian Riel", symbol: "៛" },
  { code: "LAK", name: "Lao Kip", symbol: "₭" },
  { code: "BND", name: "Brunei Dollar", symbol: "B$" },
  { code: "MVR", name: "Maldivian Rufiyaa", symbol: "Rf" },
  { code: "SCR", name: "Seychellois Rupee", symbol: "₨" },
  { code: "MUR", name: "Mauritian Rupee", symbol: "₨" },
  { code: "TND", name: "Tunisian Dinar", symbol: "DT" },
  { code: "DZD", name: "Algerian Dinar", symbol: "DA" },
  { code: "LYD", name: "Libyan Dinar", symbol: "LD" },
  { code: "XOF", name: "West African CFA Franc", symbol: "CFA" },
  { code: "XAF", name: "Central African CFA Franc", symbol: "FCFA" },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK" },
  { code: "MWK", name: "Malawian Kwacha", symbol: "MK" },
  { code: "RWF", name: "Rwandan Franc", symbol: "RF" },
  { code: "SOS", name: "Somali Shilling", symbol: "Sh" },
  { code: "SDG", name: "Sudanese Pound", symbol: "£" },
  { code: "CDF", name: "Congolese Franc", symbol: "FC" },
  { code: "AOA", name: "Angolan Kwanza", symbol: "Kz" },
  { code: "MZN", name: "Mozambican Metical", symbol: "MT" },
  { code: "BWP", name: "Botswanan Pula", symbol: "P" },
  { code: "NAD", name: "Namibian Dollar", symbol: "N$" },
  { code: "SZL", name: "Swazi Lilangeni", symbol: "L" },
  { code: "LSL", name: "Lesotho Loti", symbol: "L" },
  { code: "GMD", name: "Gambian Dalasi", symbol: "D" },
  { code: "GNF", name: "Guinean Franc", symbol: "FG" },
  { code: "CVE", name: "Cape Verdean Escudo", symbol: "$" },
  { code: "XPF", name: "CFP Franc", symbol: "F" },
  { code: "FJD", name: "Fijian Dollar", symbol: "FJ$" },
  { code: "PGK", name: "Papua New Guinean Kina", symbol: "K" },
  { code: "SBD", name: "Solomon Islands Dollar", symbol: "SI$" },
  { code: "TOP", name: "Tongan Paʻanga", symbol: "T$" },
  { code: "WST", name: "Samoan Tala", symbol: "WS$" },
  { code: "VUV", name: "Vanuatu Vatu", symbol: "VT" },
  { code: "TTD", name: "Trinidad and Tobago Dollar", symbol: "TT$" },
  { code: "JMD", name: "Jamaican Dollar", symbol: "J$" },
  { code: "BBD", name: "Barbadian Dollar", symbol: "Bds$" },
  { code: "HTG", name: "Haitian Gourde", symbol: "G" },
  { code: "DOP", name: "Dominican Peso", symbol: "RD$" },
  { code: "CUP", name: "Cuban Peso", symbol: "$" },
  { code: "GTQ", name: "Guatemalan Quetzal", symbol: "Q" },
  { code: "HNL", name: "Honduran Lempira", symbol: "L" },
  { code: "NIO", name: "Nicaraguan Córdoba", symbol: "C$" },
  { code: "CRC", name: "Costa Rican Colón", symbol: "₡" },
  { code: "PAB", name: "Panamanian Balboa", symbol: "B/." },
  { code: "PYG", name: "Paraguayan Guaraní", symbol: "₲" },
  { code: "GYD", name: "Guyanese Dollar", symbol: "G$" },
  { code: "SRD", name: "Surinamese Dollar", symbol: "$" },
  { code: "BZD", name: "Belize Dollar", symbol: "BZ$" },
  { code: "AWG", name: "Aruban Florin", symbol: "ƒ" },
  { code: "ANG", name: "Netherlands Antillean Guilder", symbol: "ƒ" },
  { code: "ALL", name: "Albanian Lek", symbol: "L" },
  { code: "MKD", name: "Macedonian Denar", symbol: "ден" },
  { code: "BAM", name: "Bosnia-Herzegovina Convertible Mark", symbol: "KM" },
  { code: "MDL", name: "Moldovan Leu", symbol: "L" },
  { code: "BYN", name: "Belarusian Ruble", symbol: "Br" },
  { code: "AZN", name: "Azerbaijani Manat", symbol: "₼" },
  { code: "TMT", name: "Turkmenistani Manat", symbol: "T" },
  { code: "TJS", name: "Tajikistani Somoni", symbol: "SM" },
  { code: "KGS", name: "Kyrgystani Som", symbol: "лв" },
  { code: "MNT", name: "Mongolian Tögrög", symbol: "₮" },
  { code: "BTN", name: "Bhutanese Ngultrum", symbol: "Nu" },
  { code: "ERN", name: "Eritrean Nakfa", symbol: "Nfk" },
  { code: "DJF", name: "Djiboutian Franc", symbol: "Fdj" },
  { code: "KMF", name: "Comorian Franc", symbol: "CF" },
  { code: "STN", name: "São Tomé and Príncipe Dobra", symbol: "Db" },
  { code: "MRU", name: "Mauritanian Ouguiya", symbol: "UM" },
  { code: "YER", name: "Yemeni Rial", symbol: "﷼" },
  { code: "SYP", name: "Syrian Pound", symbol: "£" },
  { code: "LBP", name: "Lebanese Pound", symbol: "£" },
  { code: "BIF", name: "Burundian Franc", symbol: "Fr" },
];

type FormData = {
  title: string;
  niche: string;
  companyName: string;
  companyType: string;
  jobType: string;
  department: string;
  seniority: string;
  location: string;
  workMode: string;
  responsibilities: string;
  mustHaveSkills: string;
  niceToHaveSkills: string;
  nicheDetails: Record<string, string>;
  companyTypeOther: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  experienceMin: string;
  experienceMax: string;
  educationRequirement: string;
  noticePeriod: string;
  freshersAllowed: boolean;
  verifiedCompany: boolean;
  publicVisibility: boolean;
  openings: string;
  applicationDeadline: string;
  perks: string;
  languageRequirement: string;
  timezoneOverlap: string;
};

const DEFAULT: FormData = {
  title: "", niche: NICHE_OPTIONS[0].label, companyName: "", companyType: "Startup", jobType: "Full-time",
  department: "", seniority: "Mid-level", location: "",
  workMode: "remote", responsibilities: "", mustHaveSkills: "",
  niceToHaveSkills: "", nicheDetails: {}, companyTypeOther: "",
  salaryMin: "", salaryMax: "", salaryCurrency: "INR",
  experienceMin: "", experienceMax: "", educationRequirement: "", noticePeriod: "",
  freshersAllowed: false, verifiedCompany: false, publicVisibility: true,
  openings: "1", applicationDeadline: "", perks: "", languageRequirement: "", timezoneOverlap: "",
};

// Heuristic check to catch obviously fake/junk input (e.g. "asdasdasd",
// "aaaaaaa") without needing a server round-trip for every keystroke.
function hasRepeatingPattern(letters: string): boolean {
  const n = letters.length;
  for (let period = 2; period <= 5; period++) {
    if (n < period * 3) continue;
    let matches = 0;
    for (let i = period; i < n; i++) {
      if (letters[i] === letters[i - period]) matches++;
    }
    if (matches / (n - period) > 0.55) return true;
  }
  return false;
}

function isMeaningfulText(text: string, minWords = 1, minLength = 3): boolean {
  const trimmed = text.trim();
  if (trimmed.length < minLength) return false;
  const letters = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  if (letters.length >= 4) {
    const uniqueChars = new Set(letters).size;
    if (uniqueChars < 3) return false;
    const counts: Record<string, number> = {};
    for (const c of letters) counts[c] = (counts[c] || 0) + 1;
    const maxCount = Math.max(...Object.values(counts));
    if (maxCount / letters.length > 0.5) return false;
  }
  if (letters.length >= 6 && hasRepeatingPattern(letters)) return false;
  // Count words loosely — accept short acronyms/tech tokens (React, AWS, CI/CD, 5+)
  // as long as they contain at least one letter, so real skills text isn't penalized.
  const words = trimmed.split(/\s+/).filter(w => /[a-zA-Z]/.test(w));
  return words.length >= minWords;
}

// Returns a human-readable reason why a text value looks like spam/junk.
// Returns null if the text is fine or empty (empty is handled separately by canProceed).
function getTextQualityError(text: string, fieldLabel: string, minWords = 1, minLength = 3): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null; // empty — different error
  if (trimmed.length < minLength) return null; // too short — let canProceed handle it silently
  const letters = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  if (letters.length >= 4) {
    const uniqueChars = new Set(letters).size;
    if (uniqueChars < 3) {
      return `"${trimmed}" doesn't look like a real ${fieldLabel}. Please use actual words.`;
    }
    const counts: Record<string, number> = {};
    for (const c of letters) counts[c] = (counts[c] || 0) + 1;
    const maxCount = Math.max(...Object.values(counts));
    if (maxCount / letters.length > 0.5) {
      return `Looks like a repeated character. Please enter a real ${fieldLabel}.`;
    }
  }
  if (letters.length >= 6 && hasRepeatingPattern(letters)) {
    return `"${trimmed.slice(0, 20)}${trimmed.length > 20 ? "…" : ""}" looks like random text. Please enter a real ${fieldLabel}.`;
  }
  const words = trimmed.split(/\s+/).filter(w => /[a-zA-Z]/.test(w));
  if (words.length < minWords) return null; // word count — handled by canProceed
  return null;
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mt-1.5 flex items-start gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
      <svg className="mt-0.5 shrink-0" width="12" height="12" fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
      </svg>
      <span className="text-xs text-rose-600 leading-snug font-medium">{message}</span>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{children}</span>;
}

function Input({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 4 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 resize-none"
    />
  );
}

function CurrencySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = ALL_CURRENCIES.find(c => c.code === value) ?? { code: value, name: "", symbol: "" };

  const filtered = query.trim()
    ? ALL_CURRENCIES.filter(c =>
        c.code.toLowerCase().includes(query.toLowerCase()) ||
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.symbol.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_CURRENCIES;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery(""); }}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-slate-300"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0 w-9 text-center rounded-lg border border-indigo-200 bg-indigo-50 py-0.5 text-[11px] font-black text-indigo-700">
            {selected.code}
          </span>
          <span className="text-sm font-medium text-slate-900 truncate">{selected.name || selected.code}</span>
        </span>
        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400 transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }} viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-2xl border border-black/[0.07] bg-white shadow-[0_12px_36px_rgba(0,0,0,0.14)] overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or code (e.g. EUR, Yen, Rupee)…"
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
            )}
          </div>

          {/* List */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-xs text-slate-400 text-center">No currency found for "{query}"</p>
            ) : (
              filtered.map(c => (
                <button
                  type="button"
                  key={c.code}
                  onClick={() => { onChange(c.code); setOpen(false); setQuery(""); }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-indigo-50 ${c.code === value ? "bg-indigo-50 text-indigo-700" : "text-slate-700"}`}
                >
                  <span className="shrink-0 w-9 text-center rounded-md border border-slate-200 bg-slate-50 py-0.5 text-[10px] font-black text-slate-600">{c.code}</span>
                  <span className="flex-1 text-left text-sm truncate">{c.name}</span>
                  <span className="shrink-0 text-xs text-slate-400">{c.symbol}</span>
                </button>
              ))
            )}
          </div>

          {/* Footer count */}
          <div className="border-t border-slate-100 px-4 py-2 text-[10px] font-semibold text-slate-400">
            {filtered.length} of {ALL_CURRENCIES.length} currencies
          </div>
        </div>
      )}
    </div>
  );
}

function NicheSelect({ value, onChange, customValue, onCustomChange }: {
  value: string;
  onChange: (v: string) => void;
  customValue: boolean;
  onCustomChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isOther = customValue;
  const filtered = NICHE_OPTIONS.filter(n => n.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-slate-300"
      >
        <span className={isOther ? "text-slate-400 font-normal" : ""}>{isOther ? "Other (type below)" : value}</span>
        <span className="text-slate-400 text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1.5 w-full rounded-2xl border border-black/[0.07] bg-white shadow-[0_12px_36px_rgba(0,0,0,0.14)] overflow-hidden">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search niches..."
            className="w-full border-b border-slate-100 bg-transparent px-4 py-3 text-sm text-slate-800 outline-none placeholder-slate-400"
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.map(n => (
              <button
                type="button"
                key={n.label}
                onClick={() => { onChange(n.label); setOpen(false); setQuery(""); }}
                className={`block w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 transition ${n.label === value && !isOther ? "text-indigo-700 font-semibold bg-indigo-50/50" : "text-slate-700"}`}
              >
                {n.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-xs text-slate-400">No match — try "Other" below.</p>
            )}
            <button
              type="button"
              onClick={() => { onChange(OTHER_NICHE_VALUE); setOpen(false); setQuery(""); }}
              className={`block w-full text-left px-4 py-2.5 text-sm border-t border-slate-100 hover:bg-indigo-50 transition ${isOther ? "text-indigo-700 font-semibold" : "text-slate-500"}`}
            >
              + Other (my role doesn't fit these)
            </button>
          </div>
        </div>
      )}
      {isOther && (
        <div className="mt-3">
          <Input value={value === OTHER_NICHE_VALUE ? "" : value} onChange={onCustomChange} placeholder="e.g. Hospitality & Travel, Voice Acting, Photography..." />
        </div>
      )}
    </div>
  );
}

function NewJobContent() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(DEFAULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>("");
  const [token, setToken] = useState<string | null>(null);
  const [createdJob, setCreatedJob] = useState<{ id: string; title: string; publicVisibility: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState("");
  const [benchmark, setBenchmark] = useState<{
    p25: number; p50: number; p75: number; min: number; max: number;
    currency: string; insight: string; factors: string[];
  } | null>(null);

  const { sessionToken } = useRecruitAuth();
  useEffect(() => {
    if (sessionToken) setToken(sessionToken);
  }, [sessionToken]);

  function update(key: keyof FormData) {
    return (val: string) => setForm(prev => ({ ...prev, [key]: val }));
  }

  async function fetchSalaryBenchmark() {
    if (!form.title) return;
    setBenchmarkLoading(true); setBenchmarkError(""); setBenchmark(null);
    try {
      const params = new URLSearchParams({
        title: form.title,
        seniority: form.seniority,
        niche: form.niche,
        location: form.location || "Global",
        currency: form.salaryCurrency,
      });
      const res = await fetch(apiUrl(`/recruit/salary-benchmark?${params}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch benchmark");
      setBenchmark(data.benchmark);
    } catch (e: any) {
      setBenchmarkError(e.message);
    } finally {
      setBenchmarkLoading(false);
    }
  }

  function updateNicheDetail(key: string) {
    return (val: string) => setForm(prev => ({ ...prev, nicheDetails: { ...prev.nicheDetails, [key]: val } }));
  }

  // Switching niches clears extra fields from the previous niche so stale
  // metadata (e.g. a "Portfolio Link" left over from Content & Creator)
  // doesn't get submitted/stored/prompted for an unrelated niche.
  function setNiche(newNiche: string) {
    setForm(prev => ({ ...prev, niche: newNiche, nicheDetails: {} }));
  }

  const activeNicheOption = getNicheOption(form.niche);
  const locationRequired = form.workMode !== "remote" && !activeNicheOption?.locationOptional;

  // Returns a human-readable reason blocking the current step, or null if all good.
  function getBlockReason(): string | null {
    if (step === 0) {
      if (!form.title.trim()) return "Job Title is required.";
      if (!isMeaningfulText(form.title, 1, 3)) return "Job Title looks like random text — please enter a real title (e.g. \"Senior Frontend Engineer\").";
      if (form.niche === OTHER_NICHE_VALUE || !isMeaningfulText(form.niche, 1, 2)) return "Please select or enter a valid niche for this role.";
      if (form.companyType === "Other" && !isMeaningfulText(form.companyTypeOther, 1, 2)) return "Please enter a valid company type.";
      if (locationRequired && !isMeaningfulText(form.location, 1, 2)) return "Location is required for this work mode — please enter a real city or region.";
      return null;
    }
    if (step === 1) {
      if (!form.responsibilities.trim()) return "Key Responsibilities is required.";
      if (!isMeaningfulText(form.responsibilities, 4, 15)) return "Key Responsibilities looks like random text. Please describe what the candidate will actually do (at least a few words).";
      if (!form.mustHaveSkills.trim()) return "Must-Have Skills is required.";
      if (!isMeaningfulText(form.mustHaveSkills, 2, 6)) return "Must-Have Skills looks like random text. Please list real skills (e.g. \"React, TypeScript, 3+ years experience\").";
      return null;
    }
    return null;
  }

  function canProceed() {
    if (step === 0) {
      if (form.niche === OTHER_NICHE_VALUE || !isMeaningfulText(form.niche, 1, 2)) return false;
      if (!isMeaningfulText(form.title, 1, 3)) return false;
      if (form.companyType === "Other" && !isMeaningfulText(form.companyTypeOther, 1, 2)) return false;
      if (locationRequired && !isMeaningfulText(form.location, 1, 2)) return false;
      return true;
    }
    if (step === 1) {
      return isMeaningfulText(form.responsibilities, 4, 15) && isMeaningfulText(form.mustHaveSkills, 2, 6);
    }
    return true;
  }

  async function handleSubmit() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const resolvedCompanyType = form.companyType === "Other" ? form.companyTypeOther.trim() : form.companyType;
      const res = await fetch(apiUrl("/recruit/jobs"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          companyType: resolvedCompanyType,
          salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
          salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
          openings: form.openings ? Number(form.openings) : 1,
          applicationDeadline: form.applicationDeadline || undefined,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) {
        throw apiErrorFromPayload(res.status, data, data.message || data.error || "Failed to create job.");
      }
       setCreatedJob({
         id: data.job._id,
         title: form.title,
         publicVisibility: data.job.publicVisibility !== false,
       });
      registerPostCreateChecklist(data.job._id, form.title);
    } catch (e: any) {
      setError(e);
      setLoading(false);
    }
  }

  if (createdJob) {
     const publicUrl = createdJob.publicVisibility
       ? `${typeof window !== "undefined" ? window.location.origin : "https://www.rolebolt.tech"}/recruit/opportunities/${createdJob.id}`
       : "";
     const shareMsg = createdJob.publicVisibility
       ? encodeURIComponent(`We're hiring! Check out this job: ${createdJob.title}\n${publicUrl}`)
       : "";

    function copyLink() {
       if (!publicUrl) return;
      navigator.clipboard.writeText(publicUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }

    const sharePlatforms = [
      { name: "WhatsApp", href: `https://wa.me/?text=${shareMsg}`, bg: "bg-[#25d366]", icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      )},
      { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`, bg: "bg-[#1877f2]", icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      )},
      { name: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(publicUrl)}&text=${encodeURIComponent(`We're hiring: ${createdJob.title}`)}`, bg: "bg-[#2aabee]", icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
      )},
      { name: "X / Twitter", href: `https://twitter.com/intent/tweet?text=${shareMsg}`, bg: "bg-[#000000]", icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      )},
      { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`, bg: "bg-[#0a66c2]", icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      )},
      { name: "Email", href: `mailto:?subject=${encodeURIComponent(`Job Opening: ${createdJob.title}`)}&body=${shareMsg}`, bg: "bg-[#6366f1]", icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
      )},
      { name: "SMS", href: `sms:?&body=${shareMsg}`, bg: "bg-[#10b981]", icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      )},
    ];

    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
        <div className="w-full max-w-lg text-center rounded-3xl bg-white border border-black/[0.06] p-8 sm:p-10
          shadow-[0_1px_3px_rgba(0,0,0,0.05),0_12px_36px_rgba(0,0,0,0.08)]">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 border border-emerald-200 mx-auto mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-[26px] font-bold text-slate-900 mb-2">Job Posted!</h1>
           <p className="text-slate-500 text-sm mb-6 leading-relaxed">
             <span className="text-slate-900 font-semibold">{createdJob.title}</span>{" "}
             {createdJob.publicVisibility
               ? "is live. Share the link to start getting applicants."
               : "is ready as a private hiring workspace. Import candidates from your other sources to continue hiring privately."}
           </p>

           {createdJob.publicVisibility ? (
             <>
               {/* Link copy row */}
               <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left mb-5">
                 <p className="flex-1 text-xs text-slate-500 truncate font-mono">{publicUrl}</p>
                 <button
                   onClick={copyLink}
                   className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                     copied ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                   }`}
                 >
                   {copied ? "✓ Copied!" : "Copy"}
                 </button>
               </div>

               {/* Share platforms grid */}
               <div className="mb-6">
                 <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3 text-left">Share on</p>
                 <div className="grid grid-cols-4 gap-2.5">
                   {sharePlatforms.map(p => (
                     <a
                       key={p.name}
                       href={p.href}
                       target="_blank"
                       rel="noopener noreferrer"
                       className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-white transition hover:opacity-90 active:scale-95 ${p.bg}`}
                       title={p.name}
                     >
                       {p.icon}
                       <span className="text-[9px] font-bold leading-none">{p.name.split(" ")[0]}</span>
                     </a>
                   ))}
                 </div>
               </div>
             </>
           ) : (
             <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
               <p className="text-xs font-bold text-amber-800">Private job — no public link was created</p>
               <p className="mt-1 text-xs leading-relaxed text-amber-700">Only you can access and manage this job from your dashboard.</p>
             </div>
           )}

          <div className="flex flex-col gap-2">
            <Link
              href={`/recruit/jobs/${createdJob.id}`}
              className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white transition
                shadow-[0_2px_8px_rgba(79,70,229,0.30)] hover:bg-indigo-700 hover:shadow-[0_4px_16px_rgba(79,70,229,0.40)] hover:-translate-y-px"
            >
              View Pipeline & Candidates
            </Link>
            <Link
              href="/recruit/dashboard"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition py-2"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-black/[0.07] shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.05)]">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-4 py-3 sm:px-6">
          <Link href="/recruit/dashboard" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition">
            <ChevronLeftIcon /> Dashboard
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-[13px] font-bold text-slate-900">New Job Posting</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-700 mb-4">
            <SparkIcon /> AI Job Description Generator
          </div>
          <h1 className="text-[26px] font-bold tracking-tight text-slate-900 sm:text-[28px]">Create a New Job Posting</h1>
          <p className="mt-2 text-[13px] text-slate-500 leading-relaxed">Answer a few questions. The AI generates a full JD and scoring rubric automatically.</p>
        </div>

        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                  i < step ? "bg-indigo-600 text-white cursor-pointer shadow-[0_2px_6px_rgba(79,70,229,0.35)]"
                  : i === step ? "border-2 border-indigo-500 text-indigo-600 bg-white"
                  : "border border-slate-300 text-slate-400 bg-white"
                }`}
              >
                {i < step ? <CheckIcon /> : i + 1}
              </button>
              <span className={`hidden text-[12px] sm:block truncate font-semibold ${i === step ? "text-slate-900" : "text-slate-400"}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-indigo-300" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>

        <div className="rounded-[1.75rem] bg-white border border-black/[0.06] p-6 sm:p-8
          shadow-[0_1px_3px_rgba(0,0,0,0.05),0_8px_28px_rgba(0,0,0,0.06)]">
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-[17px] font-bold text-slate-900 mb-6">Role Basics</h2>
              <div>
                <FieldLabel>Job Title *</FieldLabel>
                <Input value={form.title} onChange={update("title")} placeholder="e.g. Senior Frontend Engineer" />
                <FieldError message={getTextQualityError(form.title, "job title", 1, 3)} />
              </div>
              <div>
                <FieldLabel>Niche *</FieldLabel>
                <NicheSelect
                  value={form.niche}
                  onChange={setNiche}
                  customValue={form.niche === OTHER_NICHE_VALUE || !isKnownNiche(form.niche)}
                  onCustomChange={update("niche")}
                />
              </div>
              {activeNicheOption?.extraFields?.map(f => (
                <div key={f.key}>
                  <FieldLabel>{f.label}</FieldLabel>
                  <Input
                    value={form.nicheDetails[f.key] || ""}
                    onChange={updateNicheDetail(f.key)}
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Company Name</FieldLabel>
                  <Input value={form.companyName} onChange={update("companyName")} placeholder="e.g. Rolebolt" />
                </div>
                <div>
                  <FieldLabel>Company Type</FieldLabel>
                  <select
                    value={form.companyType}
                    onChange={e => update("companyType")(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                  >
                    {COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {form.companyType === "Other" && (
                    <div className="mt-2">
                      <Input value={form.companyTypeOther} onChange={update("companyTypeOther")} placeholder="e.g. Non-profit, Cooperative" />
                      <FieldError message={getTextQualityError(form.companyTypeOther, "company type", 1, 2)} />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <FieldLabel>Department</FieldLabel>
                <Input value={form.department} onChange={update("department")} placeholder="e.g. Engineering, Marketing, Sales" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Seniority Level</FieldLabel>
                  <select
                    value={form.seniority}
                    onChange={e => update("seniority")(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                  >
                    {SENIORITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Job Type</FieldLabel>
                  <select
                    value={form.jobType}
                    onChange={e => update("jobType")(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                  >
                    {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Work Mode</FieldLabel>
                  <div className="flex gap-2">
                    {WORK_MODES.map(m => (
                      <button
                        key={m.value}
                        onClick={() => update("workMode")(m.value)}
                        className={`flex-1 rounded-xl border py-3 text-xs font-bold transition ${
                          form.workMode === m.value
                            ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-[0_1px_3px_rgba(79,70,229,0.15)]"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <FieldLabel>
                  {locationRequired ? "Location *" : (
                    <>Location <span className="text-slate-400 normal-case font-medium">(optional for this niche/work mode)</span></>
                  )}
                </FieldLabel>
                <Input value={form.location} onChange={update("location")} placeholder={locationRequired ? "e.g. New York, Remote" : "e.g. Anywhere / Remote-friendly (optional)"} />
                <FieldError message={locationRequired ? getTextQualityError(form.location, "location", 1, 2) : null} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Min Experience</FieldLabel>
                  <Input type="number" value={form.experienceMin} onChange={update("experienceMin")} placeholder="0" />
                </div>
                <div>
                  <FieldLabel>Max Experience</FieldLabel>
                  <Input type="number" value={form.experienceMax} onChange={update("experienceMax")} placeholder="5" />
                </div>
              </div>
              <div>
                <FieldLabel>Number of Openings <span className="text-slate-400 normal-case font-medium">(optional, defaults to 1)</span></FieldLabel>
                <Input type="number" value={form.openings} onChange={update("openings")} placeholder="1" />
              </div>
              {form.workMode === "remote" && (
                <div>
                  <FieldLabel>Timezone / Working Hours Overlap <span className="text-slate-400 normal-case font-medium">(optional)</span></FieldLabel>
                  <Input value={form.timezoneOverlap} onChange={update("timezoneOverlap")} placeholder="e.g. IST business hours, 4hrs overlap with EST" />
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-[17px] font-bold text-slate-900 mb-6">Skills & Responsibilities</h2>
              <div>
                <FieldLabel>Key Responsibilities * <span className="text-slate-400 normal-case font-medium">(what they'll actually do)</span></FieldLabel>
                <Textarea
                  rows={5}
                  value={form.responsibilities}
                  onChange={update("responsibilities")}
                  placeholder="e.g. Lead architecture decisions for our React frontend, mentor junior developers, collaborate with design and product to ship new features bi-weekly..."
                />
                <FieldError message={getTextQualityError(form.responsibilities, "job responsibilities", 4, 15)} />
              </div>
              <div>
                <FieldLabel>Must-Have Skills * <span className="text-slate-400 normal-case font-medium">(non-negotiable)</span></FieldLabel>
                <Textarea
                  rows={3}
                  value={form.mustHaveSkills}
                  onChange={update("mustHaveSkills")}
                  placeholder="e.g. 4+ years React, TypeScript, REST API experience, strong communication skills..."
                />
                <FieldError message={getTextQualityError(form.mustHaveSkills, "must-have skills", 2, 6)} />
              </div>
              <div>
                <FieldLabel>Nice-to-Have Skills <span className="text-slate-400 normal-case font-medium">(preferred but not required)</span></FieldLabel>
                <Textarea
                  rows={3}
                  value={form.niceToHaveSkills}
                  onChange={update("niceToHaveSkills")}
                  placeholder="e.g. Next.js experience, prior startup experience, familiarity with Figma..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Education Requirement</FieldLabel>
                  <Input value={form.educationRequirement} onChange={update("educationRequirement")} placeholder="e.g. Any graduate, B.Tech preferred" />
                </div>
                <div>
                  <FieldLabel>Notice Period</FieldLabel>
                  <Input value={form.noticePeriod} onChange={update("noticePeriod")} placeholder="e.g. Immediate to 30 days" />
                </div>
              </div>
              <div>
                <FieldLabel>Language Requirement <span className="text-slate-400 normal-case font-medium">(optional)</span></FieldLabel>
                <Input value={form.languageRequirement} onChange={update("languageRequirement")} placeholder="e.g. Fluent English + Hindi, regional language a plus" />
              </div>
              <div>
                <FieldLabel>Perks & Benefits <span className="text-slate-400 normal-case font-medium">(optional)</span></FieldLabel>
                <Textarea
                  rows={2}
                  value={form.perks}
                  onChange={update("perks")}
                  placeholder="e.g. Health insurance, WFH stipend, ESOPs, flexible leave..."
                />
              </div>
               <div className="flex flex-wrap gap-3">
                 {[
                   ["freshersAllowed", "Freshers allowed"],
                 ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, [key]: !prev[key as keyof FormData] }))}
                    className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                      form[key as keyof FormData] ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                ✓ <span className="text-slate-500">Verified company badge</span> — automatically added when your company is verified.{" "}
                <a href="/recruit/recruiter-profile" className="text-indigo-600 font-semibold hover:underline">Request verification →</a>
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-[17px] font-bold text-slate-900 mb-2">Compensation</h2>
              <p className="text-[13px] text-slate-500 mb-6 leading-relaxed">Adding a salary range helps attract better-fit candidates and reduces time wasted on mismatched expectations. You can skip this.</p>
              <div>
                <FieldLabel>Currency</FieldLabel>
                <CurrencySelect value={form.salaryCurrency} onChange={update("salaryCurrency")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Minimum (per year)</FieldLabel>
                  <Input type="number" value={form.salaryMin} onChange={update("salaryMin")} placeholder="e.g. 800000" />
                </div>
                <div>
                  <FieldLabel>Maximum (per year)</FieldLabel>
                  <Input type="number" value={form.salaryMax} onChange={update("salaryMax")} placeholder="e.g. 1400000" />
                </div>
              </div>

              {/* AI Salary Benchmark */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-indigo-700">📊 AI Market Salary Benchmark</p>
                    <p className="text-[11px] text-indigo-500 mt-0.5">See what the market pays for this role — fill in your salary range based on data.</p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchSalaryBenchmark}
                    disabled={benchmarkLoading || !form.title}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition shrink-0"
                  >
                    {benchmarkLoading ? (
                      <><span className="inline-block h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />Fetching…</>
                    ) : "Get Market Range"}
                  </button>
                </div>
                {benchmarkError && <p className="text-xs text-rose-600 font-medium">{benchmarkError}</p>}
                {benchmark && (() => {
                  const fmt = (n: number) => n >= 100000
                    ? `${benchmark.currency} ${(n / 1000).toFixed(0)}K`
                    : `${benchmark.currency} ${n.toLocaleString()}`;
                  const range = benchmark.max - benchmark.min;
                  const pct = (v: number) => range > 0 ? Math.round(((v - benchmark.min) / range) * 100) : 50;
                  return (
                    <div className="space-y-3">
                      {/* Range bar */}
                      <div className="space-y-1.5">
                        <div className="relative h-3 rounded-full bg-indigo-100 overflow-hidden">
                          <div
                            className="absolute h-full rounded-full bg-gradient-to-r from-indigo-300 to-indigo-500"
                            style={{ left: `${pct(benchmark.p25)}%`, width: `${pct(benchmark.p75) - pct(benchmark.p25)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-indigo-600">
                          <span>{fmt(benchmark.min)}</span>
                          <span className="text-indigo-800">Median: {fmt(benchmark.p50)}</span>
                          <span>{fmt(benchmark.max)}</span>
                        </div>
                      </div>
                      {/* Percentile labels */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {[["P25", benchmark.p25], ["P50 (Median)", benchmark.p50], ["P75", benchmark.p75]].map(([label, val]) => (
                          <div key={label as string} className="rounded-lg bg-white border border-indigo-100 py-2">
                            <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wide">{label}</p>
                            <p className="text-xs font-bold text-indigo-800 mt-0.5">{fmt(val as number)}</p>
                          </div>
                        ))}
                      </div>
                      {/* Insight */}
                      <p className="text-[11px] text-slate-600 leading-5 italic">&ldquo;{benchmark.insight}&rdquo;</p>
                      {/* Factors */}
                      <div className="flex flex-wrap gap-1.5">
                        {benchmark.factors.map((f, i) => (
                          <span key={i} className="rounded-full border border-indigo-100 bg-white px-2 py-0.5 text-[10px] font-medium text-indigo-600">{f}</span>
                        ))}
                      </div>
                      {/* Quick fill buttons */}
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setForm(p => ({ ...p, salaryMin: String(benchmark.p25), salaryMax: String(benchmark.p75) }))}
                          className="rounded-lg border border-indigo-200 bg-white px-3 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 transition"
                        >
                          Use P25–P75 range
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm(p => ({ ...p, salaryMin: String(benchmark.min), salaryMax: String(benchmark.p75) }))}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition"
                        >
                          Use Min–P75
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Salary information is used only by the AI to write better job descriptions. It is not shown publicly unless you paste the generated JD on a job board.
                </p>
              </div>
              <div>
                <FieldLabel>Application Deadline <span className="text-slate-400 normal-case font-medium">(optional)</span></FieldLabel>
                <Input type="date" value={form.applicationDeadline} onChange={update("applicationDeadline")} placeholder="" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-[17px] font-bold text-slate-900 mb-6">Review & Generate</h2>
               <PrivateJobVisibilitySection
                 isPublic={form.publicVisibility}
                 onSetPublic={() => setForm(prev => ({ ...prev, publicVisibility: true }))}
                 onSetPrivate={() => setForm(prev => ({ ...prev, publicVisibility: false }))}
               />
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Role", `${form.seniority} ${form.title}`],
                  ["Niche", form.niche],
                  ["Company", form.companyName || "—"],
                  ["Job Type", form.jobType],
                  ["Department", form.department || "—"],
                  ["Work Mode", form.workMode],
                  ["Location", form.location],
                  ["Salary", form.salaryMin && form.salaryMax ? `${form.salaryCurrency} ${Number(form.salaryMin).toLocaleString()} – ${Number(form.salaryMax).toLocaleString()}` : "Not disclosed"],
                  ["Openings", form.openings || "1"],
                  ["Application Deadline", form.applicationDeadline || "Not set"],
                  ["Language Requirement", form.languageRequirement || "Not specified"],
                  ["Perks & Benefits", form.perks || "Not specified"],
                  ...(form.workMode === "remote" ? [["Timezone Overlap", form.timezoneOverlap || "Not specified"]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{k}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{v}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Must-Have Skills</p>
                <p className="text-sm text-slate-700 leading-6">{form.mustHaveSkills}</p>
              </div>

              {(() => {
                const q = computeJobQuality({
                  salaryMin: form.salaryMin ? Number(form.salaryMin) : null,
                  salaryMax: form.salaryMax ? Number(form.salaryMax) : null,
                  verifiedCompany: form.verifiedCompany,
                  mustHaveSkills: form.mustHaveSkills,
                  workMode: form.workMode,
                  freshersAllowed: form.freshersAllowed,
                  experienceMin: form.experienceMin ? Number(form.experienceMin) : null,
                  companyName: form.companyName,
                });
                const pct = q.score;
                const ringColor = q.tier === "high" ? "#22c55e" : q.tier === "standard" ? "#6366f1" : "#94a3b8";
                return (
                  <div className="rounded-2xl bg-white border border-black/[0.06] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Listing quality preview</p>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                        <svg width="56" height="56" viewBox="0 0 56 56" className="absolute inset-0">
                          <circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" strokeWidth="5" />
                          <circle cx="28" cy="28" r="22" fill="none" stroke={ringColor} strokeWidth="5"
                            strokeDasharray={`${(pct / 100) * 138.2} 138.2`} strokeLinecap="round" transform="rotate(-90 28 28)" />
                        </svg>
                        <span className="text-sm font-black text-slate-900">{pct}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{q.label}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Based on what you've filled in so far</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {q.signals.filter(s => s.label !== "Full job description" && s.label !== "Verified company").map(s => (
                        <div key={s.label} className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold ${s.present ? "text-emerald-600" : "text-slate-300"}`}>{s.present ? "✓" : "–"}</span>
                          <span className={`text-[11px] font-medium ${s.present ? "text-slate-600" : "text-slate-400"}`}>{s.label}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-indigo-500">✦</span>
                        <span className="text-[11px] font-medium text-indigo-600">Full JD — AI will generate</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-300">✦</span>
                        <span className="text-[11px] font-medium text-slate-400">Verified company — by Rolebolt</span>
                      </div>
                    </div>
                    {q.tier !== "high" && (
                      <p className="mt-3 text-[11px] text-slate-400 font-medium">
                        {!form.salaryMin && !form.salaryMax && "Adding a salary range +20 pts · "}
                        {!form.mustHaveSkills.trim() && "Skills listed +15 pts · "}
                        {!form.companyName.trim() && "Company name +5 pts"}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="flex items-center gap-2 text-indigo-700 mb-2">
                  <SparkIcon />
                  <span className="text-xs font-bold">What the AI will generate</span>
                </div>
                <ul className="space-y-1 text-xs text-indigo-700/80 font-medium">
                  <li>✦ Full job description (400–600 words, bias-reduced)</li>
                  <li>✦ 4–6 criterion scoring rubric with descriptions</li>
                  <li>✦ Rubric automatically used to score every future candidate</li>
                </ul>
              </div>

              {error ? <StandardErrorNotice error={error} /> : null}
            </div>
          )}
        </div>

        {/* Block reason hint — shown only on steps with validation, when Continue would be disabled */}
        {step < STEPS.length - 1 && !canProceed() && getBlockReason() && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <svg className="mt-0.5 shrink-0" width="13" height="13" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p className="text-xs text-amber-700 font-medium leading-snug">{getBlockReason()}</p>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : router.push("/recruit/dashboard")}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition
              shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900"
          >
            {step === 0 ? "Cancel" : "Back"}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="rounded-xl bg-indigo-600 px-7 py-2.5 text-sm font-bold text-white transition
                shadow-[0_2px_8px_rgba(79,70,229,0.30)]
                hover:bg-indigo-700 hover:shadow-[0_4px_16px_rgba(79,70,229,0.40)] hover:-translate-y-px disabled:opacity-40 disabled:translate-y-0 disabled:cursor-not-allowed disabled:shadow-none"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-7 py-2.5 text-sm font-bold text-white transition
                shadow-[0_4px_16px_rgba(79,70,229,0.35)]
                hover:bg-indigo-700 hover:shadow-[0_6px_20px_rgba(79,70,229,0.45)] hover:-translate-y-px disabled:opacity-60 disabled:translate-y-0"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating JD...
                </>
              ) : (
                <><SparkIcon /> Generate Job Posting</>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

export default function NewJobPage() {
  return <RecruitGuard requiredRole="creator"><NewJobContent /></RecruitGuard>;
}
