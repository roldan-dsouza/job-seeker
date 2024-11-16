import Joi from "joi";
import { User } from "../model/user.mjs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { createAccessToken, createRefreshToken } from "../jwtToken.mjs";
import bcrypt from "bcrypt";
import fs from "fs";
import mongoose from "mongoose";
import NodeCache from "node-cache";
import { sendOtp, verifyOtp } from "./otpControl.mjs";
import { checkMissingFieldsInSignUp } from "../middleware/middleware.mjs";
import {
  fetchNameLocationAndJobTitleFromPdf,
  fetchNameLocationJobTitlesExperienceFromPdf,
} from "../functions/userData.mjs";
import { parsePdf } from "../functions/userData.mjs";
import { error } from "console";

const cache = new NodeCache();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define user schema for validation

const userSchema2 = Joi.object({
  username: Joi.string().min(3).max(30).required().messages({
    "string.base": "Username must be a string",
    "string.empty": "Username cannot be empty",
    "string.min": "Username must be at least {#limit} characters long",
    "string.max": "Username must be at most {#limit} characters long",
    "any.required": "Username is required",
  }),
  jobTitle: Joi.alternatives().try(
    Joi.string().required().messages({
      "string.base": "Job Title must be a string",
      "string.empty": "Job Title cannot be empty",
      "any.required": "Job Title is required",
    }),
    Joi.array().items(Joi.string()).required().messages({
      "array.base": "Job Title must be an array of strings",
      "any.required": "Job Title is required",
    })
  ),
  location: Joi.string().required().messages({
    "string.base": "Location must be a string",
    "string.empty": "Location cannot be empty",
    "any.required": "Location is required",
  }),
});

const userSchema = Joi.object({
  email: Joi.string()
    .pattern(new RegExp("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"))
    .required()
    .messages({
      "string.base": "Email must be a string",
      "string.empty": "Email cannot be empty",
      "string.pattern.base": "Email must be a valid email format",
      "any.required": "Email is required",
    }),
  password: Joi.string()
    .pattern(new RegExp("^[a-zA-Z0-9]{3,30}$"))
    .required()
    .messages({
      "string.base": "Password must be a string",
      "string.empty": "Password cannot be empty",
      "string.pattern.base": "Password must be 3 to 30 alphanumeric characters",
      "any.required": "Password is required",
    }),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "string.base": "Confirm Password must be a string",
    "any.only": "Confirm Password must match the Password",
    "any.required": "Confirm Password is required",
  }),
});

// Set up Multer storage configuration with file filter to only allow PDFs
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../public/uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = "PFP_" + uniqueName + path.extname(file.originalname);
    cb(null, newFilename);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype !== "application/pdf") {
    return cb(new Error("Only PDF files are allowed!"), false);
  }
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("pdfFile");

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

    const otpSent = await sendOtp(email);
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
    const user = await User.findById(req.body.id);
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
      req.body.id,
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
