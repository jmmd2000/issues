import { wipeDatabase } from "../db/wipe";

wipeDatabase()
  .then(tableCount => {
    console.log(`Emptied ${tableCount} tables.`);
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
