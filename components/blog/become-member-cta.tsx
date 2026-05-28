import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Crown, Lock, BookOpen, TrendingUp } from "lucide-react";

interface BecomeMemberCTAProps {
  totalPosts: number;
}

export default function BecomeMemberCTA({ totalPosts }: BecomeMemberCTAProps) {
  return (
    <Card className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border-amber-200 overflow-hidden">
      <CardContent className="p-8">
        <div className="text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
            <Crown className="h-8 w-8 text-amber-600" />
          </div>
          
          {/* Title */}
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Unlock All {totalPosts}+ Articles
          </h2>
          
          {/* Description */}
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            You're currently viewing a preview of our blog. Become a member to access all articles, 
            exclusive content, and expert insights on home furniture and design.
          </p>
          
          {/* Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center w-10 h-10 bg-white rounded-lg shadow-sm">
                <BookOpen className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">Full Access</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center w-10 h-10 bg-white rounded-lg shadow-sm">
                <Lock className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">Exclusive Content</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center w-10 h-10 bg-white rounded-lg shadow-sm">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">Expert Tips</span>
            </div>
          </div>
          
          {/* CTA Button */}
          <Link href="/membership">
            <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 text-base font-semibold">
              <Crown className="h-5 w-5 mr-2" />
              Become a Member
            </Button>
          </Link>
          
          {/* Subtext */}
          <p className="text-xs text-slate-500 mt-3">
            Join thousands of members getting exclusive home design insights
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
