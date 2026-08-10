/** Keep in sync with frontend/src/products/sitegen/config/reserved-usernames.ts */

export const SITEGEN_USERNAME_MIN = 3;
export const SITEGEN_USERNAME_MAX = 30;
export const SITEGEN_USERNAME_PATTERN = /^[a-z][a-z0-9_]*$/;

export const SITEGEN_RESERVED_USERNAMES = new Set([
  "admin", "administrator", "api", "auth", "help", "login", "logout", "me",
  "profile", "root", "signup", "support", "system", "www", "null", "undefined",
  "rolebolt", "recruit", "recruiter", "seeker", "creator", "reviews", "resources",
  "website", "about", "blog", "careers", "contact", "privacy", "terms", "billing",
  "f", "backend", "status", "offline", "refund", "manage", "login",
  "start", "username", "build", "preview", "publish", "dashboard", "edit",
]);
