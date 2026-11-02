"use client";

import { useState, useTransition } from "react";
import {
  Store,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Save,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { updateOrderPickupDetails } from "@/lib/actions/manual-delivery";
import { STORE_PICKUP_LOCATION } from "@/lib/store-info";

interface OrderPickupAppointmentPanelProps {
  orderId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  initialAppointmentDate?: Date | null;
  initialAppointmentTime?: string | null;
  initialPickupStatus?: string | null;
  initialPickupNotes?: string | null;
}

export function OrderPickupAppointmentPanel({
  orderId,
  customerName,
  customerPhone,
  customerEmail,
  initialAppointmentDate,
  initialAppointmentTime,
  initialPickupStatus,
  initialPickupNotes,
}: OrderPickupAppointmentPanelProps) {
  const [isPending, startTransition] = useTransition();

  // Format initial date as YYYY-MM-DD for date input
  const defaultDateStr = initialAppointmentDate
    ? new Date(initialAppointmentDate).toISOString().split("T")[0]
    : "";

  const [appointmentDate, setAppointmentDate] = useState(defaultDateStr);
  const [appointmentTime, setAppointmentTime] = useState(initialAppointmentTime || "");
  const [pickupStatus, setPickupStatus] = useState(initialPickupStatus || "PENDING_SCHEDULE");
  const [pickupNotes, setPickupNotes] = useState(initialPickupNotes || "");

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateOrderPickupDetails(orderId, {
        pickupAppointmentDate: appointmentDate || null,
        pickupAppointmentTime: appointmentTime || null,
        pickupStatus,
        pickupNotes,
      });

      if (res.success) {
        toast({
          title: "Pickup Details Saved",
          description: "Appointment and pickup status have been successfully updated.",
        });
      } else {
        toast({
          title: "Update Blocked",
          description: res.error || "Failed to update pickup details.",
          variant: "destructive",
        });
      }
    });
  };

  const getStatusBadge = () => {
    switch (pickupStatus) {
      case "SCHEDULED":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            <Clock className="w-3 h-3 mr-1" />
            Pickup Scheduled
          </Badge>
        );
      case "READY_FOR_PICKUP":
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-300">
            <Store className="w-3 h-3 mr-1" />
            Ready for Pickup
          </Badge>
        );
      case "PICKED_UP":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Picked Up & Completed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 animate-pulse">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Appointment Pending Contact
          </Badge>
        );
    }
  };

  return (
    <Card className="border-2 border-primary/20 bg-white shadow-sm overflow-hidden">
      <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <Store className="h-5 w-5 text-primary" />
            Store Pickup &amp; Appointment Management
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* Customer Contact Callout */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Customer Contact for Pickup Appointment
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-900">{customerName || "Customer"}</span>
            </div>

            {customerPhone ? (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-emerald-600 shrink-0" />
                <a
                  href={`tel:${customerPhone}`}
                  className="font-bold text-emerald-700 hover:underline"
                  title="Click to call customer"
                >
                  {customerPhone}
                </a>
              </div>
            ) : (
              <p className="text-xs text-amber-600">No phone provided</p>
            )}

            {customerEmail && (
              <div className="flex items-center gap-2 text-sm sm:col-span-2">
                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                <a
                  href={`mailto:${customerEmail}`}
                  className="text-slate-700 hover:text-primary hover:underline text-xs"
                >
                  {customerEmail}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Appointment Scheduling Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pickupDate" className="text-xs font-semibold">
              Appointment Date
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                id="pickupDate"
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="pl-9 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickupTime" className="text-xs font-semibold">
              Appointment Time
            </Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                id="pickupTime"
                placeholder="e.g. 10:30 AM or 2:00 PM – 4:00 PM"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                className="pl-9 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="pickupStatus" className="text-xs font-semibold">
              Pickup Status
            </Label>
            <select
              id="pickupStatus"
              value={pickupStatus}
              onChange={(e) => setPickupStatus(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="PENDING_SCHEDULE">Pending Schedule (Contact Customer)</option>
              <option value="SCHEDULED">Scheduled (Date &amp; Time Confirmed)</option>
              <option value="READY_FOR_PICKUP">Ready for Pickup at Store</option>
              <option value="PICKED_UP">Picked Up (Customer Collected Order)</option>
            </select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="pickupNotes" className="text-xs font-semibold">
              Pickup Instructions &amp; Admin Notes
            </Label>
            <Textarea
              id="pickupNotes"
              placeholder="e.g. Customer will arrive in a trailer; items packed in warehouse bay 3."
              rows={3}
              value={pickupNotes}
              onChange={(e) => setPickupNotes(e.target.value)}
              className="text-xs sm:text-sm resize-none"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-slate-100 flex-wrap gap-2">
          <p className="text-[11px] text-muted-foreground">
            Location: <strong>{STORE_PICKUP_LOCATION.fullAddress}</strong>
          </p>
          <Button onClick={handleSave} disabled={isPending} size="sm" className="gap-2">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Appointment Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

