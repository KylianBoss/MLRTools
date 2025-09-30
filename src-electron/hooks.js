export default class Hooks {
  constructor(db, username) {
    this.db = db;
    this.username = username || "system";
  }

  async afterUpdate(instance, options) {
    const table = instance.constructor.tableName;
    const previous = instance._previousDataValues;
    const current = instance.dataValues;
    const changes = options.fields;

    const old = {};
    const new_ = {};

    const ignoreFields = [
      "createdAt",
      "isBotActive",
    ];

    if (changes.filter((change) => !ignoreFields.includes(change)).length === 0)
      return;

    for (const change of changes.filter(
      (change) => !ignoreFields.includes(change)
    )) {
      old[change] = previous[change];
      new_[change] = current[change];
    }

    if (!current.id) {
      console.error("No id in current after update hook");
    }

    const audit = {
      type: "UPDATE",
      table,
      old,
      new_,
      data_id: current?.id,
      user: this.username,
    };

    await this.db.models.Audit.create(audit);
  }

  async afterCreate(instance, options) {
    const table = instance.constructor.tableName;
    const current = instance.dataValues;

    if (
      [
        "audits",
      ].includes(table.toLowerCase())
    )
      return;

    const new_ = current;

    if (!current.id) {
      console.error("No id in current after create hook");
    }

    const audit = {
      type: "CREATE",
      table,
      old: {},
      new_,
      data_id: current?.id,
      user: this.username,
    };

    await this.db.models.Audit.create(audit);
  }

  async afterDestroy(instance, options) {
    const table = instance.constructor.tableName;
    const current = instance.dataValues;

    const old = current;

    if (!current.id) {
      console.error("No id in current after destroy hook");
    }

    const audit = {
      type: "DELETE",
      table,
      old,
      new_: {},
      data_id: current?.id,
      user: this.username,
    };

    await this.db.models.Audit.create(audit);
  }

  init() {
    this.db.addHook("afterUpdate", this.afterUpdate.bind(this));
    this.db.addHook("afterCreate", this.afterCreate.bind(this));
    this.db.addHook("afterDestroy", this.afterDestroy.bind(this));
    console.log("Hooks initialized");
  }
}
