import { ENV } from "../config/env.js";

const CONTACTS_URL = "https://api.resend.com/contacts";
const TIMEOUT_MS = 5000;

type NewContact = { email: string; firstName: string | null; lastName: string | null };

function request(path: string, method: string, body?: object) {
  return fetch(`${CONTACTS_URL}${path}`, {
    method,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${ENV.RESEND_CONTACTS_API_KEY}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const contactPath = (email: string) => `/${encodeURIComponent(email)}`;

// Errors carry the status only, so addresses stay out of the logs.
function failure(action: string, status: number) {
  return new Error(`Resend contact ${action} responded ${status}`);
}

/**
 * Adds a contact to the mailing list segment if it isn't there yet. An existing
 * contact is left alone so an unsubscribe can never be undone.
 */
export async function addContact({ email, firstName, lastName }: NewContact): Promise<void> {
  if (!ENV.RESEND_CONTACTS_API_KEY || !ENV.RESEND_SEGMENT_ID) return;

  const existing = await request(contactPath(email), "GET");
  if (existing.ok) return;
  if (existing.status !== 404) throw failure("lookup", existing.status);

  const created = await request("", "POST", {
    email,
    ...(firstName ? { first_name: firstName } : {}),
    ...(lastName ? { last_name: lastName } : {}),
    segments: [{ id: ENV.RESEND_SEGMENT_ID }],
  });
  if (!created.ok) throw failure("create", created.status);
}

export async function removeContact(email: string): Promise<void> {
  if (!ENV.RESEND_CONTACTS_API_KEY) return;

  const res = await request(contactPath(email), "DELETE");
  if (!res.ok && res.status !== 404) throw failure("delete", res.status);
}
