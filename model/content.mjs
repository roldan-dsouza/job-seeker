import mongoose, { Schema, mongo } from "mongoose";

const contentSchema = Schema({
  title: { type: String },
  type: {
    type: String,
    enum: ["email", "linkdn", "coverLetter", "instagram"],
    required: true,
  },
  content: { type: String },
  status: {
    type: String,
    enum: ["draft", "notPublished", "published"],
    default: "draft",
  },
  date: { type: String },
});

export const content = mongoose.model("content", contentSchema);
