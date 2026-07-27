import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  isVerified: boolean;
  verificationToken?: string;
  verificationTokenExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    name:         { type: String, default: "" },
    isVerified:   { type: Boolean, default: false },
    verificationToken:       { type: String, index: true, sparse: true },
    verificationTokenExpiry: { type: Date },
  },
  { timestamps: true }
);

export const User =
  mongoose.models.User ||
  mongoose.model<IUser>("User", UserSchema);
