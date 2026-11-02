import { db } from "@/lib/db";
import { sendEmail } from "./brevo";
import { renderStandardEmail, renderCard, escapeHtml } from "./email-template";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  author: {
    name: string | null;
  } | null;
  publishedAt: Date;
}

export async function sendNewBlogPostNotifications(post: BlogPost) {
  try {
    // Get all members who want to receive blog notifications
    const members = await db.user.findMany({
      where: {
        isMember: true,
        OR: [{ membershipExpiry: null }, { membershipExpiry: { gt: new Date() } }],
        email: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (members.length === 0) {
      console.log("No members to notify");
      return;
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://completehomesollution.com.au").replace(/\/$/, "");
    const blogUrl = `${appUrl}/blog/${encodeURIComponent(post.slug)}`;
    const formattedDate = post.publishedAt.toLocaleDateString("en-AU", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const bodyHtml = `
      <h2 style="font-size:20px;font-weight:800;color:#1e293b;margin:0 0 8px;">
        ${escapeHtml(post.title)}
      </h2>
      <p style="font-size:13px;color:#64748b;margin:0 0 16px;">
        By ${escapeHtml(post.author?.name || "Complete Home Sollution Team")} · ${formattedDate}
      </p>

      ${
        post.excerpt
          ? renderCard(`
            <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;font-style:italic;">
              "${escapeHtml(post.excerpt)}"
            </p>
          `, { bg: "#f8fafc" })
          : ""
      }

      <p style="margin:16px 0 0;font-size:14px;color:#475569;line-height:1.6;">
        As a valued member, enjoy early and exclusive access to our newest home design ideas, styling guides, and furniture care articles.
      </p>
    `;

    const emailHtml = renderStandardEmail({
      title: `New Article: ${post.title}`,
      badge: { text: "Exclusive Member Reading", type: "info" },
      greeting: "Hello Valued Member,",
      bodyHtml,
      cta: { text: "Read Full Article", url: blogUrl },
      secondaryCta: { text: "Manage Notification Preferences", url: `${appUrl}/account/profile` },
    });

    // Send emails in batches to avoid rate limits
    const batchSize = 50;
    const batches = [];
    
    for (let i = 0; i < members.length; i += batchSize) {
      batches.push(members.slice(i, i + batchSize));
    }

    let successCount = 0;
    let failureCount = 0;

    for (const batch of batches) {
      const emailPromises = batch.map(async (member) => {
        try {
          await sendEmail({
            to: [{ email: member.email!, name: member.name || undefined }],
            subject: `New Blog Post: ${post.title}`,
            htmlContent: emailHtml,
          });
          return { success: true, memberId: member.id };
        } catch (error) {
          console.error(`Failed to send email to ${member.email}:`, error);
          return { success: false, memberId: member.id, error };
        }
      });

      const results = await Promise.allSettled(emailPromises);
      
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          if (result.value.success) {
            successCount++;
          } else {
            failureCount++;
          }
        } else {
          failureCount++;
        }
      });

      // Add delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Blog post notifications sent: ${successCount} successful, ${failureCount} failed`);
    
    return {
      totalMembers: members.length,
      successCount,
      failureCount,
    };
  } catch (error) {
    console.error("Error sending blog post notifications:", error);
    throw error;
  }
}
