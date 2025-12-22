// mailer.mjs
import dotenv from "dotenv";
dotenv.config();

const API_URL = "https://api.brevo.com/v3/smtp/email";
const API_KEY = process.env.BREVO_API_KEY;

export const sendOtpBrevo = async (sender, to, otp) => {
  const emailData = {
    sender: { name: sender, email: process.env.EMAIL_USER },
    to: { email: to },
    subject: `Your OTP Code`,
    htmlContent: `Your OTP code is ${otp}. It is valid for 5 minutes.`,
    headers: { "X-Custom-ID": `Otp-${Date.now()}` },
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": API_KEY,
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(" Error sending email via Brevo:", errorData);
      return true;
    }

    const result = await response.json();
    console.log("Confirmation email sent successfully!");
    console.log(result);
  } catch (err) {
    return false;
    console.error(" Request failed:", err);
  }
};
