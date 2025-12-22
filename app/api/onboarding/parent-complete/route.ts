import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { put } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if user is already onboarded
    const userCheck = await pool.query(
      "SELECT onboarded, role FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userCheck.rows[0];
    if (user.onboarded) {
      return NextResponse.json(
        { error: "User already onboarded" },
        { status: 400 }
      );
    }

    if (user.role !== "parent") {
      return NextResponse.json(
        { error: "This endpoint is for parents only" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const newPassword = formData.get("newPassword") as string;
    const name = (formData.get("name") as string | null) || null;
    const phoneNumber = (formData.get("phoneNumber") as string | null) || null;
    const userImage = (formData.get("userImage") as File | null) || null;

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Upload user image to Vercel Blob if provided
    let userImageUrl: string | null = null;
    if (userImage) {
      const blob = await put(
        `user-images/${session.user.id}-${Date.now()}-${userImage.name}`,
        userImage,
        {
          access: "public",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        }
      );
      userImageUrl = blob.url;
    }

    const updateFields: string[] = ["onboarded = TRUE"];
    const updateValues: any[] = [];
    let paramIndex = 1;

    updateFields.push(`hashed_password = $${paramIndex}`);
    updateValues.push(hashedPassword);
    paramIndex++;

    if (name && name.trim()) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(name.trim());
      paramIndex++;
    }

    if (phoneNumber) {
      updateFields.push(`phone_number = $${paramIndex}`);
      updateValues.push(phoneNumber);
      paramIndex++;
    }

    if (userImageUrl) {
      updateFields.push(`image_url = $${paramIndex}`);
      updateValues.push(userImageUrl);
      paramIndex++;
    }

    updateValues.push(session.user.id);

    await pool.query(
      `UPDATE users SET ${updateFields.join(", ")} WHERE id = $${paramIndex}`,
      updateValues
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Parent onboarding completion error:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding", details: error.message },
      { status: 500 }
    );
  }
}


