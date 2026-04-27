import {
  IconArrowUp,
  IconTarget,
  IconCrosshair,
  IconFlag,
  IconShield,
  IconBan,
  IconBeached,
  IconMissing,
  IconAlertTriangle,
} from "./icons";
import type { ActionKey } from "./types";

export const ACTIONS: Array<{
  key: ActionKey;
  label: string;
  Icon: typeof IconArrowUp;
  color: string;
}> = [
  { key: "driving", label: "Driving", Icon: IconArrowUp, color: "var(--accent)" },
  { key: "intaking", label: "Intaking", Icon: IconTarget, color: "var(--cyan)" },
  { key: "scoring", label: "Scoring", Icon: IconCrosshair, color: "var(--yellow)" },
  { key: "feeding", label: "Feeding", Icon: IconFlag, color: "var(--green)" },
  { key: "defense", label: "Defense", Icon: IconShield, color: "var(--red)" },
  { key: "blocked", label: "Blocked", Icon: IconBan, color: "var(--purple)" },
  { key: "beached", label: "Beached", Icon: IconBeached, color: "var(--orange)" },
  { key: "missing", label: "Missing", Icon: IconMissing, color: "var(--slate)" },
];

export const NOTABLE_REASONS = [
  ["failure", "Failure/reliability"],
  ["defense", "Strong defense"],
  ["feeding", "Strong feeding"],
  ["stealing", "Strong stealing"],
  ["driver", "Driver skill"],
  ["foul", "Fouls/cards"],
  ["auto", "Auto compatibility"],
  ["uncertainty", "Data uncertainty"],
  ["other", "Other"],
] as const;

export const INCAP_STATUSES = [
  ["rsl_off", "RSL off"],
  ["rsl_on", "RSL on"],
  ["rsl_unknown", "RSL unknown"],
  ["tipped", "Tipped"],
  ["stuck", "Stuck"],
  ["jammed", "Piece jammed"],
  ["mechanism", "Mechanism not moving"],
  ["unknown", "Unknown"],
] as const;

export const FLAG_ICON = IconAlertTriangle;
