import Image from "next/image";

/**
 * Parent-company logo: the official Kouland Technology logo, exactly as on koulandtechnology.com (house icon,
 * "KOULAND" and "Technology, Inc"), from public/brand/kouland-technology-logo.png (828×261, transparent).
 */
export function CompanyLogo() {
  return (
    <Image
      src="/brand/kouland-technology-logo.png"
      alt="Kouland Technology, Inc."
      width={828}
      height={261}
      className="h-10 w-auto flex-none"
      priority
    />
  );
}
