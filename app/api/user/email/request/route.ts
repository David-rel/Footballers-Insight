export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { newEmail } = body;

    if (!newEmail) {
      return NextResponse.json(
        { error: "New email is required" },
        { status: 400 }
      );
    }

    // Check if email is already in use
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [newEmail]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: "Email is already in use" },
        { status: 400 }
      );
    }

    // Get current user
    const userResult = await pool.query(
      "SELECT name, email FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];

    // Generate verification code (6 digits)
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code in email_code (VARCHAR(10) - code is 6 digits, fits perfectly)
    // We'll store a hash of the new email in password_reset_code to verify it matches during verification
    // Using first 10 chars of a simple hash (email length + first chars of email)
    // This allows us to verify the email matches without storing the full email
    const emailHash = `${newEmail.length}${newEmail.substring(0, 9)}`.substring(
      0,
      10
    );

    await pool.query(
      "UPDATE users SET email_code = $1, password_reset_code = $2 WHERE id = $3",
      [code, emailHash, session.user.id]
    );

    // Send verification email to new address
    try {
      await sendVerificationEmail(newEmail, code, user.name || "User");
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Reset email_code on failure
      await pool.query("UPDATE users SET email_code = NULL WHERE id = $1", [
        session.user.id,
      ]);
      return NextResponse.json(
        { error: "Failed to send verification email" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Verification code sent to new email address" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Request email change error:", error);
    return NextResponse.json(
      { error: "Failed to request email change", details: error.message },
      { status: 500 }
    );
  }
}
