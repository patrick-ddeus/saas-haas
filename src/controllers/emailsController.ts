import { Request, Response } from 'express';
import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const emailsController = {
  async sendEmail(req: Request, res: Response) {
    try {
      if (!resend) {
        return res.status(500).json({ message: 'Resend não configurado. Defina RESEND_API_KEY no .env' });
      }

      const {
        from,
        to,
        cc,
        bcc,
        subject,
        html,
        reply_to,
        attachments,
      } = req.body;

      if (!from || !to || !subject || !html) {
        return res.status(400).json({ message: 'Campos obrigatórios ausentes: from, to, subject, html' });
      }

      const normalizedTo = Array.isArray(to) ? to : [ to ];

      const normalizedAttachments = Array.isArray(attachments)
        ? attachments.map((a: any) => ({
          filename: a.filename,
          // Conteúdo esperado em base64 do cliente
          content: Buffer.from(a.content, 'base64'),
        }))
        : undefined;

      const domain = await resend.domains.get('4ac25cba-cb32-4c8b-822e-28e77cec5768');
      console.log(domain)

      const result = await resend.emails.send({
        from,
        to: normalizedTo,
        cc,
        bcc,
        subject,
        html,
        replyTo: reply_to,
        attachments: normalizedAttachments,
      });
      console.log("🚀 ~ result:", result)

      return res.json({ ok: true, id: result?.data?.id });
    } catch (error: any) {
      console.error('Erro ao enviar email via Resend:', error);
      return res.status(500).json({
        message: error?.message || 'Falha ao enviar email',
      });
    }
  },
};