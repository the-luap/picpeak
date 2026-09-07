/**
 * `external_import_exclusions` — files an admin deleted from a reference
 * event, so the folder watcher (issue 1187) does not bring them back.
 *
 * Deleting an external photo removes its row but leaves the NAS original
 * alone (resolvePhotoStorageKey returns null for external rows, on purpose).
 * The manual Import only ran when an admin pressed it, so the deleted file
 * came back only if they asked. The watcher runs on its own, and a full pass
 * that skips only rows the event still has would re-import every deleted
 * photo on the next sweep — republishing what an admin removed, without any
 * new file arriving.
 *
 * One row per (event, root-relative path). Automatic passes skip these; the
 * manual Import button ignores the list and clears the rows for whatever it
 * imports, since pressing it is the explicit intent the exclusion exists to
 * protect.
 */

exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('external_import_exclusions'))) {
    await knex.schema.createTable('external_import_exclusions', (t) => {
      t.increments('id').primary();
      t.integer('event_id').notNullable().references('id').inTable('events').onDelete('CASCADE');
      // Same shape as photos.external_relpath: relative to EXTERNAL_MEDIA_ROOT.
      t.text('external_relpath').notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.unique(['event_id', 'external_relpath'], { indexName: 'external_import_exclusions_event_relpath_unique' });
    });
    console.log('209: created external_import_exclusions');
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('external_import_exclusions');
};
