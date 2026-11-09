const idOf = (value) => String(value?._id || value || '');

// Org hierarchy:  Department > Cluster > Section.
// A Coordinator looks after one or more CLUSTERS of one department and decides
// on posts from faculty in those clusters. Super Admin is unrestricted.

// Does this Coordinator look after the item's cluster?
// Older items saved before clusters were required have no cluster; the
// Coordinators of their department may still decide on those.
function coversCluster(user, item) {
  if (!item || !item.cluster) return true;
  return (user.clusters || []).includes(item.cluster);
}

// A Coordinator may only decide on items from their own department AND their
// own cluster(s). Super Admin is unrestricted. Co-organizing departments are
// informed about an item but do not decide on it.
function canDecide(user, item) {
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role !== 'COORDINATOR') return false;
  const userDept = idOf(user.department);
  const itemDept = idOf(item.department);
  if (!userDept || !itemDept || userDept !== itemDept) return false;
  return coversCluster(user, item);
}

// Nobody decides on their own submission, except a Super Admin.
function isOwnSubmission(user, item) {
  if (user.role === 'SUPER_ADMIN') return false;
  return idOf(item.submittedBy || item.createdBy) === idOf(user._id);
}

// Copies only the listed fields from a request body. Anything else
// (status, submittedBy, approvalHistory, isAdmin, ...) is ignored.
function pickFields(source, allowed) {
  const picked = {};
  allowed.forEach((field) => {
    if (source && source[field] !== undefined) picked[field] = source[field];
  });
  return picked;
}

// Decides which cluster / section a new post belongs to.
// Faculty and Coordinators can only post under clusters and sections they are
// assigned to. If they belong to exactly one cluster it is filled in for them.
// Returns { cluster, section } or { error }.
function resolveScope(user, payload = {}) {
  if (user.role === 'SUPER_ADMIN') {
    return { cluster: payload.cluster || undefined, section: payload.section || undefined };
  }
  const clusters = user.clusters || [];
  const sections = user.sections || [];
  let cluster = payload.cluster || undefined;
  const section = payload.section || undefined;

  if (cluster && !clusters.includes(cluster)) {
    return { error: 'You can only post for a cluster you are assigned to.' };
  }
  if (!cluster) {
    if (clusters.length === 1) [cluster] = clusters;
    else if (clusters.length > 1) return { error: 'Please choose which of your clusters this belongs to.' };
  }
  if (section && !sections.includes(section)) {
    return { error: 'You can only post for a section you are assigned to.' };
  }
  return { cluster, section };
}

const PUBLIC_STATUSES = ['APPROVED', 'PUBLISHED'];

// A database filter for "the items this user is allowed to see".
// ownerField is the field holding who posted it (createdBy for events,
// submittedBy for the other types). With { coDepartments: true } (events
// only), a co-organizing department counts as the user's department too.
// An empty object means no restriction; { _id: null } matches nothing.
//
//   Super Admin : everything
//   Coordinator : approved items of the department, plus everything (drafts,
//                 pending, rejected) from their own cluster(s) and their own posts
//   Faculty     : approved items of the department, plus their own posts
//   Others      : approved items of the department
function visibilityQuery(user, ownerField, { coDepartments = false } = {}) {
  if (user.role === 'SUPER_ADMIN') return {};
  const dept = idOf(user.department);
  if (!dept) return { _id: null };

  const inDept = coDepartments
    ? { $or: [{ department: dept }, { coDepartments: dept }] }
    : { department: dept };

  if (user.role === 'COORDINATOR') {
    return {
      $and: [
        inDept,
        {
          $or: [
            { status: { $in: PUBLIC_STATUSES } },
            { [ownerField]: user._id },
            { cluster: { $in: user.clusters || [] } },
            { cluster: { $exists: false } },
            { cluster: null },
            { cluster: '' },
          ],
        },
      ],
    };
  }
  if (user.role === 'FACULTY') {
    return {
      $and: [inDept, { $or: [{ status: { $in: PUBLIC_STATUSES } }, { [ownerField]: user._id }] }],
    };
  }
  return { $and: [inDept, { status: { $in: PUBLIC_STATUSES } }] };
}

// The same rule, for a single item that has already been loaded.
function canView(user, item, ownerField, { coDepartments = false } = {}) {
  if (user.role === 'SUPER_ADMIN') return true;
  const dept = idOf(user.department);
  if (!dept) return false;

  const inDept =
    idOf(item.department) === dept ||
    (coDepartments && (item.coDepartments || []).some((d) => idOf(d) === dept));
  if (!inDept) return false;

  if (PUBLIC_STATUSES.includes(item.status)) return true;
  if (idOf(item[ownerField]) === idOf(user._id)) return true;
  if (user.role === 'COORDINATOR') return coversCluster(user, item);
  return false;
}

module.exports = {
  canDecide,
  isOwnSubmission,
  pickFields,
  idOf,
  coversCluster,
  resolveScope,
  visibilityQuery,
  canView,
};