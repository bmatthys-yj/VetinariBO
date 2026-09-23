import { DatabaseSync } from "node:sqlite";
import {
  CompiledQuery,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type DialectAdapter,
  type Driver,
  type Kysely,
  type QueryCompiler,
  type QueryResult,
} from "kysely";

/** Values `node:sqlite` accepts when binding statement parameters. */
type SqliteParameter = null | number | bigint | string | Uint8Array;

/** Query node kinds that report affected rows instead of returning them. */
const MUTATION_KINDS = new Set([
  "InsertQueryNode",
  "UpdateQueryNode",
  "DeleteQueryNode",
  "MergeQueryNode",
]);

/**
 * `node:sqlite` binds a narrower set of values than Kysely emits. Booleans
 * become SQLite integers and dates become ISO strings so query authors can use
 * natural TypeScript values.
 */
function toSqliteParameter(value: unknown): SqliteParameter {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "string") {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return value;
  return JSON.stringify(value);
}

/** Whether the compiled query yields rows, including `returning` mutations. */
function returnsRows(compiledQuery: CompiledQuery): boolean {
  const node = compiledQuery.query as { kind: string; returning?: unknown };
  if (!MUTATION_KINDS.has(node.kind)) return true;
  return node.returning !== undefined;
}

/**
 * Serializes access to the single synchronous SQLite handle so overlapping
 * awaits cannot interleave inside a transaction.
 */
class ConnectionMutex {
  #promise: Promise<void> | undefined;
  #resolve: (() => void) | undefined;

  async lock(): Promise<void> {
    while (this.#promise) await this.#promise;
    this.#promise = new Promise((resolve) => {
      this.#resolve = resolve;
    });
  }

  unlock(): void {
    const resolve = this.#resolve;
    this.#promise = undefined;
    this.#resolve = undefined;
    resolve?.();
  }
}

class NodeSqliteConnection implements DatabaseConnection {
  readonly #database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.#database = database;
  }

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const statement = this.#database.prepare(compiledQuery.sql);
    const parameters = compiledQuery.parameters.map(toSqliteParameter);
    if (returnsRows(compiledQuery)) {
      return { rows: statement.all(...parameters) as R[] };
    }
    const { changes, lastInsertRowid } = statement.run(...parameters);
    return {
      rows: [],
      numAffectedRows: BigInt(changes),
      insertId: BigInt(lastInsertRowid),
    };
  }

  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("The node:sqlite dialect does not support streaming queries.");
  }
}

class NodeSqliteDriver implements Driver {
  readonly #file: string;
  readonly #mutex = new ConnectionMutex();
  #database: DatabaseSync | undefined;
  #connection: DatabaseConnection | undefined;

  constructor(file: string) {
    this.#file = file;
  }

  async init(): Promise<void> {
    const database = new DatabaseSync(this.#file);
    database.exec("pragma journal_mode = wal");
    database.exec("pragma foreign_keys = on");
    this.#database = database;
    this.#connection = new NodeSqliteConnection(database);
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    await this.#mutex.lock();
    if (!this.#connection) {
      this.#mutex.unlock();
      throw new Error("The node:sqlite driver was not initialized.");
    }
    return this.#connection;
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("begin"));
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("commit"));
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("rollback"));
  }

  async releaseConnection(): Promise<void> {
    this.#mutex.unlock();
  }

  async destroy(): Promise<void> {
    this.#database?.close();
    this.#database = undefined;
    this.#connection = undefined;
  }
}

/**
 * A Kysely dialect backed by Node's built-in `node:sqlite` module.
 *
 * Using the platform driver keeps the backoffice database a single local file
 * with no native compilation step, while leaving the Kysely query layer the
 * same one Vetinari uses against PostgreSQL.
 */
export class NodeSqliteDialect implements Dialect {
  readonly #file: string;

  constructor(file: string) {
    this.#file = file;
  }

  createDriver(): Driver {
    return new NodeSqliteDriver(this.#file);
  }

  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler();
  }

  createAdapter(): DialectAdapter {
    return new SqliteAdapter();
  }

  // Kysely's `Dialect` declares this parameter as `Kysely<any>`; the
  // introspector is schema-agnostic, so the signature has to match exactly.
  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new SqliteIntrospector(db);
  }
}
