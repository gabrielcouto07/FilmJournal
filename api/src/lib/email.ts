import { Resend } from "resend";

// Sender address. Resend allows "onboarding@resend.dev" for testing without a
// verified domain; in production verify a domain and set EMAIL_FROM.
const FROM = process.env.EMAIL_FROM ?? "FilmJournal <onboarding@resend.dev>";

/** Sends an email via Resend. Throws a clear error when the service isn't configured. */
export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Envio de e-mail não configurado. Defina RESEND_API_KEY no ambiente.");
  }
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from: FROM, to, subject, html, text: text ?? html.replace(/<[^>]+>/g, " ") });
  if (error) {
    throw new Error(`Não foi possível enviar o e-mail: ${error.message ?? "erro desconhecido"}`);
  }
}

/** Email containing the confirmation code for a password change. */
export async function sendPasswordCodeEmail(to: string, code: string, name: string): Promise<void> {
  const subject = "Seu código para alterar a senha · FilmJournal";
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
      <p style="font-size:14px;color:#555">Olá, ${escapeHtml(name)}.</p>
      <p style="font-size:15px;line-height:1.6">Recebemos um pedido para alterar a senha da sua conta no <strong>FilmJournal</strong>. Use o código abaixo para confirmar:</p>
      <p style="font-size:34px;font-weight:800;letter-spacing:8px;text-align:center;margin:28px 0;color:#111">${code}</p>
      <p style="font-size:13px;color:#777;line-height:1.6">O código expira em 10 minutos. Se você não pediu essa alteração, ignore este e-mail — sua senha atual continua válida.</p>
    </div>`;
  const text = `Olá, ${name}. Seu código para alterar a senha no FilmJournal é: ${code}. Ele expira em 10 minutos. Se você não fez este pedido, ignore este e-mail.`;
  await sendEmail({ to, subject, html, text });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] as string));
}
