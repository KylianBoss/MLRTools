export function updateJob(data = {}, jobName) {
  return new Promise((resolve, reject) => {
    db.models.CronJobs.findOne({
      where: {
        action: jobName,
      },
    })
      .then((job) => {
        if (job) {
          job.update({ ...data }).then(() => {
            resolve(job);
          });
        } else {
          db.models.CronJobs.create({
            action: jobName,
            ...data,
          }).then((job) => {
            resolve(job);
          });
        }
      })
      .catch((error) => {
        console.error("Error updating job:", error);
        reject(error);
      });
  });
}
