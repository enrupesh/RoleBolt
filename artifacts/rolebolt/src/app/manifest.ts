import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rolebolt | AI Hiring & Job Search",
    short_name: "Rolebolt",
    description: "An AI-powered workspace for hiring teams and job seekers.",
    start_url: "/recruit",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f8fbfd",
    theme_color: "#0a66c2",
    categories: ["business", "productivity", "jobs"],
    icons: [
      {
        src: "/rolebolt-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/rolebolt-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}