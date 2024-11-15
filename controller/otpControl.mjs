import nodemailer from "nodemailer";
import crypto from "crypto";
import dotenv from "dotenv";
import axios from "axios";
import NodeCache from "node-cache";
dotenv.config();

const cache = new NodeCache();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export async function sendOtp(email) {
  const otp = crypto.randomInt(100000, 999999).toString();
  deleteOtp(email);
  cache.set(email, otp, 300); // 300 seconds = 5 minutes

  const mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP code is ${otp}. It is valid for 5 minutes.`,
  };

  // Send OTP email
  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: "OTP sent successfully" };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return { success: false, message: "Failed to send OTP" };
  }
}

// Helper to retrieve OTP (used in verifyOtp)
export function retrieveOtp(email) {
  return cache.get(email);
}

// Helper to delete OTP (also used in verifyOtp after successful or failed validation)
export function deleteOtp(email) {
  cache.del(email);
}

export async function verifyOtp(email, otp) {
  // Retrieve OTP from cache
  const cachedOtp = retrieveOtp(email);
  console.log(cachedOtp);
  if (!cachedOtp) {
    return { valid: false, message: "OTP expired or not found" };
  }

  if (cachedOtp === otp) {
    // OTP is valid; delete it after successful verification
    deleteOtp(email);
    return { valid: true, message: "OTP verified successfully" };
  } else {
    // OTP invalid
    return { valid: false, message: "Invalid OTP" };
  }
}
