declare module 'better-sqlite3' {
  interface Statement {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    get<T = unknown>(...params: unknown[]): T;
    all<T = unknown>(...params: unknown[]): T[];
  }

  interface Transaction {
    (): void;
  }

  class Database {
    constructor(filename: string);
    pragma(source: string): unknown;
    exec(source: string): void;
    prepare(source: string): Statement;
    transaction(fn: () => void): Transaction;
  }

  namespace Database {
    type Database = import('better-sqlite3').Database;
  }

  export = Database;
}
