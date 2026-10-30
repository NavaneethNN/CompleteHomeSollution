"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Ticket,
  Plus,
  Trophy,
  Users,
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
  MoreVertical,
  Dices,
} from "lucide-react";
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">ACTIVE</span>;
      case "UPCOMING":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-sky-100 text-sky-800">UPCOMING</span>;
      case "DRAW_PENDING":
      case "CLOSED":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 animate-pulse">DRAW PENDING</span>;
      case "WINNER_VERIFICATION":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-900">VERIFYING WINNERS</span>;
      case "COMPLETED":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-800">COMPLETED</span>;
      case "PAUSED":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800">PAUSED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
            <Ticket className="h-4 w-4" />
            <span>Campaign Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">
            Raffles & Giveaways
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Create multi-tier promotional campaigns, conduct cryptographic draws, and fulfill winner orders.
          </p>
        </div>

        <Link
          href="/admin/raffles/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white font-bold text-xs sm:text-sm shadow-md hover:bg-primary/95 transition-all self-start sm:self-auto hover:scale-[1.01]"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Raffle</span>
        </Link>
      </div>

      {/* ── Metrics Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-border shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Draws</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Gift className="h-4 w-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-foreground">{totalActiveRaffles}</span>
          <span className="block text-[11px] text-muted-foreground mt-0.5">Live now on store</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-border shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Tickets Issued</span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Ticket className="h-4 w-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-foreground">{totalTicketsIssued}</span>
          <span className="block text-[11px] text-muted-foreground mt-0.5">Across all campaigns</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-border shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Draws</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Dices className="h-4 w-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-amber-700">{totalPendingDraws}</span>
          <span className="block text-[11px] text-muted-foreground mt-0.5">Ready for winner draw</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-border shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Prize Pool</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Trophy className="h-4 w-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-foreground">${totalPrizeValue.toLocaleString()}</span>
          <span className="block text-[11px] text-muted-foreground mt-0.5">Free + discounted prizes</span>
        </div>
      </div>

      {/* ── Filter & Search Bar ── */}
      <div className="bg-white p-4 rounded-3xl border border-border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or slug..."
            className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {["ALL", "ACTIVE", "UPCOMING", "DRAW_PENDING", "COMPLETED", "PAUSED", "DRAFT"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === st
                  ? "bg-primary text-white shadow-xs"
                  : "bg-slate-100 text-muted-foreground hover:text-foreground"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* ── Raffles Table ── */}
      <div className="bg-white rounded-3xl border border-border overflow-hidden shadow-xs">
        {filteredRaffles.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Ticket className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <h3 className="font-bold text-sm text-foreground">No raffles found</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {search || statusFilter !== "ALL"
                ? "Try clearing your filters or search query."
                : "Create your first raffle campaign to get started!"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="py-3.5 px-4">Campaign</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Prize Tiers</th>
                  <th className="py-3.5 px-4">Entries / Tickets</th>
                  <th className="py-3.5 px-4">Draw Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
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
                    <tr key={raffle.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                            <Image src={mainImg} alt={raffle.title} fill className="object-cover" />
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <Link
                              href={`/admin/raffles/${raffle.id}`}
                              className="font-bold text-sm text-foreground hover:text-primary transition-colors truncate block"
                            >
                              {raffle.title}
                            </Link>
                            <span className="text-[11px] text-muted-foreground block font-mono">
                              /{raffle.slug}
                            </span>
                            {raffle.visibility === "MEMBERS_ONLY" && (
                              <span className="inline-block mt-0.5 text-[9px] font-black uppercase text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                                VIP Only
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">{getStatusBadge(raffle.status)}</td>

                      <td className="py-4 px-4">
                        <div>
                          <span className="font-bold text-slate-800 block">
                            {prizeCount} Tier{prizeCount > 1 ? "s" : ""} ({winnerCount} Winner{winnerCount > 1 ? "s" : ""})
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            1st: {raffle.prizes?.[0]?.name?.slice(0, 24)}...
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div>
                          <span className="font-bold text-foreground block">
                            {ticketCount} Ticket{ticketCount !== 1 ? "s" : ""}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {raffle._count?.entries || 0} Participant{raffle._count?.entries !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className="font-medium text-slate-700 block">
                          {new Date(raffle.drawDate).toLocaleDateString("en-AU", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(raffle.drawDate).toLocaleTimeString("en-AU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/admin/raffles/${raffle.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/95 transition-all shadow-xs"
                            title="Draw Console & Winners"
                          >
                            <Dices className="h-3.5 w-3.5" />
                            <span>Console</span>
                          </Link>

                          <Link
                            href={`/admin/raffles/${raffle.id}/edit`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-foreground hover:bg-slate-100 transition-colors"
                            title="Edit Campaign"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>

                          <Link
                            href={`/raffles/${raffle.slug}`}
                            target="_blank"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-foreground hover:bg-slate-100 transition-colors"
                            title="View Public Page"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>

                          {raffle.status === "ACTIVE" ? (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(raffle.id, "PAUSED")}
                              disabled={loadingActionId === raffle.id}
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Pause Campaign"
                            >
                              <Pause className="h-4 w-4" />
                            </button>
                          ) : raffle.status === "PAUSED" ? (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(raffle.id, "ACTIVE")}
                              disabled={loadingActionId === raffle.id}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Resume Campaign"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => setDeleteTargetId(raffle.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
        <AlertDialogContent className="rounded-3xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black">
              Delete Raffle Campaign?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete this raffle? This action cannot be undone. Raffles with active participants should be cancelled or closed instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
