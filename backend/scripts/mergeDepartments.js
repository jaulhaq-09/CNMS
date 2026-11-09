// Merges one department into another.
//
//   node scripts/mergeDepartments.js --keep "Computer Science and Engineering" --remove "Computer Science & Engineering"
//   (add --apply to really change data; without it nothing is written)
//
// --keep / --remove accept an exact department name or its _id.
// Everything that points at the removed department (users, events,
// publications, patents, achievements, newsletters, ...) is repointed to the
// kept one. Clusters with the same name are merged, others are moved over.
// Then the removed department is deleted.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const modelsDir = [
  path.join(__dirname, '..', 'src', 'models'),
  path.join(__dirname, '..', 'models'),
].find((dir) => fs.existsSync(dir));

if (!modelsDir) {
  console.error('Could not find the models folder. Edit modelsDir at the top of this script.');
  process.exit(1);
}
fs.readdirSync(modelsDir)
  .filter((f) => f.endsWith('.js'))
  .forEach((f) => {
    try {
      require(path.join(modelsDir, f));
    } catch (e) {
      console.warn(`Skipped model ${f}: ${e.message}`);
    }
  });

const Department = mongoose.model('Department');
const Cluster = mongoose.model('Cluster');
const Section = mongoose.model('Section');

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
};
const APPLY = process.argv.includes('--apply');

async function findDepartment(value) {
  if (mongoose.Types.ObjectId.isValid(value)) {
    const byId = await Department.findById(value);
    if (byId) return byId;
  }
  return Department.findOne({ name: value });
}

// Every schema path (in every model) that references Department.
function departmentPaths() {
  const found = [];
  for (const modelName of mongoose.modelNames()) {
    if (['Department', 'Cluster', 'Section'].includes(modelName)) continue;
    const model = mongoose.model(modelName);
    model.schema.eachPath((p, type) => {
      const ref = type.options?.ref || type.caster?.options?.ref || type.options?.type?.[0]?.ref;
      if (ref === 'Department') found.push({ model, path: p });
    });
  }
  return found;
}

(async () => {
  const keepArg = arg('keep');
  const removeArg = arg('remove');
  if (!keepArg || !removeArg) {
    console.error('Usage: node scripts/mergeDepartments.js --keep "<name or id>" --remove "<name or id>" [--apply]');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const keep = await findDepartment(keepArg);
  const remove = await findDepartment(removeArg);
  if (!keep || !remove) {
    console.error(`Department not found: ${!keep ? keepArg : removeArg}`);
    process.exit(1);
  }
  if (String(keep._id) === String(remove._id)) {
    console.error('--keep and --remove are the same department.');
    process.exit(1);
  }

  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'}: merge "${remove.name}" (${remove._id}) into "${keep.name}" (${keep._id})\n`);

  // 1. Clusters and sections
  const removeClusters = await Cluster.find({ department: remove._id });
  for (const cluster of removeClusters) {
    const twin = await Cluster.findOne({ department: keep._id, name: cluster.name });
    if (!twin) {
      console.log(`Cluster "${cluster.name}": moved to the kept department`);
      if (APPLY) await Cluster.updateOne({ _id: cluster._id }, { department: keep._id });
      continue;
    }
    console.log(`Cluster "${cluster.name}": merged into the existing one`);
    const sections = await Section.find({ cluster: cluster._id });
    for (const section of sections) {
      const sectionTwin = await Section.findOne({ cluster: twin._id, name: section.name });
      if (sectionTwin) {
        console.log(`  Section "${section.name}": duplicate removed`);
        if (APPLY) await Section.deleteOne({ _id: section._id });
      } else {
        console.log(`  Section "${section.name}": moved`);
        if (APPLY) await Section.updateOne({ _id: section._id }, { cluster: twin._id });
      }
    }
    if (APPLY) await Cluster.deleteOne({ _id: cluster._id });
  }

  // 2. Everything else that references the department
  for (const { model, path: p } of departmentPaths()) {
    const filter = { [p]: remove._id };
    const count = await model.countDocuments(filter);
    if (count === 0) continue;
    console.log(`${model.modelName}.${p}: ${count} document(s)`);
    if (!APPLY) continue;
    // Arrays: add the kept id, then drop the removed one (avoids duplicates).
    const isArray = model.schema.path(p)?.instance === 'Array';
    if (isArray) {
      await model.updateMany(filter, { $addToSet: { [p]: keep._id } });
      await model.updateMany({ [p]: remove._id }, { $pull: { [p]: remove._id } });
    } else {
      await model.updateMany(filter, { $set: { [p]: keep._id } });
    }
  }

  // 3. Remove the old department
  console.log(`\nDepartment "${remove.name}": ${APPLY ? 'deleted' : 'would be deleted'}`);
  if (APPLY) await Department.deleteOne({ _id: remove._id });

  console.log(APPLY ? '\nDone.' : '\nNothing was changed. Run again with --apply to merge.');
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});