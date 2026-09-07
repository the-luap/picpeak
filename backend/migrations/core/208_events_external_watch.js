/**
 * `events.external_watch` — per-event opt-in for the external-media folder
 * watcher (issue 1187).
 *
 * Managed uploads are picked up by fileWatcher.js as soon as they land in
 * storage/events/active. A reference-mode event has no equivalent: new files
 * copied into its NAS folder sit there until an admin opens the event and
 * presses Import. services/externalMediaWatcher.js closes that gap for events
 * that ask for it.
 *
 * Opt-in per event rather than a global switch: every watched folder is a set
 * of inotify handles (or, on a mount that does not deliver events, a polling
 * stat of the whole tree), and a large install with hundreds of reference
 * events should not pay that for the ones nobody is still adding files to.
 *
 * Boolean with a false default so an existing install changes nothing on
 * upgrade — the column is read through formatBoolean() so SQLite's 0/1 and
 * Postgres' true/false both work.
 */

exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('events', 'external_watch'))) {
    await knex.schema.alterTable('events', (table) => {
      table.boolean('external_watch').notNullable().defaultTo(false);
    });
    console.log('208: added events.external_watch');
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('events', 'external_watch')) {
    await knex.schema.alterTable('events', (table) => {
      table.dropColumn('external_watch');
    });
  }
};
