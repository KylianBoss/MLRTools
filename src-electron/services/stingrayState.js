/**
 * Applique un changement d'état à un stingray, et répercute ce changement
 * sur sa position si le nouvel état implique une sortie d'allée.
 *
 * Utilisé à la fois par la création d'intervention liée à un stingray
 * (POST /interventions/journal) et par la modification directe d'un
 * stingray (PATCH /stingrays/:id).
 *
 * @param {object} db - Instance de la DB (getDB())
 * @param {object} params
 * @param {number} params.stingrayId
 * @param {"in_service"|"maintenance"|"out_of_service"|"spare"} params.newState
 * @param {number|null} [params.changedBy] - userId à l'origine du changement
 * @param {Date|string} [params.at] - date à utiliser pour movedAt (défaut: maintenant)
 * @returns {Promise<object>} le stingray mis à jour (instance Sequelize)
 */
export const applyStingrayStateChange = async (
  db,
  { stingrayId, newState, changedBy = null, at = new Date() }
) => {
  const stingray = await db.models.Stingray.findByPk(stingrayId);
  if (!stingray) {
    throw new Error(`Stingray ${stingrayId} not found`);
  }

  await stingray.update({ state: newState });

  // Un changement d'état vers maintenance/hors service/spare sort le
  // stingray de son allée, si une position en allée est actuellement active.
  const leavesAisle = ["maintenance", "out_of_service", "spare"].includes(
    newState
  );

  if (leavesAisle && stingray.currentAisleId) {
    // Libellés alignés avec le select "Emplacement" de StingrayDetails.vue
    const locationLabel =
      newState === "maintenance"
        ? "Maintenance stingray"
        : newState === "spare"
        ? "Stock"
        : "TGW";

    await db.models.StingrayPositionHistory.create({
      stingrayId: stingray.id,
      aisleId: null,
      floor: null,
      locationLabel,
      movedAt: at,
      movedBy: changedBy,
    });

    await stingray.update({
      currentAisleId: null,
      currentFloor: null,
      currentLocationLabel: locationLabel,
    });
  }

  return stingray;
};
