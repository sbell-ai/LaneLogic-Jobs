import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, Upload } from "lucide-react";

const identitySchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  username: z
    .string()
    .min(2, "Username must be at least 2 characters")
    .max(40, "Username must be at most 40 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username may only contain letters, numbers, _ and -")
    .nullable()
    .or(z.literal("")),
  email: z.string().email("Invalid email address"),
  contactPhone: z.string().nullable().optional(),
  profileImage: z.string().nullable().optional(),
});

type IdentityFormValues = z.infer<typeof identitySchema>;

interface IdentitySectionProps {
  profile: any;
  onUpdate: (updated: any) => void;
}

export default function IdentitySection({ profile, onUpdate }: IdentitySectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [emailChangePending, setEmailChangePending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const form = useForm<IdentityFormValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      username: profile.username ?? "",
      email: profile.email ?? "",
      contactPhone: profile.contactPhone ?? "",
      profileImage: profile.profileImage ?? "",
    },
  });

  const profileImage = form.watch("profileImage");
  const initials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase() || "AD";

  const updateMutation = useMutation({
    mutationFn: async (data: IdentityFormValues) => {
      const res = await apiRequest("PUT", "/api/admin/profile", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.emailChangePending) {
        setEmailChangePending(true);
        toast({ title: "Profile updated", description: "A verification email was sent to your new address. Changes take effect after confirmation." });
      } else {
        toast({ title: "Profile updated", description: "Your profile has been saved." });
      }
      onUpdate(data);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      form.setValue("profileImage", url);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Identity</CardTitle>
        <CardDescription>Update your name, username, contact details, and profile photo.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profileImage ?? ""} alt="Profile photo" />
                <AvatarFallback className="text-lg bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <label htmlFor="photo-upload">
                  <Button type="button" variant="outline" size="sm" asChild data-testid="button-upload-photo">
                    <span className="cursor-pointer flex items-center gap-2">
                      <Upload size={14} />
                      {uploading ? "Uploading…" : "Upload Photo"}
                    </span>
                  </Button>
                </label>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  data-testid="input-photo-upload"
                />
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG or WebP. Max 5MB.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-first-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-last-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="e.g. steph_admin" data-testid="input-username" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Email Address
                  </FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Input {...field} type="email" data-testid="input-email" />
                    </FormControl>
                    {profile.emailVerified ? (
                      <Badge variant="outline" className="text-green-600 border-green-300 whitespace-nowrap flex items-center gap-1">
                        <CheckCircle size={12} /> Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 whitespace-nowrap flex items-center gap-1">
                        <XCircle size={12} /> Unverified
                      </Badge>
                    )}
                  </div>
                  <FormMessage />
                  {emailChangePending && (
                    <p className="text-sm text-amber-600 mt-1" data-testid="text-email-pending">
                      Verification email sent — changes take effect after you confirm the link.
                    </p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} type="tel" placeholder="e.g. +1 (555) 000-0000" data-testid="input-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-identity">
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
