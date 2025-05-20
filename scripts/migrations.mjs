export async function migrate() {
  const sortedMigrations = Object.entries(migrations).sort((a, b) => {
    return foundry.utils.isNewerVersion(b[0], a[0]) ? -1 : 1;
  });
  const migrationVersion = game.settings.get("auraeffects", "migrationVersion");
  let existingAlert;
  for (const [version, migration] of sortedMigrations) {
    if (!foundry.utils.isNewerVersion(version, migrationVersion)) continue;
    if (!existingAlert) existingAlert = ui.notifications.info("AURAEFFECTS.Migrations.Beginning", { permanent: true, localize: true });
    await migration();
    await game.settings.set("auraeffects", "migrationVersion", version);
  }
  if (existingAlert) {
    existingAlert.remove();
    ui.notifications.success("AURAEFFECTS.Migrations.AllCompleted", { localize: true });
  }
}
const migrations = {}