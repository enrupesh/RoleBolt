import type { SitegenCreatorStructuredContent, SitegenSeekerStructuredContent } from "../types/structuredContent";

const allSeekerSections = {
  about: true,
  skills: true,
  experience: true,
  education: true,
  projects: true,
  certifications: true,
  achievements: true,
  contact: true,
};

const allCreatorSections = {
  about: true,
  services: true,
  portfolio: true,
  team: true,
  contact: true,
};

export const aaravSharmaSeeker: SitegenSeekerStructuredContent = {
  type: "seeker",
  name: "Aarav Sharma",
  headline: "Senior Product Manager · B2B SaaS · Growth",
  about: "Product leader with 8+ years building and scaling B2B SaaS platforms across fintech and HR tech. Known for turning customer insight into roadmap clarity, cross-functional execution, and measurable business outcomes.",
  photoUrl: null,
  skills: ["Product Strategy", "Roadmapping", "User Research", "SQL", "A/B Testing", "Agile", "Stakeholder Management", "Go-to-Market"],
  experience: [
    {
      title: "Senior Product Manager",
      company: "PaySphere Technologies",
      startDate: "2021",
      endDate: null,
      current: true,
      bullets: [
        "Led a payments onboarding redesign that increased activation by 24% across enterprise accounts.",
        "Partnered with design and engineering to launch a self-serve analytics suite used by 300+ customers.",
        "Defined quarterly OKRs and managed a roadmap spanning 3 product squads.",
      ],
    },
    {
      title: "Product Manager",
      company: "TalentBridge HR",
      startDate: "2018",
      endDate: "2021",
      current: false,
      bullets: [
        "Shipped applicant tracking improvements that reduced recruiter time-to-hire by 18%.",
        "Introduced customer discovery rituals adopted across the product organization.",
      ],
    },
  ],
  education: [
    {
      school: "Indian Institute of Management Bangalore",
      degree: "MBA",
      field: "Strategy & Marketing",
      startDate: "2016",
      endDate: "2018",
      description: null,
    },
    {
      school: "Delhi Technological University",
      degree: "B.Tech",
      field: "Information Technology",
      startDate: "2012",
      endDate: "2016",
      description: null,
    },
  ],
  projects: [
    {
      name: "Customer Health Dashboard",
      description: "Built an internal product analytics dashboard used by customer success and product teams.",
      url: "https://example.com/customer-health",
    },
    {
      name: "Pricing Experiment Toolkit",
      description: "Designed and tested packaging changes for mid-market SaaS plans.",
      url: null,
    },
  ],
  certifications: ["Pragmatic Institute Product Management", "Google Analytics Certification"],
  achievements: ["Speaker at Product Leadership Summit 2024", "Led launch recognized in company annual awards"],
  contact: {
    email: "aarav.sharma@email.com",
    phone: "+91 98XXX XXXXX",
    location: "Bengaluru, India",
    website: null,
    linkedin: "https://linkedin.com/in/aaravsharma",
    github: null,
    portfolio: null,
  },
  sections: allSeekerSections,
};

export const minimalSeeker: SitegenSeekerStructuredContent = {
  type: "seeker",
  name: "Mina Park",
  headline: "Junior Data Analyst",
  about: null,
  photoUrl: null,
  skills: ["Excel", "SQL"],
  experience: [],
  education: [],
  projects: [],
  certifications: [],
  achievements: [],
  contact: {
    email: "mina@email.com",
    phone: null,
    location: "Seoul",
    website: null,
    linkedin: null,
    github: null,
    portfolio: null,
  },
  sections: {
    about: false,
    skills: true,
    experience: false,
    education: false,
    projects: false,
    certifications: false,
    achievements: false,
    contact: true,
  },
};

export const detailedSeeker: SitegenSeekerStructuredContent = {
  ...aaravSharmaSeeker,
  name: "Jordan Lee",
  headline: "Staff Software Engineer · Platform & Infrastructure",
  skills: [...aaravSharmaSeeker.skills, "Kubernetes", "Terraform", "Go", "PostgreSQL", "Redis"],
};

export const soloCreator: SitegenCreatorStructuredContent = {
  type: "creator",
  businessName: "Lens & Light Studio",
  tagline: "Portrait and brand photography for founders and creative teams.",
  about: "I help individuals and small brands tell sharper visual stories through thoughtful portrait sessions and brand imagery.",
  category: "Photography",
  logoUrl: null,
  services: ["Portrait Sessions", "Brand Photography", "Photo Retouching"],
  location: "Austin, TX",
  contact: {
    email: "hello@lenslight.studio",
    phone: null,
    website: "https://lenslight.studio",
  },
  socialLinks: {
    linkedin: null,
    instagram: "https://instagram.com/lenslight",
    twitter: null,
    youtube: null,
    tiktok: null,
  },
  portfolio: [
    { title: "Founder Portraits", url: "https://example.com/founders", description: "Executive portrait series for startup founders." },
  ],
  team: [],
  sections: {
    about: true,
    services: true,
    portfolio: true,
    team: false,
    contact: true,
  },
};

export const smallBusiness: SitegenCreatorStructuredContent = {
  type: "creator",
  businessName: "Northline Consulting",
  tagline: "Operations and finance systems for growing service businesses.",
  about: "Northline helps founder-led companies implement practical finance workflows, reporting, and operating cadences.",
  category: "Consulting",
  logoUrl: null,
  services: ["Financial Operations", "Reporting Setup", "Process Design"],
  location: "Chicago, IL",
  contact: {
    email: "team@northline.co",
    phone: "+1 (312) 555-0142",
    website: "https://northline.co",
  },
  socialLinks: {
    linkedin: "https://linkedin.com/company/northline",
    instagram: null,
    twitter: null,
    youtube: null,
    tiktok: null,
  },
  portfolio: [],
  team: [],
  sections: {
    about: true,
    services: true,
    portfolio: false,
    team: false,
    contact: true,
  },
};

export const fullBusiness: SitegenCreatorStructuredContent = {
  type: "creator",
  businessName: "Atlas Digital Studio",
  tagline: "Design, development, and growth for ambitious brands.",
  about: "Atlas is a multidisciplinary studio partnering with startups and established companies to launch polished digital products and campaigns.",
  category: "Digital Agency",
  logoUrl: null,
  services: ["Brand Identity", "Web Design", "Web Development", "SEO", "Content Strategy"],
  location: "San Francisco, CA",
  contact: {
    email: "hello@atlasdigital.studio",
    phone: "+1 (415) 555-0199",
    website: "https://atlasdigital.studio",
  },
  socialLinks: {
    linkedin: "https://linkedin.com/company/atlasdigital",
    instagram: "https://instagram.com/atlasdigital",
    twitter: "https://twitter.com/atlasdigital",
    youtube: null,
    tiktok: null,
  },
  portfolio: [
    { title: "Fintech onboarding platform", url: "https://example.com/fintech", description: "End-to-end product design and marketing site." },
    { title: "Healthcare provider portal", url: "https://example.com/health", description: "Patient scheduling and provider dashboard." },
    { title: "D2C launch campaign", url: "https://example.com/d2c", description: "Brand, ecommerce, and launch strategy." },
  ],
  team: [
    { name: "Sofia Alvarez", role: "Creative Director", bio: "Leads brand and visual direction across client engagements." },
    { name: "Marcus Chen", role: "Engineering Lead", bio: "Owns technical architecture and delivery quality." },
    { name: "Priya Nair", role: "Growth Strategist", bio: "Designs acquisition and retention programs for launches." },
  ],
  sections: allCreatorSections,
};

export const THEME_FIXTURES = {
  aaravSharmaSeeker,
  minimalSeeker,
  detailedSeeker,
  soloCreator,
  smallBusiness,
  fullBusiness,
} as const;
