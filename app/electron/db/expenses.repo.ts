import { isMySqlEnabled } from './dbRouter';

// SQLite fallback
import { addExpense, listExpenses } from './queries';

// MySQL
import { addExpenseMySql, listExpensesMySql } from './mysql/expenses.mysql';

export const addExpenseRepo = async (payloadOrExpense: any): Promise<string> => {
  // ✅ acepta cualquiera:
  // - addExpenseRepo({ expense: {...}, userId, ... })
  // - addExpenseRepo({ date, concept, amount, ... })
  const expense = (payloadOrExpense as any)?.expense ?? payloadOrExpense;

  if (isMySqlEnabled()) {
    return await addExpenseMySql(expense);
  }

  return await addExpense(expense);
};

export const listExpensesRepo = async (from: string, to: string): Promise<any[]> => {
  if (isMySqlEnabled()) {
    const rows = await listExpensesMySql(from, to);
    return Array.isArray(rows) ? rows : [];
  }

  const rows = await listExpenses(from, to);
  return Array.isArray(rows) ? (rows as any[]) : [];
};