/**
 * Ready-to-copy code for a platform's developers: how to sign and send events to the CRM's webhook. The secret is
 * read from an environment variable in every snippet, never written into the code.
 */
export function webhookSnippets(url: string) {
  const node = `// Node.js 18+: send a customer or an event to the Kouland CRM.
import crypto from "node:crypto";

const WEBHOOK_URL = "${url}";
const WEBHOOK_SECRET = process.env.KOULAND_WEBHOOK_SECRET;

export async function sendToKoulandCrm(event) {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(\`\${timestamp}.\${body}\`).digest("hex");
  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Kouland-Signature": \`t=\${timestamp},v1=\${signature}\` },
    body,
  });
  if (!response.ok) throw new Error(\`Kouland CRM: \${response.status} \${await response.text()}\`);
  return response.json(); // { received: true, status: "PROCESSED" | "DUPLICATE" | "FAILED", customerId }
}

// Example: a booking was confirmed on the platform.
await sendToKoulandCrm({
  id: "booking-812-confirmed", // unique per event: sending the same id again is applied once
  type: "event",
  customer: { externalId: "user_42", firstName: "Ann", lastName: "Lee", email: "ann@example.com", phone: "+19185550123" },
  event: { name: "booking.created", title: "Booking #812 confirmed", details: "2 nights, room 4", url: "https://example.com/bookings/812" },
});
`;

  const php = `<?php
// PHP 7.4+: send a customer or an event to the Kouland CRM.
function send_to_kouland_crm(array $event): array
{
    $url = '${url}';
    $secret = getenv('KOULAND_WEBHOOK_SECRET');
    $body = json_encode($event);
    $timestamp = time();
    $signature = hash_hmac('sha256', $timestamp . '.' . $body, $secret);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            "X-Kouland-Signature: t=$timestamp,v1=$signature",
        ],
    ]);
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($status >= 300) {
        throw new RuntimeException("Kouland CRM: $status $response");
    }
    return json_decode($response, true);
}

// Example: a new customer signed up on the platform.
send_to_kouland_crm([
    'id' => 'signup-user_42',
    'type' => 'customer.upsert',
    'customer' => ['externalId' => 'user_42', 'firstName' => 'Ann', 'lastName' => 'Lee', 'email' => 'ann@example.com'],
]);
`;

  const python = `# Python 3: send a customer or an event to the Kouland CRM.
import hashlib, hmac, json, os, time, urllib.request

WEBHOOK_URL = "${url}"

def send_to_kouland_crm(event: dict) -> dict:
    body = json.dumps(event).encode()
    timestamp = str(int(time.time()))
    secret = os.environ["KOULAND_WEBHOOK_SECRET"].encode()
    signature = hmac.new(secret, timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    request = urllib.request.Request(
        WEBHOOK_URL,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "X-Kouland-Signature": f"t={timestamp},v1={signature}"},
    )
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read())

# Example: an order was paid on the platform.
send_to_kouland_crm({
    "id": "order-5531-paid",
    "type": "event",
    "customer": {"externalId": "user_42", "email": "ann@example.com"},
    "event": {"name": "order.paid", "title": "Order #5531 paid: $49.00"},
})
`;

  const curl = `# Test the connection from a terminal (sends a "ping": it appears in the log, changes nothing).
export KOULAND_WEBHOOK_SECRET='paste the secret here'
BODY='{"id":"ping-'$(date +%s)'","type":"ping"}'
TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$KOULAND_WEBHOOK_SECRET" | sed 's/^.* //')
curl -X POST '${url}' \\
  -H 'Content-Type: application/json' \\
  -H "X-Kouland-Signature: t=$TS,v1=$SIG" \\
  -d "$BODY"
`;

  return [
    { id: "node", label: "Node.js", code: node },
    { id: "php", label: "PHP", code: php },
    { id: "python", label: "Python", code: python },
    { id: "curl", label: "curl", code: curl },
  ];
}

/** The three kinds of events, as JSON. */
export const PAYLOAD_EXAMPLES = `// Create the customer, or fill in what the CRM does not have yet
{
  "id": "signup-user_42",
  "type": "customer.upsert",
  "customer": {
    "externalId": "user_42",          // required: the customer's id on your platform
    "type": "INDIVIDUAL",             // or "COMPANY"
    "firstName": "Ann", "lastName": "Lee",
    "companyName": null, "name": null,
    "email": "ann@example.com",
    "phone": "+19185550123",
    "city": "Tulsa", "country": "United States"
  }
}

// Add something that happened to the customer to their history
{
  "id": "booking-812-confirmed",
  "type": "event",
  "customer": { "externalId": "user_42", "email": "ann@example.com" },
  "event": {
    "name": "booking.created",             // short machine name
    "title": "Booking #812 confirmed",     // what staff read
    "details": "2 nights, room 4",         // optional
    "url": "https://example.com/bookings/812", // optional
    "occurredAt": "2026-11-23T14:30:00Z"   // optional, ISO 8601
  }
}

// Check the connection (recorded in the log, changes nothing)
{ "id": "ping-1", "type": "ping" }`;
