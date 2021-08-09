import Dexie from "dexie";

export function buildDb(onUpgrade: () => void) {

  const db = new Dexie('d2armorpicker-v2');

// Declare tables, IDs and indexes
  db.version(9).stores({
    manifestArmor: 'id++, hash, name, icon, slot, isExotic, clazz, armor2',
    inventoryArmor: 'id++, itemInstanceId, hash, name, masterworked, slot, isExotic, clazz, armor2, mobility, resilience, recovery, discipline, intellect, strength, energyAffinity'
  }).upgrade(async tx => {
    await onUpgrade();
  });

  return db;
}
