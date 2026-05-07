import {
  Apple,
  Carrot,
  Wheat,
  Milk,
  Beef,
  Fish,
  GlassWater,
  CupSoda,
  Coffee,
  Wine,
  Beer,
  Cookie,
  Candy,
  Cake,
  IceCream,
  Egg,
  Salad,
  Sandwich,
  Croissant,
  Soup,
  Pizza,
  Baby,
  Heart,
  Dumbbell,
  Sparkles,
  Flower2,
  SprayCan,
  Bath,
  Brush,
  Cigarette,
  Pill,
  Stethoscope,
  Shirt,
  PawPrint,
  Leaf,
  Sprout,
  Tag,
  Gift,
  Package,
  Boxes,
  Box,
  Coins,
  BookOpen,
  Pencil,
  Lightbulb,
  Wrench,
  Smartphone,
  Headphones,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

type Rule = { test: RegExp; icon: LucideIcon };

const RULES: Rule[] = [
  { test: /fruta|fruit|peme|moll|apple/i, icon: Apple },
  { test: /perim|veg|sallat|karot|carrot/i, icon: Carrot },
  { test: /buke|bread|brume|drith|grure|wheat|miell/i, icon: Wheat },
  { test: /qumesh|milk|bulmet|dairy/i, icon: Milk },
  { test: /djath|cheese|kos|gjize/i, icon: Milk },
  { test: /vez|egg/i, icon: Egg },
  { test: /mish|meat|salam|sallam|proshut|ham/i, icon: Beef },
  { test: /peshk|fish|sardel/i, icon: Fish },
  { test: /uje|water/i, icon: GlassWater },
  { test: /pije|drink|leng|juice|sode|soda/i, icon: CupSoda },
  { test: /kafe|coffee|cay|tea/i, icon: Coffee },
  { test: /vere|wine/i, icon: Wine },
  { test: /birr|beer|ale/i, icon: Beer },
  { test: /biskot|cookie|wafer/i, icon: Cookie },
  { test: /cokollat|chocolate|embel|sweet|candy|karamel/i, icon: Candy },
  { test: /tort|cake|pastic/i, icon: Cake },
  { test: /akull|gelato|ice.?cream/i, icon: IceCream },
  { test: /sallat|salad/i, icon: Salad },
  { test: /sandwich|panin/i, icon: Sandwich },
  { test: /kroas|croissant/i, icon: Croissant },
  { test: /sup|soup|corb/i, icon: Soup },
  { test: /pic|pizza/i, icon: Pizza },
  { test: /femij|baby|kid|foshnj/i, icon: Baby },
  { test: /shendet|health/i, icon: Heart },
  { test: /sport|fitness|gym/i, icon: Dumbbell },
  { test: /bukur|beauty|cosmetic|kozmetik/i, icon: Sparkles },
  { test: /lule|flower/i, icon: Flower2 },
  { test: /pastr|clean|detergj|sapun|soap/i, icon: SprayCan },
  { test: /banj|bath|dush|shower/i, icon: Bath },
  { test: /furc|brush/i, icon: Brush },
  { test: /cigar|duhan|tobacco/i, icon: Cigarette },
  { test: /ilac|pill|vitamin|medic/i, icon: Pill },
  { test: /klinik|farmaci|pharma|stetosk/i, icon: Stethoscope },
  { test: /vesh|shirt|kemish|fanell|bluz/i, icon: Shirt },
  { test: /kafsh|pet|qen|mac|dog|cat|paw/i, icon: PawPrint },
  { test: /bio|organic|natyr/i, icon: Leaf },
  { test: /bime|plant|fidan|sprout/i, icon: Sprout },
  { test: /oferta|zbritj|sale|reduktim/i, icon: Tag },
  { test: /dhurat|gift/i, icon: Gift },
  { test: /shtepi|home|familj/i, icon: Lightbulb },
  { test: /vegla|tools|wrench|cekan/i, icon: Wrench },
  { test: /telefon|phone|mobile/i, icon: Smartphone },
  { test: /kufje|headphone|audio|muzik|music/i, icon: Headphones },
  { test: /libr|book|liber/i, icon: BookOpen },
  { test: /shkrimi|pencil|stilolaps/i, icon: Pencil },
  { test: /banak|kuzhin|kitchen|takem|posac|posaq/i, icon: Utensils },
  { test: /abonim|subscri|paket|abon/i, icon: Boxes },
  { test: /artikull|article|produkt|product/i, icon: Package },
  { test: /pagese|monet|coin|kart/i, icon: Coins },
];

const FALLBACK_POOL: LucideIcon[] = [
  Package,
  Box,
  Boxes,
  Tag,
  Gift,
  Coins,
  Sparkles,
  Leaf,
  Sprout,
  Heart,
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getCategoryIcon(name: string): LucideIcon {
  const n = name || '';
  for (const rule of RULES) {
    if (rule.test.test(n)) return rule.icon;
  }
  return FALLBACK_POOL[hashString(n.toLowerCase()) % FALLBACK_POOL.length];
}

export function CategoryIcon({
  name,
  size = 28,
  className,
  color,
  strokeWidth = 1.75,
}: {
  name: string;
  size?: number;
  className?: string;
  color?: string;
  strokeWidth?: number;
}) {
  const Icon = getCategoryIcon(name);
  return <Icon size={size} className={className} color={color} strokeWidth={strokeWidth} />;
}
