/** Site-wide links and copy shared by the header, footer, and metadata. */
export const SITE = {
  name: "Evidential",
  title: "Evidential | Free, open-source experiment engine for nonprofits",
  description:
    "Evidential is a free, open-source experiment engine built by and for nonprofits. Run experiments on your programs, learn what works, and make them better.",
  tagline: "A free, open-source experiment engine built by and for nonprofits.",
  appUrl: "https://app.evidential.dev",
  docsUrl: "https://docs.evidential.dev",
  githubUrl: "https://github.com/agency-fund/evidential-be",
  demoVideoUrl: "https://www.youtube.com/watch?v=bB1Wdv071SE",
  supportEmail: "support@evidential.dev",
  idinsightUrl: "https://www.idinsight.org",
  agencyFundUrl: "https://www.agency.fund/",
} as const;

export const NAV_LINKS = [
  { label: "Why Evidential", href: "#why" },
  { label: "Experiments", href: "#partner-tests" },
  { label: "How it works", href: "#how" },
  { label: "Docs", href: SITE.docsUrl, external: true },
  { label: "Contact", href: "#cta" },
] as const;
