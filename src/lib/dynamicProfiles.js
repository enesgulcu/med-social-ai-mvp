import prisma from './prisma';

/**
 * Helper service to manage per-user, per-sector dynamic profiles.
 * This keeps existing DoctorProfile / ContentDNA intact and provides
 * a flexible place to store user-driven templates, visual prefs, tones, and
 * other dynamic configuration that can be used by AI prompt generation.
 */

export async function getDynamicProfilesForUser(userId) {
  if (!userId) return [];
  try {
    const profiles = await prisma.dynamicProfile.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return profiles || [];
  } catch (e) {
    console.error('getDynamicProfilesForUser error:', e);
    return [];
  }
}

export async function getActiveDynamicProfile(userId, sector = 'general') {
  if (!userId) return null;
  try {
    const profile = await prisma.dynamicProfile.findFirst({
      where: { userId, sector },
      orderBy: { updatedAt: 'desc' },
    });
    return profile || null;
  } catch (e) {
    console.error('getActiveDynamicProfile error:', e);
    return null;
  }
}

export async function upsertDynamicProfile({ userId, sector = 'general', name, purpose, preferences = {} }) {
  if (!userId) throw new Error('userId required');
  try {
    // If existing profile for same user+sector, update; otherwise create
    const existing = await prisma.dynamicProfile.findFirst({ where: { userId, sector } });
    if (existing) {
      return await prisma.dynamicProfile.update({
        where: { id: existing.id },
        data: { name, purpose, preferences },
      });
    }
    return await prisma.dynamicProfile.create({
      data: { userId, sector, name, purpose, preferences },
    });
  } catch (e) {
    console.error('upsertDynamicProfile error:', e);
    throw e;
  }
}

export async function deleteDynamicProfile(profileId) {
  try {
    return await prisma.dynamicProfile.delete({ where: { id: profileId } });
  } catch (e) {
    console.error('deleteDynamicProfile error:', e);
    throw e;
  }
}
