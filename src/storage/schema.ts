/**
 * Schema versioning and migration utilities
 */

export type SchemaVersion = '1.0.0' | '1.1.0' | '2.0.0';

export const CURRENT_SCHEMA_VERSION: SchemaVersion = '2.0.0';

/**
 * Base interface for all versioned stores
 */
export interface VersionedStore {
  version: SchemaVersion;
  lastUpdated: string;
}

/**
 * Migration function type
 */
export type MigrationFn<T> = (store: T) => T;

/**
 * Migration registry
 */
export interface MigrationRegistry<T> {
  '1.0.0_to_1.1.0'?: MigrationFn<T>;
  '1.1.0_to_2.0.0'?: MigrationFn<T>;
}

/**
 * Apply migrations to bring store to current version
 */
export function migrateStore<T extends VersionedStore>(
  store: T,
  migrations: MigrationRegistry<T>
): T {
  let currentStore = store;

  // Migration path
  const migrationPath: Array<keyof MigrationRegistry<T>> = [
    '1.0.0_to_1.1.0',
    '1.1.0_to_2.0.0',
  ];

  for (const migrationKey of migrationPath) {
    const [fromVersion] = (migrationKey as string).split('_to_');

    if (currentStore.version === fromVersion) {
      const migration = migrations[migrationKey];
      if (migration) {
        currentStore = migration(currentStore);
      }
    }
  }

  return currentStore;
}

/**
 * Check if store needs migration
 */
export function needsMigration(store: VersionedStore): boolean {
  return store.version !== CURRENT_SCHEMA_VERSION;
}
