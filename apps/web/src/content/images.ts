/**
 * Photos on the public website. All are from Unsplash under the Unsplash License (free for commercial use, no
 * attribution required) and are served from Unsplash's image CDN, as Unsplash recommends. To replace one, change
 * its photo id here.
 */
const UNSPLASH = {
  webDeveloper: "photo-1498050108023-c5249f4df085",
  technician: "photo-1721332154191-ba5f1534266e",
  truck: "photo-1618582948377-cd7eb0e8cb14",
  supportAgent: "photo-1626863905121-3b0c0ed7b94c",
  event: "photo-1540575467063-178a50c2df87",
  team: "photo-1551434678-e076c223a692",
  remoteAgent: "photo-1766066014237-00645c74e9c6",
  handshake: "photo-1521791136064-7986c2920216",
  itOffice: "photo-1504384308090-c894fdcc538d",
  phoneRepair: "photo-1550041473-d296a3a8a18a",
  smartLock: "photo-1558002038-1055907df827",
  tvWall: "photo-1633604712918-6ab1173d0ecd",
  router: "photo-1606904825846-647eb07f5be2",
} as const;

export type PhotoName = keyof typeof UNSPLASH;

/** A cropped photo URL. next/image then resizes it for each screen. */
export function photo(name: PhotoName, width: number, height: number): string {
  return `https://images.unsplash.com/${UNSPLASH[name]}?auto=format&fit=crop&w=${width}&h=${height}&q=75`;
}
