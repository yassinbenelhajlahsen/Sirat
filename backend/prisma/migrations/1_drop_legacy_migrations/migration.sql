-- The custom SQL runner's bookkeeping table is replaced by Prisma's
-- _prisma_migrations. Drop the orphan. No-op on fresh databases.
DROP TABLE IF EXISTS "_migrations";
