import {
  AirplaneTiltIcon,
  CurrencyDollarIcon,
  GraduationCapIcon,
  HandshakeIcon,
  HouseLineIcon,
  MedalIcon,
  MoonStarsIcon,
  ShieldCheckIcon,
  SparkleIcon,
  TrendUpIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

const ICONS: Record<string, Icon> = {
  pay: CurrencyDollarIcon,
  growth: TrendUpIcon,
  flexibility: HouseLineIcon,
  recognition: MedalIcon,
  manager: HandshakeIcon,
  less_overtime: MoonStarsIcon,
  learning: GraduationCapIcon,
  less_travel: AirplaneTiltIcon,
  security: ShieldCheckIcon,
};

/** A small glyph for each "what would keep you here" option. */
export function KeepIcon({ k, size = 18, className }: { k: string; size?: number; className?: string }) {
  const I = ICONS[k] ?? SparkleIcon;
  return <I size={size} className={className} aria-hidden />;
}
