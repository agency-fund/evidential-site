/**
 * MDX globals registry — components available inside MDX without `import`.
 * Wired via `<Content components={components} />` in `[...slug].astro`.
 * Add new components here as you build (or install) them.
 */

import { Accordion, AccordionContent, AccordionTrigger } from "./components/ui/accordion";
import { Aside } from "./components/ui/aside";
import { Card } from "./components/ui/card";
import { CardGrid } from "./components/ui/card-grid";
import { PackageManagers } from "./components/ui/package-managers";
import { Step, Steps } from "./components/ui/steps";
import { Tabs, TabItem } from "./components/ui/tabs";

export const components = {
  Accordion,
  AccordionContent,
  AccordionTrigger,
  Aside,
  Card,
  CardGrid,
  PackageManagers,
  Step,
  Steps,
  TabItem,
  Tabs,
};
