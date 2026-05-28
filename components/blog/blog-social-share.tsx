"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Link2, 
  Mail,
  Share2,
  MessageCircle,
  Send,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

interface BlogSocialShareProps {
  title: string;
  url: string;
}

export default function BlogSocialShare({ title, url }: BlogSocialShareProps) {
  const [copied, setCopied] = useState(false);

  const shareUrls = {
  facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`Check out this article: ${url}`)}`,
};

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const handleShare = (platform: keyof typeof shareUrls) => {
    window.open(shareUrls[platform], "_blank", "width=550,height=420");
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-slate-700">Share:</span>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare("facebook")}
        className="hover:bg-blue-50 hover:border-blue-300"
      >
        <MessageCircle className="h-4 w-4" />
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare("twitter")}
        className="hover:bg-sky-50 hover:border-sky-300"
      >
        <Send className="h-4 w-4" />
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare("whatsapp")}
        className="hover:bg-green-50 hover:border-green-300"
      >
        <MessageCircle className="h-4 w-4" />
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare("email")}
        className="hover:bg-orange-50 hover:border-orange-300"
      >
        <Mail className="h-4 w-4" />
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopyLink}
        className={copied ? "bg-green-50 border-green-300" : "hover:bg-slate-50"}
      >
        <Link2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
