import { User } from "../model/user.mjs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { createAccessToken, createRefreshToken } from "../jwtToken.mjs";
import bcrypt from "bcrypt";
import fs from "fs";
import mongoose from "mongoose";
import NodeCache from "node-cache";
import { fetchNameLocationJobTitlesExperienceFromPdf } from "../functions/userData.mjs";
import { parsePdf } from "../functions/userData.mjs";
import { userSchema } from "../helper/authHelper.mjs";
import { createOtp } from "../utils/otp.mjs";
import { sendOtpBrevo } from "../services/mail.mjs";

const cache = new NodeCache();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const initialSignup = async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res
      .status(500)
      .json({ error: "Database connection issue. Please try again later." });
  }
  const { password, confirmPassword, email } = req.body;
  try {
    await userSchema.validateAsync({
      password,
      confirmPassword,
      email,
    });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    //generate OTP and validate
    const otp = createOtp(email);
    if (!otp) {
      return res.status(500).json({ error: "Failed to generate OTP" });
    }

    const otpSent = await sendOtpBrevo(process.env.EMAIL_USER, email, otp);
    if (!otpSent) {
      return res.status(500).json({ error: "Failed to send OTP" });
    }
    cache.set(email, {
      password,
    });
    return res
      .status(200)
      .json({ message: "OTP sent successfully, please verify." });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }
    return res.status(500).json({ error: error.message });
  }
};

export const finalSignup = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: "missing fields email or otp" });
  }

  const userData = cache.get(email);
  const otpValid = await verifyOtp(email, otp);

  if (!userData) {
    return res.status(400).json({ error: "User data not found or expired" });
  }
  if (otpValid.valid == false) {
    cache.del(email);
    return res.status(400).json({ error: otpValid.message });
  }

  const hashedPassword = await bcrypt.hash(userData.password, 10);
  const newUser = new User({
    email: email,
    password: hashedPassword,
    userName: userData.name, // Assuming name is still part of userData
  });

  await newUser.save();

  const payload = {
    _id: newUser._id,
    email: newUser.email,
  };

  const accessToken = await createAccessToken(payload);
  const refreshToken = await createRefreshToken(payload, res);

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 15 * 60 * 1000 * 8,
  });

  cache.del(email);
  return res.status(201).json({ message: "User registered successfully" });
};

export const uploadResume = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "PDF file is required" });
  }
  try {
    const user = await User.findById(req.user.userid);
    if (!user) {
      return res.status(404).json({ error: "User with that ID doesn't exist" });
    }

    if (user.pdfAddress) {
      fs.unlink(user.pdfAddress, (err) => {
        if (err) console.error("Failed to delete old PDF:", err);
      });
    }

    const pdfPath = req.file.path;
    const pdfData = await parsePdf(pdfPath);
    const formattedText = pdfData.text.replace(/\n\n/g, "\n");
    const userData = await fetchNameLocationJobTitlesExperienceFromPdf(pdfPath);
    console.log(userData);

    // Update user document with new PDF and extracted data
    await User.findByIdAndUpdate(
      req.user.userid,
      {
        pdfAddress: pdfPath,
        formattedText: formattedText,
        userName: userData.name,
        jobTitle: userData.jobTitle,
        skills: userData.skills,
        location: userData.location,
        experience: userData.experience,
      },
      { new: true }
    );

    // Respond with success and extracted data
    res.status(200).json({ pdfAddress: pdfPath, formattedText: formattedText });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const payload = {
      _id: user._id,
      email: user.email,
    };

    const accessToken = await createAccessToken(payload);
    const refreshToken = await createRefreshToken(payload, res);

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60 * 1000 * 8,
    });

    return res.status(200).json({ message: "Login successful" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  if (!req.body.email) {
    return res.status(400).json({ error: "Email is required" });
  }
  const { email } = req.body;
  const userExist = await User.findOne(email);
  if (!userExist) {
    return res.status(200).json({
      message:
        "If this email exists in our system, you will receive a password reset link.",
    });
  }
};

export const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, "../public/uploads"));
    },
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueName + path.extname(file.originalname));
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed!"), false);
    }
    cb(null, true);
  },
}).single("pdfFile");
