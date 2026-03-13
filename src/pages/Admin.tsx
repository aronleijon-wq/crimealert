import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, ShieldAlert, Users } from "lucide-react";
import { toast } from "sonner";

const ADMIN_EMAILS = ["aronleijon@icloud.com"];

export default function Admin() {
  const { user, session, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<{ email: string; created_at: string }[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [csv, setCsv] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) {
    return <Navigate to="/" replace />;
  }

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-export-users`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Kunde inte hämta användare");
      }

      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
      setCsv(data.csv);
      setFetched(true);
    } catch (err: any) {
      toast.error(err.message || "Något gick fel");
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () => {
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV-fil nedladdad");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-destructive" />
              <div>
                <CardTitle className="text-xl">Admin – Användarexport</CardTitle>
                <CardDescription>Ladda ner alla registrerade e-postadresser som CSV</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-3 items-center">
              <Button onClick={fetchUsers} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
                {fetched ? "Uppdatera" : "Hämta användare"}
              </Button>
              {fetched && (
                <Button variant="outline" onClick={downloadCsv}>
                  <Download className="h-4 w-4 mr-2" />
                  Ladda ner CSV ({total} st)
                </Button>
              )}
            </div>

            {fetched && (
              <div className="rounded-md border max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>E-post</TableHead>
                      <TableHead>Registrerad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u, i) => (
                      <TableRow key={u.email}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-mono text-sm">{u.email}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(u.created_at).toLocaleDateString("sv-SE")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
