import { Router } from "express";
import { db } from "../database.js";
import dayjs from "dayjs";
import { Op } from "sequelize";

const router = Router();

router.get("/count", async (req, res) => {
  const { from, to, includesExcluded = false } = req.query;

  if (!from || !to) {
    res.status(400).json({ error: "No dates provided" });
    return;
  }

  try {
    db.query(
      "CALL getKPICount(:from, :to, :dataSource, :includesExcluded, :limit)",
      {
        replacements: {
          from: dayjs(from + "00:00:00").format("YYYY-MM-DD HH:mm:ss"),
          to: dayjs(to + "23:59:59").format("YYYY-MM-DD HH:mm:ss"),
          dataSource: "*", // All zones
          includesExcluded,
          limit: 10,
        },
      }
    ).then((result) => {
      res.json(result);
    });
  } catch (error) {
    console.error("Error fetching KPI count:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/count/zone", async (req, res) => {
  const { from, to, includesExcluded = false, dataSource } = req.query;

  if (!from || !to) {
    res.status(400).json({ error: "No dates provided" });
    return;
  }

  try {
    db.query(
      "CALL getKPICount(:from, :to, :dataSource, :includesExcluded, :limit)",
      {
        replacements: {
          from: dayjs(from + "00:00:00").format("YYYY-MM-DD HH:mm:ss"),
          to: dayjs(to + "23:59:59").format("YYYY-MM-DD HH:mm:ss"),
          dataSource,
          includesExcluded,
          limit: 5,
        },
      }
    ).then((result) => {
      res.json(result);
    });
  } catch (error) {
    console.error("Error fetching KPI count:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/duration", async (req, res) => {
  const { from, to, includesExcluded = false } = req.query;

  if (!from || !to) {
    res.status(400).json({ error: "No dates provided" });
    return;
  }

  try {
    db.query(
      "CALL getKPIDuration(:from, :to, :dataSource, :includesExcluded, :limit)",
      {
        replacements: {
          from: dayjs(from + "00:00:00").format("YYYY-MM-DD HH:mm:ss"),
          to: dayjs(to + "23:59:59").format("YYYY-MM-DD HH:mm:ss"),
          dataSource: "*", // All zones
          includesExcluded,
          limit: 10,
        },
      }
    ).then((result) => {
      res.json(result);
    });
  } catch (error) {
    console.error("Error fetching KPI duration:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/resume", async (req, res) => {
  const { from, to, includesExcluded = false, dataSource } = req.query;

  if (!from || !to) {
    res.status(400).json({ error: "No dates provided" });
    return;
  }

  try {
    db.query("CALL getGroupedAlarms(:from, :to, :dataSource)", {
      replacements: {
        from: dayjs(from + "00:00:00").format("YYYY-MM-DD HH:mm:ss"),
        to: dayjs(to + "23:59:59").format("YYYY-MM-DD HH:mm:ss"),
        dataSource,
      },
    })
      .then((result) => {
        res.json(result);
      })
      .catch((error) => {
        console.error("Error fetching KPI resume:", error);
        res.status(500).json({ error: error.message });
      });
  } catch (error) {
    console.error("Error fetching KPI resume:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/groups", async (req, res) => {
  try {
    const groups = await db.models.ZoneGroups.findAll({
      attributes: ["zoneGroupName", "zones"],
    });

    if (!groups || groups.length === 0) {
      return res.status(404).json({ error: "No KPI groups found" });
    }

    const zones = await db.models.Zones.findAll({
      attributes: ["zone", "zoneDescription"],
    });

    const formattedGroups = groups.map((group) => {
      const zoneDetails = zones
        .filter((z) => group.zones.includes(z.zone))
        .map((z) => ({
          zone: z.zone,
          description: z.zoneDescription,
        }));

      return {
        groupName: group.zoneGroupName,
        zones: zoneDetails,
      };
    });

    res.json(formattedGroups);
  } catch (error) {
    console.error("Error fetching KPI groups:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/charts/thousand-trays-number/:groupName", async (req, res) => {
  const { groupName } = req.params;

  try {
    const trayAmount = await db.models.ZoneGroupData.findAll({
      order: [["date", "ASC"]],
      where: {
        zoneGroupName: groupName,
      },
      attributes: ["date"],
    });
    if (!trayAmount || trayAmount.length === 0) {
      return res
        .status(404)
        .json({ error: "No tray data found for this group" });
    }

    const formattedData = trayAmount.map(async (item) => {
      const data = await db.query(
        "CALL getErrorsByThousand(:from, :to, :groupName)",
        {
          replacements: {
            from: dayjs(item.date + "00:00:00").format("YYYY-MM-DD HH:mm:ss"),
            to: dayjs(item.date + "23:59:59").format("YYYY-MM-DD HH:mm:ss"),
            groupName,
          },
        }
      );

      return {
        date: dayjs(item.date).format("YYYY-MM-DD"),
        number: data[0].result || 0,
        time: 0,
      };
    });
    const results = await Promise.all(formattedData);

    function calculateMovingAverage(data, windowSize = 7) {
      return data.map((item, index) => {
        const start = Math.max(0, index - windowSize + 1);
        const window = data.slice(start, index + 1);

        const average =
          window.reduce((sum, point) => sum + point.number, 0) / window.length;

        return {
          ...item,
          movingAverage: Math.round(average * 100) / 100,
        };
      });
    }

    res.json(calculateMovingAverage(results));
  } catch (error) {
    console.error("Error fetching KPI charts:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/charts/alarms-by-group/:groupName", async (req, res) => {
  const { groupName } = req.params;

  try {
    let lastSevenDays = [];
    for (let i = 0; i < 7; i++) {
      const alarms = await db.query(
        "CALL getKPICountByZoneGroup(:from, :to, :groupName, false, 10)",
        {
          replacements: {
            from: dayjs()
              .subtract(7, "day")
              .startOf("day")
              .format("YYYY-MM-DD HH:mm:ss"),
            to: dayjs().endOf("day").format("YYYY-MM-DD HH:mm:ss"),
            groupName,
          },
        }
      );
      lastSevenDays.push({
        date: dayjs().subtract(i, "day").format("YYYY-MM-DD"),
        alarms: alarms || [],
      });
    }

    res.json(lastSevenDays);
  } catch (error) {
    console.error("Error fetching KPI alarms by group:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
