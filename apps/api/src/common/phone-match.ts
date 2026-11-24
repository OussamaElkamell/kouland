import type { PrismaService } from "../prisma/prisma.service";

/**
 * The last 9 digits of a number: enough to tell numbers apart, while matching "+1 918 555 0123", "(918) 555-0123"
 * and "9185550123" as the same phone (customers' numbers are typed freely in the CRM).
 */
export function phoneKey(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-9) : null;
}

/**
 * The customer with this phone number (on the customer or one of its contacts), most recently updated first, or
 * null. Used to recognise callers and SMS senders, and by platform sync.
 */
export async function findCustomerByPhone(prisma: PrismaService, phone: string | null | undefined): Promise<{ id: string; displayName: string } | null> {
  const key = phoneKey(phone);
  if (!key) return null;
  const rows = await prisma.$queryRaw<Array<{ id: string; displayName: string }>>`
    SELECT c.id, c."displayName"
    FROM customers c
    WHERE right(regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g'), 9) = ${key}
       OR EXISTS (
         SELECT 1 FROM contacts k
         WHERE k."customerId" = c.id AND right(regexp_replace(coalesce(k.phone, ''), '\\D', '', 'g'), 9) = ${key}
       )
    ORDER BY c."updatedAt" DESC
    LIMIT 1`;
  return rows[0] ?? null;
}
