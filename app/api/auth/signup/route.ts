export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT id, role FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      const existingRole = existingUser.rows[0].role;
      return NextResponse.json(
        { 
          error: `An account with this email already exists with the role "${existingRole}". Please login instead.` 
        },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate email verification code (6 digits)
    const emailCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Insert new user
    const result = await pool.query(
      `INSERT INTO users (name, email, hashed_password, email_code, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, email_verified`,
      [name, email, hashedPassword, emailCode, "owner"]
    );

    const user = result.rows[0];

    // Send email verification code
    try {
      await sendVerificationEmail(email, emailCode, name);
    } catch (emailError: any) {
      console.error("Failed to send verification email:", emailError);
      // Still return success, but log the error
      // In production, you might want to handle this differently
    }

    return NextResponse.json(
      {
        message:
          "User created successfully. Please check your email for verification code.",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.email_verified,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create user", details: error.message },
      { status: 500 }
    );
  }
}
