export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user exists
    const result = await pool.query(
      "SELECT id, name, email_verified FROM users WHERE email = $1",
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

    // Generate new verification code
    const emailCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Update user with new code
    await pool.query(
      "UPDATE users SET email_code = $1 WHERE id = $2",
      [emailCode, user.id]
    );

    // Send verification email
    try {
      await sendVerificationEmail(email, emailCode, user.name);
    } catch (emailError: any) {
      console.error("Failed to send verification email:", emailError);
      return NextResponse.json(
        { error: "Failed to send verification email", details: emailError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Verification email sent successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "Failed to resend verification email", details: error.message },
      { status: 500 }
    );
  }
}

