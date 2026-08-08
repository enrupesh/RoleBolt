/**
 * Reserved usernames for Sitegen published sites at www.rolebolt.tech/{username}.
 * Must include all Rolebolt static routes and system words.
 * Keep in sync with backend validation in later phases.
 */

export const SITEGEN_USERNAME_MIN = 3;
export const SITEGEN_USERNAME_MAX = 30;
export const SITEGEN_USERNAME_PATTERN = /^[a-z][a-z0-9_]*$/;

export const SITEGEN_RESERVED_USERNAMES = new Set([
  // System
  "admin", "administrator", "api", "auth", "help", "login", "logout", "me",
  "profile", "root", "signup", "support", "system", "www", "null", "undefined",
  // Rolebolt product routes
  "rolebolt", "recruit", "recruiter", "seeker", "creator", "reviews", "resources",
  "website", "about", "blog", "careers", "contact", "privacy", "terms", "billing",
  "f", "backend", "status", "offline", "refund", "manage", "login",
  // Sitegen product routes (block usernames that collide with app paths)
  "start", "username", "build", "preview", "publish", "dashboard", "edit",
]);
