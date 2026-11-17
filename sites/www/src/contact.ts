/** Contact-form options and messages shared by the page (ContactCta.astro) and the Worker that validates them. */
export const STARTING_POINTS = [
  "Our data is ready",
  "Our data needs some work",
  "Interested in the Experimentation Advisory Service",
  "Not sure yet",
] as const;

export const FIELD_ERRORS = {
  name: "Enter your name.",
  email: "Enter a valid email.",
  organization: "Enter your organization.",
  startingPoint: "Choose where you're starting from.",
  message: "Message must be 5,000 characters or fewer.",
} as const;
