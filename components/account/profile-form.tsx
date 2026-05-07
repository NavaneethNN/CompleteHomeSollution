"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, User, Mail, Phone, Check, Loader2 } from "lucide-react";
import { profileSchema, ProfileInput } from "@/lib/validations/address";
import { updateProfile } from "@/lib/actions/profile";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ProfileFormProps {
  profile: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    image: string | null;
    isMember: boolean;
    memberSince: Date | null;
    createdAt: Date;
  } | null;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(profile?.image || "");
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    setValue,
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile?.name || "",
      phone: profile?.phone || "",
      image: profile?.image || "",
    },
  });

  const imageUrl = watch("image");

  const onSubmit = async (data: ProfileInput) => {
    setIsLoading(true);
    try {
      const result = await updateProfile(data);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Your profile has been updated successfully.",
          variant: "success",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setValue("image", url, { shouldDirty: true });
    setPreviewImage(url);
  };

  const initials = profile?.name
    ? profile.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (profile?.email?.[0] ?? "U").toUpperCase();

  return (
    <main className="flex-1 min-w-0 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Edit Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal information and contact details
        </p>
      </div>

      {/* Profile Picture Card */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Profile Picture</CardTitle>
          <CardDescription className="text-sm">
            This will be displayed on your profile and throughout the site
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-border"
                  onError={() => setPreviewImage("")}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center ring-4 ring-border">
                  <span className="text-3xl font-black text-white">{initials}</span>
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md border border-border">
                <Camera className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="flex-1 max-w-md">
              <Label htmlFor="image" className="text-sm font-medium">
                Image URL
              </Label>
              <Input
                id="image"
                type="url"
                placeholder="https://example.com/avatar.jpg"
                className="mt-1.5"
                {...register("image")}
                onChange={handleImageChange}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Enter a URL for your profile picture (e.g., from Gravatar or Google)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Personal Information</CardTitle>
            <CardDescription className="text-sm">
              Update your name and contact details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                className="max-w-md"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <Separator />

            {/* Email Field (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={profile?.email || ""}
                disabled
                className="max-w-md bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Email address cannot be changed. Contact support if you need to update it.
              </p>
            </div>

            <Separator />

            {/* Phone Field */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+61 4XX XXX XXX"
                className="max-w-md"
                {...register("phone")}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Used for order notifications and delivery updates
              </p>
            </div>

            <Separator />

            {/* Member Status */}
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Membership Status</Label>
                <p className="text-xs text-muted-foreground">
                  {profile?.isMember
                    ? `Member since ${profile.memberSince ? new Date(profile.memberSince).toLocaleDateString("en-AU") : "N/A"}`
                    : "Not a member yet"}
                </p>
              </div>
              {profile?.isMember ? (
                <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                  <Check className="h-4 w-4" />
                  Active Member
                </div>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <a href="/account/membership">Become a Member</a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.reload()}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || !isDirty} onClick={handleSubmit(onSubmit as any)}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </main>
  );
}
