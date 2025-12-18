export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { code, newEmail } = body;

    if (!code || !newEmail) {
      return NextResponse.json(
        { error: "Verification code and new email are required" },
        { status: 400 }
      );
    }

    // Get user with email_code and password_reset_code (which stores email hash)
    const userResult = await pool.query(
      "SELECT email_code, password_reset_code FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];

    if (!user.email_code || !user.password_reset_code) {
      return NextResponse.json(
        { error: "No pending email change request" },
        { status: 400 }
      );
    }

    // Verify code matches
    if (user.email_code !== code) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Verify email matches the stored hash
    const emailHash = `${newEmail.length}${newEmail.substring(0, 9)}`.substring(0, 10);
    if (user.password_reset_code !== emailHash) {
      return NextResponse.json(
        { error: "Email does not match the verification request" },
        { status: 400 }
      );
    }

    // Check if new email is still available
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [newEmail]
    );

    if (existingUser.rows.length > 0 && existingUser.rows[0].id !== session.user.id) {
      return NextResponse.json(
        { error: "Email is already in use" },
        { status: 400 }
      );
    }

    // Update email and clear verification codes
    await pool.query(
      "UPDATE users SET email = $1, email_code = NULL, password_reset_code = NULL, email_verified = TRUE WHERE id = $2",
      [newEmail, session.user.id]
    );

    return NextResponse.json(
      { message: "Email updated successfully", newEmail },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Verify email change error:", error);
    return NextResponse.json(
      { error: "Failed to verify email change", details: error.message },
      { status: 500 }
    );
  }
}

