"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Ticket,
  Plus,
  Trophy,
  Search,
  ExternalLink,
  Edit,
  Trash2,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  Sparkles,
  Gift,
  Dices,
  X,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateRaffleStatus, deleteRaffle } from "@/lib/actions/admin-raffle";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RafflesListProps {
  initialRaffles: any[];
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  ACTIVE: {
    label: "Active",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  UPCOMING: {
    label: "Upcoming",
    icon: Clock,
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  DRAW_PENDING: {
    label: "Draw Pending",
    icon: Dices,
    className: "bg-amber-50 text-amber-800 border-amber-300",
  },
  CLOSED: {
    label: "Closed",
    icon: Clock,
    className: "bg-amber-50 text-amber-800 border-amber-300",
  },
  WINNER_VERIFICATION: {
    label: "Verifying",
    icon: Sparkles,
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
  COMPLETED: {
    label: "Completed",
    icon: Trophy,
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  PAUSED: {
    label: "Paused",
    icon: Pause,
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
  DRAFT: {
    label: "Draft",
    icon: Clock,
    className: "bg-slate-50 text-slate-500 border-slate-200",
  },
};

export function RafflesListClient({ initialRaffles }: RafflesListProps) {
  const router = useRouter();
  const [raffles, setRaffles] = useState(initialRaffles);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  const filteredRaffles = raffles.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.slug.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPrizeValue = raffles.reduce(
    (sum, r) => sum + r.prizes.reduce((pSum: number, p: any) => pSum + p.value * p.quantity, 0),
    0
  );
  const totalTicketsIssued = raffles.reduce((sum, r) => sum + (r._count?.tickets || r.totalTickets || 0), 0);
  const totalActiveRaffles = raffles.filter((r) => r.status === "ACTIVE").length;
  const totalPendingDraws = raffles.filter((r) => r.status === "DRAW_PENDING" || r.status === "CLOSED").length;

  const handleStatusChange = async (id: string, newStatus: string) => {
    setLoadingActionId(id);
    try {
      const res = await updateRaffleStatus(id, newStatus);
      if (res.success) {
        toast.success(res.message);
        setRaffles((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
        );
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update status");
      }
    } catch (err: any) {
      toast.error(err.message || "Error updating status");
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await deleteRaffle(deleteTargetId);
      if (res.success) {
        toast.success(res.message);
        setRaffles((prev) => prev.filter((r) => r.id !== deleteTargetId));
        router.refresh();
      } else {
        toast.error(res.error || "Failed to delete raffle");
      }
    } catch (err: any) {
      toast.error(err.message || "Error deleting raffle");
    } finally {
      setDeleteTargetId(null);
    }
  };

  const renderStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || {
      label: status,
      icon: Clock,
      className: "bg-slate-50 text-slate-600 border-slate-200",
    };
    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold w-fit whitespace-nowrap ${config.className}`}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span>{config.label}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Raffles &amp; Giveaways
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Create promotional campaigns, conduct cryptographic draws, and fulfill winner orders
          </p>
        </div>

        <Button asChild className="shrink-0 bg-primary hover:bg-primary/90 text-white shadow-xs">
          <Link href="/admin/raffles/new">
            <Plus className="mr-2 h-4 w-4" />
            <span>Create New Raffle</span>
          </Link>
        </Button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Active Draws",
            value: totalActiveRaffles,
            icon: Gift,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            sublabel: "Live on storefront",
          },
          {
            label: "Tickets Issued",
            value: totalTicketsIssued.toLocaleString(),
            icon: Ticket,
            color: "text-blue-600",
            bg: "bg-blue-50",
            sublabel: "All participants",
          },
          {
            label: "Pending Draws",
            value: totalPendingDraws,
            icon: Dices,
            color: "text-amber-600",
            bg: "bg-amber-50",
            sublabel: "Ready for draw",
          },
          {
            label: "Total Prize Pool",
            value: `$${totalPrizeValue.toLocaleString()}`,
            icon: Trophy,
            color: "text-purple-600",
            bg: "bg-purple-50",
            sublabel: "Free & paid items",
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 truncate font-medium">{stat.label}</p>
                <p className="text-xl font-bold text-slate-900 truncate">{stat.value}</p>
                <p className="text-[11px] text-slate-400 truncate">{stat.sublabel}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by title or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9 h-9 text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {[
              { id: "ALL", label: "All" },
              { id: "ACTIVE", label: "Active" },
              { id: "UPCOMING", label: "Upcoming" },
              { id: "DRAW_PENDING", label: "Draw Pending" },
              { id: "COMPLETED", label: "Completed" },
              { id: "PAUSED", label: "Paused" },
              { id: "DRAFT", label: "Draft" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
                  statusFilter === st.id
                    ? "bg-primary text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {filteredRaffles.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Ticket className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-semibold text-sm text-slate-800">No raffles found</h3>
            <p className="text-xs text-slate-500 mt-1">
              {search || statusFilter !== "ALL"
                ? "Try adjusting your search query or status filter."
                : "Create your first raffle campaign to get started!"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">Campaign</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Prize Pool</th>
                  <th className="py-3 px-4">Tickets &amp; Entries</th>
                  <th className="py-3 px-4">Draw Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRaffles.map((raffle) => {
                  const mainImg =
                    raffle.bannerImage ||
                    raffle.images?.[0] ||
                    raffle.prizes?.[0]?.images?.[0] ||
                    "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=400&q=80";

                  const prizeCount = raffle.prizes?.length || 0;
                  const winnerCount = raffle.prizes?.reduce((s: number, p: any) => s + p.quantity, 0) || 0;
                  const ticketCount = raffle._count?.tickets || raffle.totalTickets || 0;

                  return (
                    <tr key={raffle.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Campaign Column */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                            <Image src={mainImg} alt={raffle.title} fill className="object-cover" />
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <Link
                              href={`/admin/raffles/${raffle.id}`}
                              className="font-semibold text-sm text-slate-900 hover:text-primary transition-colors truncate block"
                            >
                              {raffle.title}
                            </Link>
                            <span className="text-[11px] text-slate-400 block font-mono">
                              /{raffle.slug}
                            </span>
                            {raffle.visibility === "MEMBERS_ONLY" && (
                              <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                <Crown className="h-2.5 w-2.5" />
                                VIP Only
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="py-3 px-4">{renderStatusBadge(raffle.status)}</td>

                      {/* Prize Tiers */}
                      <td className="py-3 px-4">
                        <div>
                          <span className="font-semibold text-slate-800 block">
                            {prizeCount} Tier{prizeCount > 1 ? "s" : ""} ({winnerCount} Winner{winnerCount > 1 ? "s" : ""})
                          </span>
                          <span className="text-[11px] text-slate-500">
                            1st: {raffle.prizes?.[0]?.name?.slice(0, 26)}...
                          </span>
                        </div>
                      </td>

                      {/* Entries & Tickets */}
                      <td className="py-3 px-4">
                        <div>
                          <span className="font-semibold text-slate-900 block">
                            {ticketCount.toLocaleString()} Ticket{ticketCount !== 1 ? "s" : ""}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {raffle._count?.entries || 0} Participant{raffle._count?.entries !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </td>

                      {/* Draw Date */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800 block">
                          {new Date(raffle.drawDate).toLocaleDateString("en-AU", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(raffle.drawDate).toLocaleTimeString("en-AU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            asChild
                            size="sm"
                            className="h-8 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-2xs"
                          >
                            <Link href={`/admin/raffles/${raffle.id}`}>
                              <Dices className="h-3.5 w-3.5" />
                              <span>Console</span>
                            </Link>
                          </Button>

                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                            title="Edit Campaign"
                          >
                            <Link href={`/admin/raffles/${raffle.id}/edit`}>
                              <Edit className="h-3.5 w-3.5" />
                            </Link>
                          </Button>

                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                            title="View Public Storefront"
                          >
                            <Link href={`/raffles/${raffle.slug}`} target="_blank">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>

                          {raffle.status === "ACTIVE" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(raffle.id, "PAUSED")}
                              disabled={loadingActionId === raffle.id}
                              className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-50 hover:text-amber-700 border-amber-200"
                              title="Pause Raffle"
                            >
                              <Pause className="h-3.5 w-3.5" />
                            </Button>
                          ) : raffle.status === "PAUSED" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(raffle.id, "ACTIVE")}
                              disabled={loadingActionId === raffle.id}
                              className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 border-emerald-200"
                              title="Resume Raffle"
                            >
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteTargetId(raffle.id)}
                            className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200"
                            title="Delete Campaign"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={() => setDeleteTargetId(null)}>
        <AlertDialogContent className="rounded-2xl p-6 bg-white border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Delete Raffle Campaign?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500">
              Are you sure you want to delete this raffle? This action cannot be undone. Raffles with active participants should be closed or paused instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs font-semibold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
