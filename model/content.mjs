import mongoose, { Schema, mongo } from "mongoose";

const contentSchema = Schema({
  title: { type: String },
  type: {
    type: String,
    enum: ["email", "linkdn", "coverPage", "instagram"],
    required: true,
  },
  content: { type: String },
  status: {
    type: String,
    enum: ["draft", "notPublished", "published"],
    default: "draft",
  },
  date: { type: Date },
});

export const content = mongoose.model("content", contentSchema);
