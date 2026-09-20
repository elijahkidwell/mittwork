import { env } from "@/lib/env.server";
import { placeLabel, placeLabelForTrainer } from "@/lib/locations";
import { formatMoney, formatWhen } from "@/lib/utils";

type Mail = { to: string; subject: string; html: string; text: string };

function resendKey() {
  return env("RESEND_API_KEY") || "";
}

function mailFrom() {
  return env("MAIL_FROM") || "Mittwork <bookings@mitt-work.online>";
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

async function deliver(mail: Mail) {
  const to = mail.to.trim();
  if (!to || !to.includes("@")) return false;
  const from = mailFrom();
  const key = resendKey();
  const sendgrid = env("SENDGRID_API_KEY");
  try {
    if (key) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("resend", res.status, body);
        return false;
      }
      return true;
    }
    if (sendgrid) {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendgrid}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from.match(/<([^>]+)>/)?.[1] || "onboarding@resend.dev", name: "Mittwork" },
          subject: mail.subject,
          content: [
            { type: "text/plain", value: mail.text },
            { type: "text/html", value: mail.html },
          ],
        }),
      });
      return res.ok;
    }
  } catch (err) {
    console.error("mail", err);
  }
  console.info(`[mail] ${mail.subject} -> ${to}`);
  return false;
}

function wrap(inner: string) {
  return `<!doctype html>
<html><body style="margin:0;background:#0b0b0c;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:28px 20px">
    <p style="letter-spacing:.28em;font-size:12px;color:#e11d2e;font-weight:700;margin:0 0 18px">MITTWORK</p>
    ${inner}
    <p style="margin-top:28px;font-size:12px;color:#8a8a8a">Questions? Open the Bookings tab in Mittwork.</p>
  </div>
</body></html>`;
}

export type BookingMailInput = {
  serviceName: string;
  startAt: string;
  durationMin: number;
  amountCents: number;
  locationType: string | null;
  locationNote: string | null;
  gymName: string;
  notes: string | null;
  clientName: string;
  clientEmail: string | null;
  trainerName: string;
  trainerEmail: string | null;
};

export async function sendBookingEmails(b: BookingMailInput) {
  const when = formatWhen(b.startAt);
  const placeClient = [placeLabel(b.locationType || "trainer_gym"), b.locationNote, b.gymName]
    .filter(Boolean)
    .join(" · ");
  const placeTrainer = [
    placeLabelForTrainer(b.locationType || "trainer_gym"),
    b.locationNote,
    b.gymName,
  ]
    .filter(Boolean)
    .join(" · ");
  const money = formatMoney(b.amountCents);
  const trainer = escapeHtml(b.trainerName);
  const client = escapeHtml(b.clientName);
  const service = escapeHtml(b.serviceName);
  const placeC = escapeHtml(placeClient);
  const placeT = escapeHtml(placeTrainer);
  const note = b.notes ? escapeHtml(b.notes) : "";
  const details = (place: string) =>
    `${service} · ${b.durationMin} min<br/>${escapeHtml(when)}<br/>${place}<br/>${money}`;

  const jobs: Promise<boolean>[] = [];
  if (b.clientEmail) {
    jobs.push(
      deliver({
        to: b.clientEmail,
        subject: `Confirmed: ${b.serviceName} with ${b.trainerName}`,
        text: `You're booked with ${b.trainerName}.\n${b.serviceName} (${b.durationMin} min)\n${when}\n${placeClient}\n${money}`,
        html: wrap(
          `<h1 style="font-size:22px;margin:0 0 8px">You're booked</h1>
           <p style="color:#cfcfcf;margin:0 0 16px">Session with <strong>${trainer}</strong></p>
           <div style="background:#161618;border-radius:12px;padding:16px;line-height:1.55">${details(placeC)}</div>`,
        ),
      }),
    );
  }
  if (b.trainerEmail) {
    jobs.push(
      deliver({
        to: b.trainerEmail,
        subject: `New session: ${b.clientName} booked ${b.serviceName}`,
        text: `${b.clientName} booked you.\n${b.serviceName} (${b.durationMin} min)\n${when}\n${placeTrainer}\n${money}${b.notes ? `\nNote: ${b.notes}` : ""}`,
        html: wrap(
          `<h1 style="font-size:22px;margin:0 0 8px">New booking</h1>
           <p style="color:#cfcfcf;margin:0 0 16px"><strong>${client}</strong> booked a session</p>
           <div style="background:#161618;border-radius:12px;padding:16px;line-height:1.55">${details(placeT)}${note ? `<br/>Note: ${note}` : ""}</div>`,
        ),
      }),
    );
  }
  await Promise.allSettled(jobs);
}
