import { db } from "./db";
 
const LOCK_DURATION_DAYS = 5;
const DEVICE_COOKIE = "spark_device";

// -----------------------------------------------------------------------
// Rappel honnête (comme discuté à l'oral) : ce blocage repose sur un cookie,
// donc quelqu'un qui efface ses cookies ou navigue en privé peut le
// contourner. Ce n'est PAS un verrou infranchissable — c'est une protection
// basique contre l'abus involontaire ou répété, pas contre un utilisateur
// technique déterminé à la contourner.
// -----------------------------------------------------------------------

export function getOrCreateDeviceId(
  cookieValue: string | undefined
): { deviceId: string; isNew: boolean } {
  if (cookieValue) return { deviceId: cookieValue, isNew: false };
  const deviceId = crypto.randomUUID();
  return { deviceId, isNew: true };
}

export async function isDeviceLocked(deviceId: string): Promise<boolean> {
  const lock = await db.deviceLock.findUnique({ where: { deviceHash: deviceId } });
  if (!lock) return false;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOCK_DURATION_DAYS);

  return lock.lastUsedAt > cutoff;
}

// Le blocage se déclenche dès le clic sur "Analyser", pas seulement si
// l'utilisateur va au bout du parcours — décision prise avec Raphaël.
export async function registerDeviceUsage(deviceId: string): Promise<void> {
  await db.deviceLock.upsert({
    where: { deviceHash: deviceId },
    update: { lastUsedAt: new Date() },
    create: { deviceHash: deviceId, lastUsedAt: new Date() },
  });
}

export { DEVICE_COOKIE };
