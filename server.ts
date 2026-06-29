import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API routes
  app.post("/api/send-reminder-email", async (req, res) => {
    try {
      const { email, message, aiFriendName } = req.body;
      
      if (!email || !message) {
        return res.status(400).json({ error: "Email and message are required" });
      }

      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        console.warn("RESEND_API_KEY is not set. Skipping email send.");
        return res.status(200).json({ success: true, warning: "RESEND_API_KEY not set" });
      }

      const resend = new Resend(resendApiKey);
      const senderName = aiFriendName || "Your AI Friend";

      const { data, error } = await resend.emails.send({
        from: `${senderName} <onboarding@resend.dev>`,
        to: email,
        subject: `Reminder from ${senderName} 🔔`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
            <h2 style="color: #333;">Hello!</h2>
            <p style="font-size: 16px; color: #555;">You have a new reminder from <strong>${senderName}</strong>:</p>
            <div style="background-color: #fff; padding: 15px; border-left: 4px solid #4f46e5; border-radius: 4px; margin: 20px 0;">
              <p style="font-size: 18px; margin: 0; color: #222;">${message}</p>
            </div>
            <p style="font-size: 14px; color: #888;">Sent from your Motivator Diary App</p>
          </div>
        `,
      });

      if (error) {
        console.error("Resend API Error:", error);
        return res.status(500).json({ error: error.message });
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error("Failed to send email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
