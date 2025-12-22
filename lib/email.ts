import nodemailer from "nodemailer";

const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_PASS;

if (!gmailUser || !gmailPass) {
  console.warn(
    "GMAIL_USER and GMAIL_PASS not set. Email sending will not work."
  );
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailUser!,
    pass: gmailPass!,
  },
});

export async function sendVerificationEmail(
  email: string,
  code: string,
  name: string
) {
  if (!gmailUser || !gmailPass) {
    console.error("Gmail credentials not configured. Cannot send email.");
    throw new Error("Email service not configured");
  }

  const mailOptions = {
    from: gmailUser,
    to: email,
    subject: "Verify your Footballers Insight account",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e3ca76;">Welcome to Footballers Insight!</h2>
        <p>Hi ${name},</p>
        <p>Thank you for signing up. Please verify your email address by entering the following code:</p>
        <div style="background-color: #1a1a1a; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
          <h1 style="color: #e3ca76; font-size: 32px; letter-spacing: 8px; margin: 0;">${code}</h1>
        </div>
        <p>This code will expire after verification. If you didn't create an account, please ignore this email.</p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">Footballers Insight Team</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Verification email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;
  }
}

export async function sendAdminInvitationEmail(
  email: string,
  name: string,
  companyName: string,
  password: string,
  loginUrl: string
) {
  if (!gmailUser || !gmailPass) {
    console.error("Gmail credentials not configured. Cannot send email.");
    throw new Error("Email service not configured");
  }

  const mailOptions = {
    from: gmailUser,
    to: email,
    subject: `You've been invited to join ${companyName} on Footballers Insight`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e3ca76;">Welcome to Footballers Insight!</h2>
        <p>Hi ${name},</p>
        <p>You've been invited to join <strong>${companyName}</strong> as an admin on Footballers Insight.</p>
        <p>Your account has been created with the following credentials:</p>
        <div style="background-color: #1a1a1a; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p style="margin: 10px 0; color: #ffffff;"><strong style="color: #e3ca76;">Email:</strong> <span style="color: #ffffff;">${email}</span></p>
          <p style="margin: 10px 0; color: #ffffff;"><strong style="color: #e3ca76;">Password:</strong> <span style="color: #ffffff; font-family: monospace;">${password}</span></p>
        </div>
        <p>Please click the button below to log in:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background-color: #e3ca76; color: #000; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(227, 202, 118, 0.3);">Log In Now</a>
        </div>
        <p style="text-align: center; color: #888; font-size: 12px; margin-top: 10px;">Or copy and paste this link: <a href="${loginUrl}" style="color: #e3ca76;">${loginUrl}</a></p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">For security reasons, please change your password after your first login.</p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">Footballers Insight Team</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Admin invitation email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending admin invitation email:", error);
    throw error;
  }
}

export async function sendPlayerInvitationEmail(
  email: string,
  parentName: string,
  playerName: string,
  teamName: string,
  password: string,
  loginUrl: string,
  isSelfSupervised: boolean = false
) {
  if (!gmailUser || !gmailPass) {
    console.error("Gmail credentials not configured. Cannot send email.");
    throw new Error("Email service not configured");
  }

  const mailOptions = {
    from: gmailUser,
    to: email,
    subject: `${playerName} has been added to ${teamName} on Footballers Insight`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e3ca76;">Welcome to Footballers Insight!</h2>
        <p>Hello ${parentName},</p>
        ${
          isSelfSupervised
            ? `<p>You have been added to <strong>${teamName}</strong> on Footballers Insight.</p>`
            : `<p>We have added <strong>${playerName}</strong> to <strong>${teamName}</strong> on Footballers Insight.</p>`
        }
        <p>Your account has been created with the following login details:</p>
        <div style="background-color: #1a1a1a; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p style="margin: 10px 0; color: #ffffff;"><strong style="color: #e3ca76;">Email:</strong> <span style="color: #ffffff;">${email}</span></p>
          <p style="margin: 10px 0; color: #ffffff;"><strong style="color: #e3ca76;">Temporary Password:</strong> <span style="color: #ffffff; font-family: monospace;">${password}</span></p>
        </div>
        <p>Please click the button below to log in and set your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background-color: #e3ca76; color: #000; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(227, 202, 118, 0.3);">Log In Now</a>
        </div>
        <p style="text-align: center; color: #888; font-size: 12px; margin-top: 10px;">Or copy and paste this link: <a href="${loginUrl}" style="color: #e3ca76;">${loginUrl}</a></p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;"><strong>Next:</strong> After you log in, you’ll complete your profile and then finish ${playerName}'s player profile information.</p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">Footballers Insight Team</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Player invitation email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending player invitation email:", error);
    throw error;
  }
}

export async function sendPlayerAddedNotificationEmail(
  email: string,
  parentName: string,
  playerName: string,
  teamName: string,
  loginUrl: string
) {
  if (!gmailUser || !gmailPass) {
    console.error("Gmail credentials not configured. Cannot send email.");
    throw new Error("Email service not configured");
  }

  const mailOptions = {
    from: gmailUser,
    to: email,
    subject: `${playerName} has been added to ${teamName} on Footballers Insight`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e3ca76;">Player Added</h2>
        <p>Hello ${parentName},</p>
        <p>We have added <strong>${playerName}</strong> to <strong>${teamName}</strong> on Footballers Insight.</p>
        <p>You can log in to your account to manage and complete ${playerName}'s player profile.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background-color: #e3ca76; color: #000; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(227, 202, 118, 0.3);">Log In Now</a>
        </div>
        <p style="text-align: center; color: #888; font-size: 12px; margin-top: 10px;">Or copy and paste this link: <a href="${loginUrl}" style="color: #e3ca76;">${loginUrl}</a></p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">If you haven’t yet, please log in to complete any missing player details (date of birth, gender, dominant foot, etc.).</p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">Footballers Insight Team</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Player added notification email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending player added notification email:", error);
    throw error;
  }
}
