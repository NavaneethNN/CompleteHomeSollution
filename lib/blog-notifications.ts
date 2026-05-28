import { db } from "@/lib/db";
import { sendEmail } from "./brevo";

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

    const blogUrl = `${process.env.NEXT_PUBLIC_APP_URL}/blog/${post.slug}`;
    
    // Prepare email template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Blog Post - Complete Home Solution</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; }
          .post-title { color: #2c3e50; font-size: 24px; margin-bottom: 10px; }
          .post-meta { color: #7f8c8d; font-size: 14px; margin-bottom: 20px; }
          .post-excerpt { color: #34495e; margin-bottom: 30px; line-height: 1.6; }
          .cta-button { display: inline-block; background: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-bottom: 20px; }
          .cta-button:hover { background: #2980b9; }
          .footer { background: #ecf0f1; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #7f8c8d; }
          .member-badge { background: #f39c12; color: white; padding: 4px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏠 Complete Home Solution</h1>
        </div>
        
        <div class="content">
          <h2 class="post-title">${post.title}</h2>
          <div class="post-meta">
            By ${post.author?.name || "Complete Home Solution Team"} • 
            ${post.publishedAt.toLocaleDateString("en-AU", { 
              weekday: "long", 
              year: "numeric", 
              month: "long", 
              day: "numeric" 
            })}
          </div>
          
          ${post.excerpt ? `<div class="post-excerpt">${post.excerpt}</div>` : ""}
          
          <div style="text-align: center;">
            <a href="${blogUrl}" class="cta-button">Read Full Article</a>
          </div>
          
          <p style="text-align: center; color: #7f8c8d; font-size: 14px;">
            As a valued member, you get exclusive access to our latest insights and tips.
          </p>
        </div>
        
        <div class="footer">
          <p>You're receiving this email because you're a member of Complete Home Solution.</p>
          <p>Want to manage your notifications? <a href="${process.env.NEXT_PUBLIC_APP_URL}/account/profile">Visit your account</a></p>
          <p>&copy; 2024 Complete Home Solution. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

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
