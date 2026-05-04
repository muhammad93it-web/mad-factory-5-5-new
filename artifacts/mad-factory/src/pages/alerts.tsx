import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { useGetOverdueAlerts } from "@workspace/api-client-react";
import { AlertCircle, Users, Building2 } from "lucide-react";
import { Link } from "wouter";

export default function Alerts() {
  const { data: alerts, isLoading } = useGetOverdueAlerts({ query: { queryKey: ["overdueAlerts"] } });

  const customerAlerts = alerts?.filter((a) => a.type === "customer") ?? [];
  const supplierAlerts = alerts?.filter((a) => a.type === "supplier") ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <AlertCircle className="h-6 w-6 text-destructive" />
        ئاگادارکردنەوەکان
      </h1>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">بەڕێکردن...</div>
      ) : alerts?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium">هیچ قەرزێکی ماوەی نییە</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {customerAlerts.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                  <Users className="h-4 w-4" />
                  قەرزی کڕیاران ({customerAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {customerAlerts.map((a, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <Link href={`/customers/${a.entityId}`} className="font-semibold text-primary hover:underline">{a.entityName}</Link>
                      <div className="flex items-center gap-6">
                        <span className="text-sm text-slate-500">{a.invoiceCount} پسووڵە</span>
                        <span className="font-bold text-destructive text-lg">{formatMoney(a.totalDebt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {supplierAlerts.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="flex items-center gap-2 text-base text-amber-600">
                  <Building2 className="h-4 w-4" />
                  قەرزی دابینکاران ({supplierAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {supplierAlerts.map((a, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <span className="font-semibold">{a.entityName}</span>
                      <div className="flex items-center gap-6">
                        <span className="text-sm text-slate-500">{a.invoiceCount} پسووڵە</span>
                        <span className="font-bold text-amber-600 text-lg">{formatMoney(a.totalDebt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
