export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_PASS;

// POST - Send contact form message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, role, lookingFor, message, requestDemo } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      );
    }

    if (!gmailUser || !gmailPass) {
      console.error(
        "Gmail credentials not configured. Cannot send contact email."
      );
      return NextResponse.json(
        { error: "Contact form is temporarily unavailable" },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    // Email to send to (David Fales)
    const recipientEmail = "davidfalesct@gmail.com";

    const mailOptions = {
      from: gmailUser,
      to: recipientEmail,
      replyTo: email,
      subject: `Contact Form: ${lookingFor || "General Inquiry"} from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1a1a1a; color: #ffffff;">
          <h2 style="color: #e3ca76; border-bottom: 2px solid #e3ca76; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>
          
          <div style="margin-top: 20px;">
            <p><strong style="color: #e3ca76;">Name:</strong> ${name}</p>
            <p><strong style="color: #e3ca76;">Email:</strong> <a href="mailto:${email}" style="color: #e3ca76;">${email}</a></p>
            ${
              role
                ? `<p><strong style="color: #e3ca76;">Role:</strong> ${role}</p>`
                : ""
            }
            ${
              lookingFor
                ? `<p><strong style="color: #e3ca76;">Looking for:</strong> ${lookingFor}</p>`
                : ""
            }
            ${
              requestDemo
                ? `<p><strong style="color: #e3ca76;">Requested Demo Call:</strong> Yes</p>`
                : ""
            }
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #0a0a0a; border-left: 4px solid #e3ca76;">
            <p><strong style="color: #e3ca76;">Message:</strong></p>
            <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; text-align: center;">
            <p style="color: #888; font-size: 12px;">
              This email was sent from the Footballers Insight contact form.<br/>
              Reply directly to this email to respond to ${name}.
            </p>
          </div>
        </div>
      `,
      text: `
New Contact Form Submission

Name: ${name}
Email: ${email}
${role ? `Role: ${role}` : ""}
${lookingFor ? `Looking for: ${lookingFor}` : ""}
${requestDemo ? `Requested Demo Call: Yes` : ""}

Message:
${message}
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { success: true, message: "Message sent successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to send message", details: error.message },
      { status: 500 }
    );
  }
}
