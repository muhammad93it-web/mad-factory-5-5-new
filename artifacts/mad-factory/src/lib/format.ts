export const formatMoney = (amount: number | null | undefined, currency: 'IQD' | 'USD' = 'IQD') => {
  if (amount === null || amount === undefined) return currency === 'IQD' ? '0 د.ع' : '0 $';
  const numStr = new Intl.NumberFormat('en-US').format(amount);
  return currency === 'IQD' ? `${numStr} د.ع` : `${numStr} $`;
};

export const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return '-';
  return new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
};

export const formatNumber = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(amount);
};
