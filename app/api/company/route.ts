export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if user is owner
    const userResult = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (userResult.rows[0].role !== "owner") {
      return NextResponse.json(
        { error: "Only owners can update company details" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const name = formData.get("name") as string | null;
    const websiteUrl = formData.get("websiteUrl") as string | null;
    const logo = formData.get("logo") as File | null;

    // Get company
    const companyResult = await pool.query(
      "SELECT id FROM companies WHERE owner_id = $1",
      [session.user.id]
    );

    if (companyResult.rows.length === 0) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyId = companyResult.rows[0].id;

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (name !== null) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(name);
      paramIndex++;
    }

    if (websiteUrl !== null) {
      updateFields.push(`website_url = $${paramIndex}`);
      updateValues.push(websiteUrl || null);
      paramIndex++;
    }

    let logoUrl: string | null = null;
    if (logo) {
      const blob = await put(
        `company-logos/${session.user.id}-${Date.now()}-${logo.name}`,
        logo,
        {
          access: "public",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        }
      );
      logoUrl = blob.url;
      updateFields.push(`company_logo = $${paramIndex}`);
      updateValues.push(logoUrl);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    updateValues.push(companyId);

    await pool.query(
      `UPDATE companies SET ${updateFields.join(", ")} WHERE id = $${paramIndex}`,
      updateValues
    );

    return NextResponse.json(
      { message: "Company updated successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Update company error:", error);
    return NextResponse.json(
      { error: "Failed to update company", details: error.message },
      { status: 500 }
    );
  }
}

