// app/lib/paletteLibrary.ts
export type BrandStyle =
  | "NOIR ICON"
  | "SAND LUXE"
  | "SAGE MODERN"
  | "ICE ROYAL";

export type BrandColor = {
  id: number;        // 1..48
  style: BrandStyle; // macro stile
  name: string;      // wow name
  hex: string;       // #RRGGBB
};

export const BRAND_COLORS: BrandColor[] = [
  // NOIR ICON (12)
  { id: 1,  style: "NOIR ICON", name: "Black Couture",    hex: "#0B0C0F" },
  { id: 2,  style: "NOIR ICON", name: "Midnight Navy",    hex: "#121B2D" },
  { id: 3,  style: "NOIR ICON", name: "Graphite Smoke",   hex: "#2A2D33" },
  { id: 4,  style: "NOIR ICON", name: "Charcoal Velvet",  hex: "#3A3D45" },
  { id: 5,  style: "NOIR ICON", name: "Stone Ash",        hex: "#6B6F77" },
  { id: 6,  style: "NOIR ICON", name: "Pearl White",      hex: "#F4F1EC" },
  { id: 7,  style: "NOIR ICON", name: "Bordeaux Secret",  hex: "#4A1F2B" },
  { id: 8,  style: "NOIR ICON", name: "Plum Night",       hex: "#3A2436" },
  { id: 9,  style: "NOIR ICON", name: "Espresso Ink",     hex: "#2A1C18" },
  { id: 10, style: "NOIR ICON", name: "Mocha Shadow",     hex: "#4A342C" },
  { id: 11, style: "NOIR ICON", name: "Olive Noir",       hex: "#1F2A22" },
  { id: 12, style: "NOIR ICON", name: "Steel Blue",       hex: "#2C3C52" },

  // SAND LUXE (12)
  { id: 13, style: "SAND LUXE", name: "Ivory Silk",       hex: "#EFE7DA" },
  { id: 14, style: "SAND LUXE", name: "Champagne Mist",   hex: "#E6D6C2" },
  { id: 15, style: "SAND LUXE", name: "Oat Cashmere",     hex: "#D8C7AE" },
  { id: 16, style: "SAND LUXE", name: "Sandstone",        hex: "#C9B296" },
  { id: 17, style: "SAND LUXE", name: "Caramel Nude",     hex: "#B68F6D" },
  { id: 18, style: "SAND LUXE", name: "Honey Tan",        hex: "#A77D59" },
  { id: 19, style: "SAND LUXE", name: "Terracotta Glow",  hex: "#B06B4F" },
  { id: 20, style: "SAND LUXE", name: "Cinnamon Clay",    hex: "#8F5A3F" },
  { id: 21, style: "SAND LUXE", name: "Rose Beige",       hex: "#C9A79A" },
  { id: 22, style: "SAND LUXE", name: "Blush Almond",     hex: "#D6B8A9" },
  { id: 23, style: "SAND LUXE", name: "Toffee Brown",     hex: "#6C4B39" },
  { id: 24, style: "SAND LUXE", name: "Cocoa Earth",      hex: "#3B2B23" },

  // SAGE MODERN (12)
  { id: 25, style: "SAGE MODERN", name: "Sage Whisper",   hex: "#A7B1A3" },
  { id: 26, style: "SAGE MODERN", name: "Eucalyptus",     hex: "#879686" },
  { id: 27, style: "SAGE MODERN", name: "Olive Leaf",     hex: "#6E7A5F" },
  { id: 28, style: "SAGE MODERN", name: "Moss Studio",    hex: "#4E5C4A" },
  { id: 29, style: "SAGE MODERN", name: "Forest Minimal", hex: "#2F3C33" },
  { id: 30, style: "SAGE MODERN", name: "Clay Stone",     hex: "#A99C8F" },
  { id: 31, style: "SAGE MODERN", name: "Warm Taupe",     hex: "#8B7D72" },
  { id: 32, style: "SAGE MODERN", name: "Linen Gray",     hex: "#CFC9C2" },
  { id: 33, style: "SAGE MODERN", name: "Milk Tea",       hex: "#BFAE9F" },
  { id: 34, style: "SAGE MODERN", name: "Cedar Brown",    hex: "#5E473B" },
  { id: 35, style: "SAGE MODERN", name: "Ocean Slate",    hex: "#4E6B73" },
  { id: 36, style: "SAGE MODERN", name: "Dusty Teal",     hex: "#3E6A66" },

  // ICE ROYAL (12)
  { id: 37, style: "ICE ROYAL", name: "Snow White",       hex: "#FAF8F4" },
  { id: 38, style: "ICE ROYAL", name: "Silver Mist",      hex: "#D9DDE2" },
  { id: 39, style: "ICE ROYAL", name: "Cloud Gray",       hex: "#B6BEC9" },
  { id: 40, style: "ICE ROYAL", name: "Blue Fog",         hex: "#8FA7C1" },
  { id: 41, style: "ICE ROYAL", name: "Royal Denim",      hex: "#2E4C7A" },
  { id: 42, style: "ICE ROYAL", name: "Deep Ocean",       hex: "#0E2A3A" },
  { id: 43, style: "ICE ROYAL", name: "Icy Lilac",        hex: "#B6A7C9" },
  { id: 44, style: "ICE ROYAL", name: "Lavender Smoke",   hex: "#84779A" },
  { id: 45, style: "ICE ROYAL", name: "Berry Ice",        hex: "#7A3E53" },
  { id: 46, style: "ICE ROYAL", name: "Cranberry Velvet", hex: "#5A2331" },
  { id: 47, style: "ICE ROYAL", name: "Cold Espresso",    hex: "#2B2323" },
  { id: 48, style: "ICE ROYAL", name: "Ink Blue",         hex: "#1B2B4A" },
];