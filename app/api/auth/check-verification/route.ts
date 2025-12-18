export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check database directly for email verification and onboarding status
    const result = await pool.query(
      "SELECT email_verified, onboarded, role FROM users WHERE email = $1",
      [session.user.email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = result.rows[0];
    const emailVerified = user.email_verified === true;
    const onboarded = user.onboarded === true;
    const role = user.role;

    return NextResponse.json(
      { 
        emailVerified,
        onboarded,
        role,
        needsOnboarding: emailVerified && !onboarded && (role === 'owner' || role === 'admin' || role === 'coach')
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Check verification error:", error);
    return NextResponse.json(
      { error: "Failed to check verification", details: error.message },
      { status: 500 }
    );
  }
}
