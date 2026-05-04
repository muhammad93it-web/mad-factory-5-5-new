import { Router } from "express";
import { and, sql, desc, eq, gte, lte } from "drizzle-orm";
import {
  db,
  salesInvoicesTable,
  salesInvoiceItemsTable,
  materialsTable,
  customerPaymentsTable,
  purchaseInvoicesTable,
  supplierPaymentsTable,
  payrollEntriesTable,
  expensesTable,
  incomesTable,
  shareholderTransactionsTable,
  shareholdersTable,
  exchangeRatesTable,
} from "@workspace/db";
import {
  GetCashboxSummaryQueryParams,
  GetMonthlyReportQueryParams,
  GetProfitLossReportQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/cashbox/summary", async (req, res): Promise<void> => {
  const qp = GetCashboxSummaryQueryParams.safeParse(req.query);
  const fromDate = qp.success ? qp.data.fromDate : undefined;
  const toDate = qp.success ? qp.data.toDate : undefined;

  const dateFilter = (dateCol: string) => {
    const parts = [];
    if (fromDate) parts.push(sql.raw(`${dateCol} >= '${fromDate}'`));
    if (toDate) parts.push(sql.raw(`${dateCol} <= '${toDate}'`));
    return parts;
  };

  const [salesAgg] = await db.select({ total: sql<string>`coalesce(sum(paid_amount), 0)` }).from(salesInvoicesTable).where(and(eq(salesInvoicesTable.isDeleted, false), ...dateFilter("invoice_date")));
  const [custPayAgg] = await db.select({ total: sql<string>`coalesce(sum(amount), 0)` }).from(customerPaymentsTable).where(and(...dateFilter("payment_date")));
  const [purchAgg] = await db.select({ total: sql<string>`coalesce(sum(paid_amount_iqd), 0)` }).from(purchaseInvoicesTable).where(and(eq(purchaseInvoicesTable.isDeleted, false), ...dateFilter("invoice_date")));
  const [suppPayAgg] = await db.select({ total: sql<string>`coalesce(sum(amount_iqd), 0)` }).from(supplierPaymentsTable).where(and(...dateFilter("payment_date")));
  const [payrollAgg] = await db.select({ total: sql<string>`coalesce(sum(paid_amount), 0)` }).from(payrollEntriesTable);
  const [expAgg] = await db.select({ total: sql<string>`coalesce(sum(amount), 0)` }).from(expensesTable).where(and(...dateFilter("expense_date")));
  const [incAgg] = await db.select({ total: sql<string>`coalesce(sum(amount), 0)` }).from(incomesTable).where(and(...dateFilter("income_date")));
  const [shrWithdrawAgg] = await db.select({ total: sql<string>`coalesce(sum(amount), 0)` }).from(shareholderTransactionsTable).where(and(eq(shareholderTransactionsTable.type, "withdrawal"), ...dateFilter("transaction_date")));

  const [custDebtAgg] = await db.select({ total: sql<string>`coalesce(sum(remaining_debt), 0)` }).from(salesInvoicesTable).where(eq(salesInvoicesTable.isDeleted, false));
  const [suppDebtAgg] = await db.select({ total: sql<string>`coalesce(sum(remaining_debt_iqd), 0)` }).from(purchaseInvoicesTable).where(eq(purchaseInvoicesTable.isDeleted, false));
  const [latestRate] = await db.select().from(exchangeRatesTable).orderBy(desc(exchangeRatesTable.rateDate)).limit(1);

  const totalSalesRevenue = Number(salesAgg.total);
  const totalCustomerPayments = Number(custPayAgg.total);
  const totalPurchasesPaid = Number(purchAgg.total);
  const totalSupplierPayments = Number(suppPayAgg.total);
  const totalPayroll = Number(payrollAgg.total);
  const totalExpenses = Number(expAgg.total);
  const totalOtherIncome = Number(incAgg.total);
  const totalShareholderWithdrawals = Number(shrWithdrawAgg.total);

  const cashIn = totalSalesRevenue + totalCustomerPayments + totalOtherIncome;
  const cashOut = totalPurchasesPaid + totalSupplierPayments + totalPayroll + totalExpenses + totalShareholderWithdrawals;

  res.json({
    fromDate: fromDate ?? null,
    toDate: toDate ?? null,
    totalSalesRevenue,
    totalCustomerPayments,
    totalPurchasesPaid,
    totalSupplierPayments,
    totalPayroll,
    totalExpenses,
    totalOtherIncome,
    totalShareholderWithdrawals,
    cashIn,
    cashOut,
    netCash: cashIn - cashOut,
    totalCustomerDebt: Number(custDebtAgg.total),
    totalSupplierDebt: Number(suppDebtAgg.total),
    latestExchangeRate: latestRate ? Number(latestRate.rate) : null,
  });
});

router.get("/cashbox/monthly-report", async (req, res): Promise<void> => {
  const qp = GetMonthlyReportQueryParams.safeParse(req.query);
  const now = new Date();
  const year = (qp.success && qp.data.year) ? qp.data.year : now.getFullYear();
  const month = (qp.success && qp.data.month) ? qp.data.month : String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `${year}-${String(month).padStart(2, "0")}`;

  const [salesAgg] = await db.select({ total: sql<string>`coalesce(sum(total), 0)` }).from(salesInvoicesTable).where(and(eq(salesInvoicesTable.isDeleted, false), sql`invoice_date like ${prefix + "%"}`));
  const [purchAgg] = await db.select({ total: sql<string>`coalesce(sum(total_iqd), 0)` }).from(purchaseInvoicesTable).where(and(eq(purchaseInvoicesTable.isDeleted, false), sql`invoice_date like ${prefix + "%"}`));
  const [expAgg] = await db.select({ total: sql<string>`coalesce(sum(amount), 0)` }).from(expensesTable).where(sql`expense_date like ${prefix + "%"}`);
  const [payrollAgg] = await db.select({ total: sql<string>`coalesce(sum(total_due), 0)` }).from(payrollEntriesTable).where(sql`period like ${prefix + "%"}`);
  const [incAgg] = await db.select({ total: sql<string>`coalesce(sum(amount), 0)` }).from(incomesTable).where(sql`income_date like ${prefix + "%"}`);
  const [shrAgg] = await db.select({ total: sql<string>`coalesce(sum(amount), 0)` }).from(shareholderTransactionsTable).where(and(eq(shareholderTransactionsTable.type, "withdrawal"), sql`transaction_date like ${prefix + "%"}`));

  const [salesCashAgg] = await db.select({ total: sql<string>`coalesce(sum(paid_amount), 0)` }).from(salesInvoicesTable).where(and(eq(salesInvoicesTable.isDeleted, false), sql`invoice_date like ${prefix + "%"}`));
  const [purchCashAgg] = await db.select({ total: sql<string>`coalesce(sum(paid_amount_iqd), 0)` }).from(purchaseInvoicesTable).where(and(eq(purchaseInvoicesTable.isDeleted, false), sql`invoice_date like ${prefix + "%"}`));

  const totalSales = Number(salesAgg.total);
  const totalPurchases = Number(purchAgg.total);
  const totalExpenses = Number(expAgg.total);
  const totalPayroll = Number(payrollAgg.total);
  const totalOtherIncome = Number(incAgg.total);
  const totalShareholderWithdrawals = Number(shrAgg.total);
  const grossProfit = totalSales - totalPurchases;
  const netProfit = grossProfit - totalExpenses - totalPayroll + totalOtherIncome;
  const cashIn = Number(salesCashAgg.total) + totalOtherIncome;
  const cashOut = Number(purchCashAgg.total) + totalExpenses + totalPayroll + totalShareholderWithdrawals;

  res.json({
    month: String(month).padStart(2, "0"),
    year,
    totalSales,
    totalPurchases,
    totalExpenses,
    totalPayroll,
    totalOtherIncome,
    totalShareholderWithdrawals,
    grossProfit,
    netProfit,
    cashIn,
    cashOut,
    netCash: cashIn - cashOut,
  });
});

router.get("/cashbox/profit-loss", async (req, res): Promise<void> => {
  const qp = GetProfitLossReportQueryParams.safeParse(req.query);
  const fromDate = qp.success ? qp.data.fromDate : undefined;
  const toDate = qp.success ? qp.data.toDate : undefined;

  // Parameterized date-range filter (no string interpolation → safe from SQL injection).
  const dateRange = <C extends { name: string }>(col: C) => {
    const parts = [];
    if (fromDate) parts.push(gte(col as any, fromDate));
    if (toDate) parts.push(lte(col as any, toDate));
    return parts;
  };

  const [salesAgg] = await db
    .select({ total: sql<string>`coalesce(sum(${salesInvoicesTable.total}), 0)` })
    .from(salesInvoicesTable)
    .where(and(eq(salesInvoicesTable.isDeleted, false), ...dateRange(salesInvoicesTable.invoiceDate)));

  // Cost of Goods Sold = sum over each sales line item of (quantity × material.purchase_price).
  // This is the actual production cost of bricks sold during the period (standard manufacturing P&L cost).
  // Use LEFT JOIN to materials so sold lines with NULL/missing material_id are visible (counted as zero cost
  // here but surfaced via cogsMissingCount so the user knows COGS may be understated).
  const [cogsAgg] = await db
    .select({
      total: sql<string>`coalesce(sum(${salesInvoiceItemsTable.quantity} * coalesce(${materialsTable.purchasePrice}, 0)), 0)`,
      missingCount: sql<string>`coalesce(sum(case when ${materialsTable.purchasePrice} is null then 1 else 0 end), 0)`,
      missingRevenue: sql<string>`coalesce(sum(case when ${materialsTable.purchasePrice} is null then ${salesInvoiceItemsTable.total} else 0 end), 0)`,
    })
    .from(salesInvoiceItemsTable)
    .innerJoin(salesInvoicesTable, eq(salesInvoiceItemsTable.invoiceId, salesInvoicesTable.id))
    .leftJoin(materialsTable, eq(salesInvoiceItemsTable.materialId, materialsTable.id))
    .where(and(eq(salesInvoicesTable.isDeleted, false), ...dateRange(salesInvoicesTable.invoiceDate)));

  const [purchAgg] = await db
    .select({ total: sql<string>`coalesce(sum(${purchaseInvoicesTable.totalIqd}), 0)` })
    .from(purchaseInvoicesTable)
    .where(and(eq(purchaseInvoicesTable.isDeleted, false), ...dateRange(purchaseInvoicesTable.invoiceDate)));

  const [expAgg] = await db
    .select({ total: sql<string>`coalesce(sum(${expensesTable.amount}), 0)` })
    .from(expensesTable)
    .where(and(...dateRange(expensesTable.expenseDate)));

  // Payroll period is "YYYY-MM"; filter using the YYYY-MM prefix derived from the date range (parameterized).
  const payrollFilters = [];
  if (fromDate) payrollFilters.push(gte(payrollEntriesTable.period, fromDate.slice(0, 7)));
  if (toDate) payrollFilters.push(lte(payrollEntriesTable.period, toDate.slice(0, 7)));
  const [payrollAgg] = await db
    .select({ total: sql<string>`coalesce(sum(${payrollEntriesTable.totalDue}), 0)` })
    .from(payrollEntriesTable)
    .where(payrollFilters.length > 0 ? and(...payrollFilters) : undefined);

  const [incAgg] = await db
    .select({ total: sql<string>`coalesce(sum(${incomesTable.amount}), 0)` })
    .from(incomesTable)
    .where(and(...dateRange(incomesTable.incomeDate)));

  const [shrAgg] = await db
    .select({ total: sql<string>`coalesce(sum(${shareholderTransactionsTable.amount}), 0)` })
    .from(shareholderTransactionsTable)
    .where(and(eq(shareholderTransactionsTable.type, "withdrawal"), ...dateRange(shareholderTransactionsTable.transactionDate)));
  const shareholders = await db.select().from(shareholdersTable).where(eq(shareholdersTable.isActive, true));

  const totalRevenue = Number(salesAgg.total);
  // Use COGS (cost of goods sold from sales line items × material price) as the production cost.
  // This is the correct manufacturing P&L cost — purchase invoices represent inventory acquisition, not COGS.
  const totalCost = Number(cogsAgg.total);
  const cogsMissingCount = Number(cogsAgg.missingCount);
  const cogsMissingRevenue = Number(cogsAgg.missingRevenue);
  const totalPurchases = Number(purchAgg.total);
  const grossProfit = totalRevenue - totalCost;
  const totalExpenses = Number(expAgg.total);
  const totalPayroll = Number(payrollAgg.total);
  const otherIncome = Number(incAgg.total);
  const shareholderWithdrawals = Number(shrAgg.total);
  const netProfit = grossProfit - totalExpenses - totalPayroll + otherIncome;

  const breakdown = shareholders.map((s) => ({
    shareholderName: s.name,
    sharePercentage: Number(s.sharePercentage),
    profitShare: (netProfit * Number(s.sharePercentage)) / 100,
  }));

  res.json({
    fromDate: fromDate ?? null,
    toDate: toDate ?? null,
    totalRevenue,
    totalCost,
    totalPurchases,
    cogsMissingCount,
    cogsMissingRevenue,
    grossProfit,
    totalExpenses,
    totalPayroll,
    otherIncome,
    shareholderWithdrawals,
    netProfit,
    profitByShareholdersBreakdown: breakdown,
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Daily / period cashbox close-out — mirrors the user's worksheet structure:
//   1. IQD sales section (gross, discount, net, cash received split by voucher type, debt remaining)
//   2. IQD expenses section (purchases in IQD with same fields)
//   3. USD expenses section (purchases in USD with FX → IQD)
//   4. Combined expenses (IQD purchases + USD-as-IQD purchases + payroll)
//   5. Result block (revenue−cost, cashIn−cashOut, debtIn−debtOut)
//   6. Shareholder distribution (totalShares = 100, perShareValue = profit/totalShares)
// ────────────────────────────────────────────────────────────────────────────
router.get("/cashbox/closing", async (req, res): Promise<void> => {
  const fromDate = typeof req.query.fromDate === "string" ? req.query.fromDate : undefined;
  const toDate = typeof req.query.toDate === "string" ? req.query.toDate : undefined;

  const dateRange = <C extends { name: string }>(col: C) => {
    const parts = [];
    if (fromDate) parts.push(gte(col as any, fromDate));
    if (toDate) parts.push(lte(col as any, toDate));
    return parts;
  };

  // ── 1. IQD SALES ──────────────────────────────────────────────────────────
  const [salesAgg] = await db
    .select({
      gross: sql<string>`coalesce(sum(${salesInvoicesTable.subtotal}), 0)`,
      discount: sql<string>`coalesce(sum(${salesInvoicesTable.discount}), 0)`,
      net: sql<string>`coalesce(sum(${salesInvoicesTable.total}), 0)`,
    })
    .from(salesInvoicesTable)
    .where(and(eq(salesInvoicesTable.isDeleted, false), ...dateRange(salesInvoicesTable.invoiceDate)));

  // Customer payments (= cash received from sales) split by voucher type
  const [custPayCash] = await db
    .select({ total: sql<string>`coalesce(sum(${customerPaymentsTable.amount}), 0)` })
    .from(customerPaymentsTable)
    .where(and(eq(customerPaymentsTable.voucherType, "cash"), ...dateRange(customerPaymentsTable.paymentDate)));
  const [custPayInternal] = await db
    .select({ total: sql<string>`coalesce(sum(${customerPaymentsTable.amount}), 0)` })
    .from(customerPaymentsTable)
    .where(and(eq(customerPaymentsTable.voucherType, "internal"), ...dateRange(customerPaymentsTable.paymentDate)));

  // ── 2. IQD PURCHASES (suppliers in IQD) ───────────────────────────────────
  const [purchIqdAgg] = await db
    .select({
      gross: sql<string>`coalesce(sum(${purchaseInvoicesTable.subtotalIqd}), 0)`,
      discount: sql<string>`coalesce(sum(${purchaseInvoicesTable.discount}), 0)`,
      net: sql<string>`coalesce(sum(${purchaseInvoicesTable.totalIqd}), 0)`,
    })
    .from(purchaseInvoicesTable)
    .where(and(eq(purchaseInvoicesTable.isDeleted, false), eq(purchaseInvoicesTable.currency, "IQD"), ...dateRange(purchaseInvoicesTable.invoiceDate)));
  const [suppPayIqdCash] = await db
    .select({ total: sql<string>`coalesce(sum(${supplierPaymentsTable.amountIqd}), 0)` })
    .from(supplierPaymentsTable)
    .where(and(eq(supplierPaymentsTable.currency, "IQD"), eq(supplierPaymentsTable.voucherType, "cash"), ...dateRange(supplierPaymentsTable.paymentDate)));
  const [suppPayIqdInternal] = await db
    .select({ total: sql<string>`coalesce(sum(${supplierPaymentsTable.amountIqd}), 0)` })
    .from(supplierPaymentsTable)
    .where(and(eq(supplierPaymentsTable.currency, "IQD"), eq(supplierPaymentsTable.voucherType, "internal"), ...dateRange(supplierPaymentsTable.paymentDate)));

  // ── 3. USD PURCHASES (suppliers in USD) ───────────────────────────────────
  const [purchUsdAgg] = await db
    .select({
      grossUsd: sql<string>`coalesce(sum(${purchaseInvoicesTable.subtotal}), 0)`,
      discountUsd: sql<string>`coalesce(sum(${purchaseInvoicesTable.discount}), 0)`,
      netUsd: sql<string>`coalesce(sum(${purchaseInvoicesTable.total}), 0)`,
      netIqd: sql<string>`coalesce(sum(${purchaseInvoicesTable.totalIqd}), 0)`,
      avgRate: sql<string>`coalesce(avg(${purchaseInvoicesTable.exchangeRateValue}), 0)`,
    })
    .from(purchaseInvoicesTable)
    .where(and(eq(purchaseInvoicesTable.isDeleted, false), eq(purchaseInvoicesTable.currency, "USD"), ...dateRange(purchaseInvoicesTable.invoiceDate)));
  const [suppPayUsdCash] = await db
    .select({
      totalUsd: sql<string>`coalesce(sum(${supplierPaymentsTable.amount}), 0)`,
      totalIqd: sql<string>`coalesce(sum(${supplierPaymentsTable.amountIqd}), 0)`,
    })
    .from(supplierPaymentsTable)
    .where(and(eq(supplierPaymentsTable.currency, "USD"), eq(supplierPaymentsTable.voucherType, "cash"), ...dateRange(supplierPaymentsTable.paymentDate)));
  const [suppPayUsdInternal] = await db
    .select({
      totalUsd: sql<string>`coalesce(sum(${supplierPaymentsTable.amount}), 0)`,
      totalIqd: sql<string>`coalesce(sum(${supplierPaymentsTable.amountIqd}), 0)`,
    })
    .from(supplierPaymentsTable)
    .where(and(eq(supplierPaymentsTable.currency, "USD"), eq(supplierPaymentsTable.voucherType, "internal"), ...dateRange(supplierPaymentsTable.paymentDate)));

  // ── 4. PAYROLL ────────────────────────────────────────────────────────────
  // For cash-flow accuracy on daily/range close-out, filter by paymentDate
  // (the actual day money left the cashbox). Period-based accrual is shown
  // only on the dedicated payroll page, not here.
  const payrollFilters = [];
  if (fromDate) payrollFilters.push(gte(payrollEntriesTable.paymentDate, fromDate));
  if (toDate) payrollFilters.push(lte(payrollEntriesTable.paymentDate, toDate));
  const [payrollAgg] = await db
    .select({
      due: sql<string>`coalesce(sum(${payrollEntriesTable.totalDue}), 0)`,
      paid: sql<string>`coalesce(sum(${payrollEntriesTable.paidAmount}), 0)`,
    })
    .from(payrollEntriesTable)
    .where(payrollFilters.length > 0 ? and(...payrollFilters) : undefined);

  // ── 5. OTHER EXPENSES (general expenses) ──────────────────────────────────
  const [expensesAgg] = await db
    .select({ total: sql<string>`coalesce(sum(${expensesTable.amount}), 0)` })
    .from(expensesTable)
    .where(and(...dateRange(expensesTable.expenseDate)));

  // ── 6. SHAREHOLDERS (with shareCount) ─────────────────────────────────────
  const shareholders = await db.select().from(shareholdersTable).where(eq(shareholdersTable.isActive, true));

  // Latest exchange rate (for displaying "today's rate")
  const [latestRate] = await db.select().from(exchangeRatesTable).orderBy(desc(exchangeRatesTable.rateDate)).limit(1);

  // ─── Build response ───────────────────────────────────────────────────────
  // Sales section (IQD)
  const salesGross = Number(salesAgg.gross);
  const salesDiscount = Number(salesAgg.discount);
  const salesNet = Number(salesAgg.net);
  const salesCashVoucher = Number(custPayCash.total);
  const salesInternalVoucher = Number(custPayInternal.total);
  const salesCashReceived = salesCashVoucher + salesInternalVoucher;
  const salesDebtRemaining = salesNet - salesCashReceived;

  // Purchases IQD section
  const purchIqdGross = Number(purchIqdAgg.gross);
  const purchIqdDiscount = Number(purchIqdAgg.discount);
  const purchIqdNet = Number(purchIqdAgg.net);
  const purchIqdCashVoucher = Number(suppPayIqdCash.total);
  const purchIqdInternalVoucher = Number(suppPayIqdInternal.total);
  const purchIqdCashPaid = purchIqdCashVoucher + purchIqdInternalVoucher;
  const purchIqdDebtRemaining = purchIqdNet - purchIqdCashPaid;

  // Purchases USD section (USD amounts + IQD-equivalent for combined math)
  const purchUsdGrossUsd = Number(purchUsdAgg.grossUsd);
  const purchUsdDiscountUsd = Number(purchUsdAgg.discountUsd);
  const purchUsdNetUsd = Number(purchUsdAgg.netUsd);
  const purchUsdNetIqd = Number(purchUsdAgg.netIqd);
  const purchUsdRate = Number(purchUsdAgg.avgRate) || (latestRate ? Number(latestRate.rate) : 1500);
  const purchUsdCashUsd = Number(suppPayUsdCash.totalUsd);
  const purchUsdCashIqd = Number(suppPayUsdCash.totalIqd);
  const purchUsdInternalUsd = Number(suppPayUsdInternal.totalUsd);
  const purchUsdInternalIqd = Number(suppPayUsdInternal.totalIqd);
  const purchUsdCashPaidUsd = purchUsdCashUsd + purchUsdInternalUsd;
  const purchUsdCashPaidIqd = purchUsdCashIqd + purchUsdInternalIqd;
  const purchUsdDebtUsd = purchUsdNetUsd - purchUsdCashPaidUsd;
  const purchUsdDebtIqd = purchUsdNetIqd - purchUsdCashPaidIqd;

  // Payroll
  const payrollDue = Number(payrollAgg.due);
  const payrollPaid = Number(payrollAgg.paid);
  const payrollDebt = payrollDue - payrollPaid;

  // Other expenses (general expenses table — typically already cash, but treat as fully paid)
  const otherExpenses = Number(expensesAgg.total);

  // ── Combined expense totals (in IQD) ──
  const totalExpensesAll = purchIqdNet + purchUsdNetIqd + payrollDue + otherExpenses;
  const totalCashPaidAll = purchIqdCashPaid + purchUsdCashPaidIqd + payrollPaid + otherExpenses;
  const totalDebtPayable = totalExpensesAll - totalCashPaidAll;

  // ── Result block ──
  const profit = salesNet - totalExpensesAll; // فروش − مصرف
  const cashFlow = salesCashReceived - totalCashPaidAll; // واصلكراو − واصل
  const netDebtChange = salesDebtRemaining - totalDebtPayable; // باقی − باقی

  // ── Shareholder distribution ──
  const totalShares = 100;
  const perShareValue = profit / totalShares;
  const shareholdersBreakdown = shareholders.map((s) => {
    const shareCount = Number(s.shareCount ?? 0);
    return {
      id: s.id,
      name: s.name,
      shareCount,
      sharePercentage: Number(s.sharePercentage),
      profitShare: perShareValue * shareCount,
    };
  });

  res.json({
    fromDate: fromDate ?? null,
    toDate: toDate ?? null,
    sales: {
      gross: salesGross,
      discount: salesDiscount,
      net: salesNet,
      cashReceivedTotal: salesCashReceived,
      cashReceivedCashVoucher: salesCashVoucher,
      cashReceivedInternalVoucher: salesInternalVoucher,
      debtRemaining: salesDebtRemaining,
    },
    purchasesIqd: {
      gross: purchIqdGross,
      discount: purchIqdDiscount,
      net: purchIqdNet,
      cashPaidTotal: purchIqdCashPaid,
      cashPaidCashVoucher: purchIqdCashVoucher,
      cashPaidInternalVoucher: purchIqdInternalVoucher,
      debtRemaining: purchIqdDebtRemaining,
    },
    purchasesUsd: {
      rate: purchUsdRate,
      grossUsd: purchUsdGrossUsd,
      discountUsd: purchUsdDiscountUsd,
      netUsd: purchUsdNetUsd,
      netIqd: purchUsdNetIqd,
      cashPaidUsd: purchUsdCashPaidUsd,
      cashPaidIqd: purchUsdCashPaidIqd,
      cashPaidCashVoucherUsd: purchUsdCashUsd,
      cashPaidInternalVoucherUsd: purchUsdInternalUsd,
      debtRemainingUsd: purchUsdDebtUsd,
      debtRemainingIqd: purchUsdDebtIqd,
    },
    payroll: { due: payrollDue, paid: payrollPaid, debt: payrollDebt },
    otherExpenses,
    combined: {
      totalExpenses: totalExpensesAll,
      totalCashPaid: totalCashPaidAll,
      totalDebtPayable,
    },
    result: {
      profit,
      cashFlow,
      netDebtChange,
    },
    shareholders: {
      totalShares,
      perShareValue,
      breakdown: shareholdersBreakdown,
    },
    latestExchangeRate: latestRate ? Number(latestRate.rate) : null,
  });
});

export default router;
