export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and verification code are required" },
        { status: 400 }
      );
    }

    // Check if user exists and code matches
    const result = await pool.query(
      "SELECT id, email_code, email_verified FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return NextResponse.json(
        { error: "Email already verified" },
        { status: 400 }
      );
    }

    if (user.email_code !== code) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Update user to verified
    await pool.query(
      "UPDATE users SET email_verified = true, email_code = NULL WHERE id = $1",
      [user.id]
    );

    // Return success with user info for session update
    return NextResponse.json(
      {
        message: "Email verified successfully",
        user: {
          id: user.id,
          email: user.email,
          emailVerified: true,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify email", details: error.message },
      { status: 500 }
    );
  }
}
