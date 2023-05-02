import Dexie from "dexie";

export function buildDb(onUpgrade: () => void) {
    const db = new Dexie("d2armorpicker-v2");

    // Declare tables, IDs and indexes
    db.version(19)
        .stores({
            manifestArmor: "id++, hash, isExotic",
            inventoryArmor: "id++, itemInstanceId, isExotic, hash, name, masterworked, clazz, slot",
        })
        .upgrade(async (tx) => {
            await onUpgrade();
        });

    return db;
}
