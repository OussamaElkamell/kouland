import type { Config } from "tailwindcss";
import koulandPreset from "@kouland/ui/tailwind-preset";

const config: Config = {
  presets: [koulandPreset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
};

export default config;
