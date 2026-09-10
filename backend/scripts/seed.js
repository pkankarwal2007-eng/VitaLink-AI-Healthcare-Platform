const { seedAdmin } = require('./seedAdmin');

seedAdmin()
  .then((result) => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(() => {
    process.exit(1);
  });
