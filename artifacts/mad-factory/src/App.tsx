import React, { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { createIDBPersister } from "@/lib/offline-db";
import { useSyncRefresh } from "@/hooks/use-sync-refresh";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import CustomerDetail from "@/pages/customer-detail";
import CustomerStatement from "@/pages/customer-statement";
import SupplierStatement from "@/pages/supplier-statement";
import Sales from "@/pages/sales";
import SalesNew from "@/pages/sales-new";
import SalesDetail from "@/pages/sales-detail";
import SalesConsolidated from "@/pages/sales-consolidated";
import Suppliers from "@/pages/suppliers";
import SupplierDetail from "@/pages/supplier-detail";
import Purchases from "@/pages/purchases";
import PurchasesNew from "@/pages/purchases-new";
import PurchaseDetail from "@/pages/purchase-detail";
import PurchasesConsolidated from "@/pages/purchases-consolidated";
import Materials from "@/pages/materials";
import Cashbox from "@/pages/cashbox";
import CustomerPayments from "@/pages/customer-payments";
import SupplierPayments from "@/pages/supplier-payments";
import Employees from "@/pages/employees";
import Payroll from "@/pages/payroll";
import PayrollSlip from "@/pages/payroll-slip";
import Expenses from "@/pages/expenses";
import Incomes from "@/pages/incomes";
import Shareholders from "@/pages/shareholders";
import Alerts from "@/pages/alerts";
import DebtorsList from "@/pages/debtors-list";
import Settings from "@/pages/settings";
import MonthlyReport from "@/pages/monthly-report";
import SalesReport from "@/pages/sales-report";
import ProfitLoss from "@/pages/profit-loss";
import MonthlyClosings from "@/pages/monthly-closings";
import TreasuryMovements from "@/pages/treasury-movements";
import UsersPage from "@/pages/users";
import BackupPage from "@/pages/backup";
import NotFound from "@/pages/not-found";

// 24 hours — keep data in IDB cache so the app works fully offline
const GC_TIME = 1000 * 60 * 60 * 24;
// 5 minutes — serve from cache without network round-trip
const STALE_TIME = 1000 * 60 * 5;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: GC_TIME,
      staleTime: STALE_TIME,
      retry: (failureCount) => {
        if (!navigator.onLine) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      // Serve IDB-persisted data immediately even when offline
      networkMode: "offlineFirst",
    },
    mutations: {
      networkMode: "offlineFirst",
      retry: false,
    },
  },
});

const persister = createIDBPersister();

// Critical endpoints to pre-warm so they're available offline immediately
const PREWARM_URLS = [
  "/api/customers",
  "/api/suppliers",
  "/api/materials",
  "/api/employees",
  "/api/exchange-rates/latest",
  "/api/sales",
  "/api/purchases",
  "/api/expenses",
  "/api/incomes",
  "/api/shareholders",
  "/api/settings",
];

function SyncRefresher() {
  useSyncRefresh();
  return null;
}

function PreWarmCache() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user || !navigator.onLine) return;
    // After login, pre-fetch all critical data into React Query cache
    // (which in turn persists to IndexedDB via the persister)
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    for (const url of PREWARM_URLS) {
      const fullUrl = `${base}${url}`;
      qc.prefetchQuery({
        queryKey: [url],
        queryFn: () =>
          fetch(fullUrl, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .catch(() => null),
        staleTime: STALE_TIME,
      }).catch(() => {});
    }
  }, [user, qc]);

  return null;
}

function PermissionRoute({
  path,
  slug,
  component: Component,
}: {
  path: string;
  slug: string;
  component: React.ComponentType;
}) {
  const { hasPermission } = useAuth();
  return (
    <Route path={path}>
      {hasPermission(slug) ? <Component /> : <AccessDenied />}
    </Route>
  );
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-3">
      <div className="text-6xl">🔒</div>
      <h2 className="text-xl font-bold text-slate-700 dark:text-white">دەسەڵاتت نییە</h2>
      <p className="text-slate-500 text-sm">تکایە لەگەڵ بەڕێوەبەرەکە پەیوەندی بکە.</p>
    </div>
  );
}

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <PermissionRoute path="/customers" slug="customers" component={Customers} />
        <PermissionRoute path="/customer-statement" slug="customers" component={CustomerStatement} />
        <PermissionRoute path="/customers/:id" slug="customers" component={CustomerDetail} />
        <PermissionRoute path="/sales" slug="sales" component={Sales} />
        <PermissionRoute path="/sales/new" slug="sales" component={SalesNew} />
        <PermissionRoute path="/sales/consolidated" slug="sales" component={SalesConsolidated} />
        <PermissionRoute path="/sales/:id" slug="sales" component={SalesDetail} />
        <PermissionRoute path="/suppliers" slug="suppliers" component={Suppliers} />
        <PermissionRoute path="/supplier-statement" slug="suppliers" component={SupplierStatement} />
        <PermissionRoute path="/suppliers/:id" slug="suppliers" component={SupplierDetail} />
        <PermissionRoute path="/purchases" slug="purchases" component={Purchases} />
        <PermissionRoute path="/purchases/new" slug="purchases" component={PurchasesNew} />
        <PermissionRoute path="/purchases/consolidated" slug="purchases" component={PurchasesConsolidated} />
        <PermissionRoute path="/purchases/:id" slug="purchases" component={PurchaseDetail} />
        <PermissionRoute path="/materials" slug="materials" component={Materials} />
        <PermissionRoute path="/cashbox" slug="cashbox" component={Cashbox} />
        <PermissionRoute path="/customer-payments" slug="customers" component={CustomerPayments} />
        <PermissionRoute path="/supplier-payments" slug="suppliers" component={SupplierPayments} />
        <PermissionRoute path="/employees" slug="employees" component={Employees} />
        <PermissionRoute path="/payroll" slug="payroll" component={Payroll} />
        <PermissionRoute path="/payroll/slip/:id" slug="payroll" component={PayrollSlip} />
        <PermissionRoute path="/expenses" slug="expenses" component={Expenses} />
        <PermissionRoute path="/incomes" slug="incomes" component={Incomes} />
        <PermissionRoute path="/shareholders" slug="shareholders" component={Shareholders} />
        <PermissionRoute path="/alerts" slug="alerts" component={Alerts} />
        <PermissionRoute path="/debtors" slug="customers" component={DebtorsList} />
        <PermissionRoute path="/settings" slug="settings" component={Settings} />
        <PermissionRoute path="/monthly-report" slug="reports" component={MonthlyReport} />
        <PermissionRoute path="/sales-report" slug="reports" component={SalesReport} />
        <PermissionRoute path="/profit-loss" slug="reports" component={ProfitLoss} />
        <PermissionRoute path="/monthly-closings" slug="reports" component={MonthlyClosings} />
        <PermissionRoute path="/treasury-movements" slug="cashbox" component={TreasuryMovements} />
        <PermissionRoute path="/users" slug="users-admin" component={UsersPage} />
        <PermissionRoute path="/backup" slug="backup-admin" component={BackupPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: GC_TIME,
        buster: "v1",
      }}
    >
      <TooltipProvider>
        <AuthProvider>
          <SyncRefresher />
          <PreWarmCache />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
