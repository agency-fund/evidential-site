import bulb from "./bulb.svg";
import database from "./database.svg";
import flask from "./flask.svg";
import pulse from "./pulse.svg";
import shuffle from "./shuffle.svg";
import barChart from "./bar-chart.svg";
import heart from "./heart.svg";
import lock from "./lock.svg";
import refresh from "./refresh.svg";

/** Icons that content files (src/content/*.yaml) may reference by name. */
export const icons = {
  "bar-chart": barChart,
  bulb,
  database,
  flask,
  heart,
  lock,
  pulse,
  refresh,
  shuffle,
};

export type IconName = keyof typeof icons;
export const iconNames = Object.keys(icons) as [IconName, ...IconName[]];
