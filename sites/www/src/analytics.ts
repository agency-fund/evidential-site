import { DEPLOY_ENV, GTM_ID } from "astro:env/client";

/** Google Tag Manager, and with it the consent banner and the footer's cookie settings button, is production-only. */
export const GTM_ENABLED = DEPLOY_ENV === "production" && GTM_ID !== "";
