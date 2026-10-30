import {
  Armchair,
  BookOpen,
  Footprints,
  Gift,
  PenLine,
  Puzzle,
  Shirt,
  ShoppingBasket,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import type { DonationCategory } from '@/lib/types';

export const CATEGORY_ICONS: Record<DonationCategory, LucideIcon> = {
  food: Utensils,
  clothes: Shirt,
  books: BookOpen,
  toys: Puzzle,
  stationery: PenLine,
  groceries: ShoppingBasket,
  footwear: Footprints,
  household: Armchair,
  others: Gift,
};
