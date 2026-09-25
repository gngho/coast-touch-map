import {sqliteTable, text, integer, index, uniqueIndex} from 'drizzle-orm/sqlite-core';
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), owner: text('owner').notNull(),
  adminHash: text('admin_hash').notNull(), codeHash: text('code_hash'), codeExpires: integer('code_expires'),
  deviceHash: text('device_hash'), pageId: text('page_id'),
  state: text('state').notNull(), revision: integer('revision').notNull().default(0), mutation: text('mutation'),
  deviceSeen: integer('device_seen').notNull().default(0), adminSeen: integer('admin_seen').notNull().default(0),
  appliedGeneration: integer('applied_generation').notNull().default(-1), appliedTrial: text('applied_trial'),
  pendingEvents: integer('pending_events').notNull().default(0), createdAt: integer('created_at').notNull(),
}, t => [uniqueIndex('sessions_owner').on(t.owner), uniqueIndex('sessions_code').on(t.codeHash)]);
export const trials = sqliteTable('trials', {
  id: text('id').primaryKey(), sessionId: text('session_id').notNull().references(()=>sessions.id),
  number: integer('number').notNull(), participant: text('participant').notNull(), relationship: text('relationship').notNull(),
  intervention: text('intervention').notNull(), scenario: text('scenario').notNull(), appVersion: text('app_version').notNull(),
  status: text('status').notNull(), preparedAt: integer('prepared_at').notNull(), startedAt: integer('started_at'), endedAt: integer('ended_at'),
}, t => [uniqueIndex('trials_session_number').on(t.sessionId,t.number)]);
export const events = sqliteTable('events', {
  id: text('id').primaryKey(), sessionId: text('session_id').notNull().references(()=>sessions.id), trialId: text('trial_id'),
  type: text('type').notNull(), actor: text('actor').notNull(), serverTime: integer('server_time').notNull(),
  clientTime: text('client_time'), pageId: text('page_id'), generation: integer('generation'), payload: text('payload').notNull(),
}, t => [index('events_session_time').on(t.sessionId,t.serverTime), index('events_trial').on(t.trialId)]);
