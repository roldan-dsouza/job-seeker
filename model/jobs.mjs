import mongoose, { Schema, mongo } from "mongoose";

const jobSchema = Schema({
  jobName: { type: String, required: true },
  jobField: { type: String, required: true },
  location: { type: String, required: true },
  noOfApplication: {
    type: Number,
    validate: {
      validator: function (value) {
        return value <= 5;
      },
      message: "Max application limit of 5 reached.",
    },
  },
});

export const jobs = mongoose.model("jobs", jobSchema);
