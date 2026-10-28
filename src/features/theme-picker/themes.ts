export const THEME_MODES = ["light", "dark"] as const;

export type ThemeMode = typeof THEME_MODES[number];

export interface Palette {
	background: string;
	zone: string;
	border: string;
}

export interface ThemeDesign {
	id: string;
	name: string;
	light: Palette;
	dark: Palette;
}

// Keep the default first because unknown or missing saved IDs fall back to this entry.
export const THEME_DESIGNS: readonly ThemeDesign[] = [
	{
		id: "parchment",
		name: "Parchment",
		light: { background: "#f4f1ea", zone: "#fbfaf5", border: "#e0ded6" },
		dark: { background: "#16150f", zone: "#1f1d16", border: "#2d2d2d" },
	},
	{
		id: "sage",
		name: "Sage",
		light: { background: "#e3ebdd", zone: "#f2f7ef", border: "#cfd9c9" },
		dark: { background: "#14160f", zone: "#1c1f16", border: "#2d2d2d" },
	},
	{
		id: "tide",
		name: "Tide",
		light: { background: "#ddeaf5", zone: "#f0f6fc", border: "#c8d7e5" },
		dark: { background: "#0f1613", zone: "#161f1c", border: "#2d2d2d" },
	},
	{
		id: "slate",
		name: "Slate",
		light: { background: "#e4e3ed", zone: "#f3f2f8", border: "#d1cfde" },
		dark: { background: "#140f16", zone: "#1c161f", border: "#2d2d2d" },
	},
];
